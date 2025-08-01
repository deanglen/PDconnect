/**
 * Webhook Processor Service - Handles asynchronous webhook processing with retry logic
 */

import { storage } from "../storage";
import { WorkflowEngine } from "./workflow";
import { logger } from "../utils/logger";
import { retryQueue } from "../utils/retry-queue";
import type { WebhookLog, InsertWebhookLog } from "@shared/schema";

export interface WebhookProcessorConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  maxRetryDelayMs: number;
}

export class WebhookProcessor {
  private static defaultConfig: WebhookProcessorConfig = {
    maxRetries: 3,
    retryDelayMs: 1000, // 1 second base delay
    exponentialBackoff: true,
    maxRetryDelayMs: 60000, // 1 minute max delay
  };

  /**
   * Persist webhook payload immediately and queue for async processing
   */
  static async persistAndQueue(
    payload: any,
    tenantId: string,
    eventId?: string,
    config: Partial<WebhookProcessorConfig> = {}
  ): Promise<WebhookLog> {
    const processingConfig = { ...this.defaultConfig, ...config };
    
    try {
      // Create webhook log entry with pending status
      const webhookLogData: InsertWebhookLog = {
        eventId: eventId || `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenantId,
        eventType: payload.event_type || 'unknown',
        documentId: payload.data?.id || payload.document?.id,
        documentName: payload.data?.name || payload.document?.name,
        payload: payload,
        status: 'pending',
        maxRetries: processingConfig.maxRetries,
        retryCount: 0,
      };

      const webhookLog = await storage.createWebhookLog(webhookLogData);

      logger.logWebhookEvent({
        webhookId: webhookLog.id,
        eventType: webhookLog.eventType,
        tenantId,
        status: 'persisted',
        timestamp: new Date().toISOString(),
      });

      // Queue for immediate processing
      await this.queueForProcessing(webhookLog.id, 0);

      return webhookLog;
    } catch (error) {
      logger.logWebhookError({
        tenantId,
        eventType: payload.event_type || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'persistence',
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Process a webhook log entry
   */
  static async processWebhook(webhookLogId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Get webhook log
      const webhookLog = await storage.getWebhookLogById(webhookLogId);
      if (!webhookLog) {
        throw new Error(`Webhook log not found: ${webhookLogId}`);
      }

      // Skip if already processed or permanently failed
      if (webhookLog.status === 'success' || webhookLog.status === 'permanently_failed') {
        return;
      }

      // Update status to processing
      await storage.updateWebhookLog(webhookLogId, {
        status: 'processing',
        updatedAt: new Date(),
      });

      logger.logWebhookEvent({
        webhookId: webhookLogId,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId || 'unknown',
        status: 'processing_started',
        timestamp: new Date().toISOString(),
      });

      // Process the webhook
      const result = await this.executeWebhookProcessing(webhookLog);

      // Update success status
      const processingTime = Date.now() - startTime;
      await storage.updateWebhookLog(webhookLogId, {
        status: 'success',
        actionsTriggered: result.actionsTriggered,
        processingTimeMs: processingTime,
        processedAt: new Date(),
        updatedAt: new Date(),
      });

      logger.logWebhookEvent({
        webhookId: webhookLogId,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId || 'unknown',
        status: 'success',
        actionsTriggered: result.actionsTriggered,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      await this.handleProcessingError(webhookLogId, error, startTime);
    }
  }

  /**
   * Execute the actual webhook processing logic
   */
  private static async executeWebhookProcessing(webhookLog: WebhookLog): Promise<{ actionsTriggered: number }> {
    if (!webhookLog.tenantId) {
      throw new Error('No tenant ID associated with webhook');
    }

    const tenant = await storage.getTenant(webhookLog.tenantId);
    if (!tenant) {
      throw new Error(`Tenant not found: ${webhookLog.tenantId}`);
    }

    // Get active workflows for this event type
    const workflows = await storage.getWorkflowsByEvent(webhookLog.tenantId, webhookLog.eventType);
    
    if (workflows.length === 0) {
      logger.logWebhookEvent({
        webhookId: webhookLog.id,
        eventType: webhookLog.eventType,
        tenantId: webhookLog.tenantId,
        status: 'no_workflows_found',
        timestamp: new Date().toISOString(),
      });
      return { actionsTriggered: 0 };
    }

    // Initialize workflow engine
    const workflowEngine = new WorkflowEngine(tenant);
    let totalActionsTriggered = 0;

    // Process each workflow
    for (const workflow of workflows) {
      try {
        const result = await workflowEngine.executeWorkflow(workflow, webhookLog.payload);
        totalActionsTriggered += result.actionsExecuted;

        logger.logWorkflowExecution({
          workflowId: workflow.id,
          workflowName: workflow.name,
          webhookId: webhookLog.id,
          actionsExecuted: result.actionsExecuted,
          status: 'success',
          timestamp: new Date().toISOString(),
        });
      } catch (workflowError) {
        logger.logWorkflowExecution({
          workflowId: workflow.id,
          workflowName: workflow.name,
          webhookId: webhookLog.id,
          status: 'failed',
          error: workflowError instanceof Error ? workflowError.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        // Continue processing other workflows even if one fails
      }
    }

    return { actionsTriggered: totalActionsTriggered };
  }

  /**
   * Handle processing errors with retry logic
   */
  private static async handleProcessingError(
    webhookLogId: string,
    error: unknown,
    startTime: number
  ): Promise<void> {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    try {
      const webhookLog = await storage.getWebhookLogById(webhookLogId);
      if (!webhookLog) return;

      const newRetryCount = webhookLog.retryCount + 1;
      const maxRetries = webhookLog.maxRetries || this.defaultConfig.maxRetries;

      if (newRetryCount >= maxRetries) {
        // Mark as permanently failed
        await storage.updateWebhookLog(webhookLogId, {
          status: 'permanently_failed',
          retryCount: newRetryCount,
          errorMessage,
          processingTimeMs: processingTime,
          updatedAt: new Date(),
        });

        logger.logWebhookError({
          webhookId: webhookLogId,
          tenantId: webhookLog.tenantId || 'unknown',
          eventType: webhookLog.eventType,
          error: errorMessage,
          stage: 'permanently_failed',
          retryCount: newRetryCount,
          timestamp: new Date().toISOString(),
        });
      } else {
        // Schedule retry
        const retryDelay = this.calculateRetryDelay(newRetryCount);
        const nextRetryAt = new Date(Date.now() + retryDelay);

        await storage.updateWebhookLog(webhookLogId, {
          status: 'failed',
          retryCount: newRetryCount,
          errorMessage,
          processingTimeMs: processingTime,
          nextRetryAt,
          updatedAt: new Date(),
        });

        // Queue for retry
        await this.queueForProcessing(webhookLogId, retryDelay);

        logger.logWebhookError({
          webhookId: webhookLogId,
          tenantId: webhookLog.tenantId || 'unknown',
          eventType: webhookLog.eventType,
          error: errorMessage,
          stage: 'retry_scheduled',
          retryCount: newRetryCount,
          nextRetryAt: nextRetryAt.toISOString(),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (updateError) {
      logger.logWebhookError({
        webhookId: webhookLogId,
        tenantId: 'unknown',
        eventType: 'unknown',
        error: `Failed to update webhook log: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
        stage: 'error_handling',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private static calculateRetryDelay(retryCount: number): number {
    const { retryDelayMs, exponentialBackoff, maxRetryDelayMs } = this.defaultConfig;
    
    if (!exponentialBackoff) {
      return retryDelayMs;
    }

    // Exponential backoff: delay = baseDelay * (2 ^ retryCount) with jitter
    const exponentialDelay = retryDelayMs * Math.pow(2, retryCount - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    const totalDelay = exponentialDelay + jitter;

    return Math.min(totalDelay, maxRetryDelayMs);
  }

  /**
   * Queue webhook for processing (or retry)
   */
  private static async queueForProcessing(webhookLogId: string, delayMs: number = 0): Promise<void> {
    if (delayMs > 0) {
      // Schedule for later processing
      setTimeout(async () => {
        await this.processWebhook(webhookLogId);
      }, delayMs);
    } else {
      // Process immediately (in next tick to avoid blocking)
      setImmediate(async () => {
        await this.processWebhook(webhookLogId);
      });
    }
  }

  /**
   * Manually retry a failed webhook
   */
  static async manualRetry(webhookLogId: string): Promise<void> {
    const webhookLog = await storage.getWebhookLogById(webhookLogId);
    if (!webhookLog) {
      throw new Error(`Webhook log not found: ${webhookLogId}`);
    }

    if (webhookLog.status === 'success') {
      throw new Error('Webhook has already been processed successfully');
    }

    // Reset retry count and status for manual retry
    await storage.updateWebhookLog(webhookLogId, {
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
      nextRetryAt: null,
      updatedAt: new Date(),
    });

    // Queue for immediate processing
    await this.queueForProcessing(webhookLogId, 0);

    logger.logWebhookEvent({
      webhookId: webhookLogId,
      eventType: webhookLog.eventType,
      tenantId: webhookLog.tenantId || 'unknown',
      status: 'manual_retry_initiated',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get processing statistics
   */
  static async getProcessingStats(tenantId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    success: number;
    failed: number;
    permanentlyFailed: number;
  }> {
    const logs = await storage.getWebhookLogs(tenantId);
    
    const stats = {
      total: logs.length,
      pending: 0,
      processing: 0,
      success: 0,
      failed: 0,
      permanentlyFailed: 0,
    };

    logs.forEach(log => {
      switch (log.status) {
        case 'pending': stats.pending++; break;
        case 'processing': stats.processing++; break;
        case 'success': stats.success++; break;
        case 'failed': stats.failed++; break;
        case 'permanently_failed': stats.permanentlyFailed++; break;
      }
    });

    return stats;
  }
}