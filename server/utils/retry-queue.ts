/**
 * Retry queue for failed webhook operations
 */

import { logger } from './logger';

export interface RetryJob {
  id: string;
  tenantId: string;
  operation: string;
  payload: any;
  maxRetries: number;
  currentRetry: number;
  nextRetryAt: Date;
  createdAt: Date;
  lastError?: string;
}

class RetryQueue {
  private jobs: Map<string, RetryJob> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Add a job to the retry queue
   */
  addJob(tenantId: string, operation: string, payload: any, maxRetries: number = 3): string {
    const jobId = `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: RetryJob = {
      id: jobId,
      tenantId,
      operation,
      payload,
      maxRetries,
      currentRetry: 0,
      nextRetryAt: new Date(Date.now() + this.getRetryDelay(0)),
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    
    logger.info('Added job to retry queue', {
      tenantId,
      requestId: jobId
    }, {
      operation,
      maxRetries,
      nextRetryAt: job.nextRetryAt
    });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return jobId;
  }

  /**
   * Remove a job from the queue
   */
  removeJob(jobId: string): boolean {
    return this.jobs.delete(jobId);
  }

  /**
   * Get retry delay in milliseconds (exponential backoff)
   */
  private getRetryDelay(retryCount: number): number {
    const baseDelay = 30000; // 30 seconds
    const maxDelay = 1800000; // 30 minutes
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.1 * Math.random();
    return delay + jitter;
  }

  /**
   * Start processing the retry queue
   */
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    logger.info('Starting retry queue processor');

    this.processingInterval = setInterval(() => {
      this.processJobs();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Stop processing the retry queue
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
    logger.info('Stopped retry queue processor');
  }

  /**
   * Process ready jobs
   */
  private async processJobs(): Promise<void> {
    const now = new Date();
    const readyJobs = Array.from(this.jobs.values()).filter(
      job => job.nextRetryAt <= now && job.currentRetry < job.maxRetries
    );

    if (readyJobs.length === 0) return;

    logger.info(`Processing ${readyJobs.length} retry jobs`);

    for (const job of readyJobs) {
      try {
        await this.executeJob(job);
        this.jobs.delete(job.id); // Remove successful job
        
        logger.info('Retry job completed successfully', {
          tenantId: job.tenantId,
          requestId: job.id
        }, {
          operation: job.operation,
          retryCount: job.currentRetry
        });
      } catch (error) {
        await this.handleJobFailure(job, error as Error);
      }
    }
  }

  /**
   * Execute a retry job
   */
  private async executeJob(job: RetryJob): Promise<void> {
    job.currentRetry++;
    
    switch (job.operation) {
      case 'webhook_processing':
        await this.retryWebhookProcessing(job);
        break;
      case 'sugar_crm_update':
        await this.retrySugarCRMUpdate(job);
        break;
      case 'pandadoc_document_creation':
        await this.retryPandaDocCreation(job);
        break;
      default:
        throw new Error(`Unknown retry operation: ${job.operation}`);
    }
  }

  /**
   * Handle job failure
   */
  private async handleJobFailure(job: RetryJob, error: Error): Promise<void> {
    job.lastError = error.message;
    
    if (job.currentRetry >= job.maxRetries) {
      // Max retries reached, remove job and log final failure
      this.jobs.delete(job.id);
      
      logger.error('Retry job failed permanently', {
        tenantId: job.tenantId,
        requestId: job.id
      }, {
        operation: job.operation,
        totalRetries: job.currentRetry,
        finalError: error.message,
        payload: job.payload
      });
    } else {
      // Schedule next retry
      job.nextRetryAt = new Date(Date.now() + this.getRetryDelay(job.currentRetry));
      
      logger.warn('Retry job failed, scheduling next attempt', {
        tenantId: job.tenantId,
        requestId: job.id
      }, {
        operation: job.operation,
        retryCount: job.currentRetry,
        nextRetryAt: job.nextRetryAt,
        error: error.message
      });
    }
  }

  /**
   * Retry webhook processing
   */
  private async retryWebhookProcessing(job: RetryJob): Promise<void> {
    const { WorkflowEngine } = await import('../services/workflow');
    const { storage } = await import('../storage');
    const { SugarCRMService } = await import('../services/sugarcrm');
    const { PandaDocService } = await import('../services/pandadoc');

    const tenant = await storage.getTenant(job.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${job.tenantId} not found`);
    }

    const sugarService = new SugarCRMService(tenant);
    const pandaService = new PandaDocService(tenant);
    const workflowEngine = new WorkflowEngine(tenant, sugarService, pandaService);

    await workflowEngine.processWebhook(job.payload.eventType, job.payload);
  }

  /**
   * Retry SugarCRM update
   */
  private async retrySugarCRMUpdate(job: RetryJob): Promise<void> {
    const { SugarCRMService } = await import('../services/sugarcrm');
    const { storage } = await import('../storage');

    const tenant = await storage.getTenant(job.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${job.tenantId} not found`);
    }

    const sugarService = new SugarCRMService(tenant);
    await sugarService.updateRecord(
      job.payload.module,
      job.payload.recordId,
      job.payload.data
    );
  }

  /**
   * Retry PandaDoc document creation
   */
  private async retryPandaDocCreation(job: RetryJob): Promise<void> {
    const { PandaDocService } = await import('../services/pandadoc');
    const { storage } = await import('../storage');

    const tenant = await storage.getTenant(job.tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${job.tenantId} not found`);
    }

    const pandaService = new PandaDocService(tenant);
    await pandaService.createDocument(
      job.payload.templateId,
      job.payload.tokens,
      job.payload.name,
      job.payload.metadata
    );
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    totalJobs: number;
    readyJobs: number;
    failedJobs: number;
    averageRetries: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const now = new Date();
    
    return {
      totalJobs: jobs.length,
      readyJobs: jobs.filter(job => job.nextRetryAt <= now).length,
      failedJobs: jobs.filter(job => job.currentRetry >= job.maxRetries).length,
      averageRetries: jobs.length > 0 
        ? jobs.reduce((sum, job) => sum + job.currentRetry, 0) / jobs.length 
        : 0
    };
  }
}

export const retryQueue = new RetryQueue();

// Initialize retry queue processing
export function initializeRetryQueue(): void {
  if (!retryQueue['isProcessing']) {
    (retryQueue as any).startProcessing();
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  retryQueue.stopProcessing();
});

process.on('SIGINT', () => {
  retryQueue.stopProcessing();
});