/**
 * Enhanced logging utility with request redaction for security
 */

export interface LogContext {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  url?: string;
  userAgent?: string;
}

export interface ApiRequestLog {
  method: string;
  url: string;
  headers: Record<string, any>;
  body?: any;
  timestamp: string;
  requestId: string;
}

export interface ApiResponseLog {
  status: number;
  headers: Record<string, any>;
  body?: any;
  timestamp: string;
  requestId: string;
  duration: number;
}

class Logger {
  private sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'cookie',
    'session',
    'api_key',
    'access_token',
    'refresh_token',
    'client_secret',
    'webhook_shared_secret',
    'sugar_crm_password',
    'panda_doc_api_key'
  ];

  /**
   * Redact sensitive information from objects
   */
  private redactSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.redactSensitiveData(item));
    }
    
    const redacted = { ...obj };
    
    for (const [key, value] of Object.entries(redacted)) {
      const lowerKey = key.toLowerCase();
      
      if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = this.redactSensitiveData(value);
      }
    }
    
    return redacted;
  }

  private formatMessage(level: string, message: string, context?: LogContext, extra?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? JSON.stringify(this.redactSensitiveData(context)) : '';
    const extraStr = extra ? JSON.stringify(this.redactSensitiveData(extra)) : '';
    
    return `${timestamp} [${level.toUpperCase()}] ${message} ${contextStr} ${extraStr}`.trim();
  }

  info(message: string, context?: LogContext, extra?: any): void {
    console.log(this.formatMessage('info', message, context, extra));
  }

  error(message: string, context?: LogContext, error?: Error | any): void {
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name }
      : error;
    
    console.error(this.formatMessage('error', message, context, errorDetails));
  }

  warn(message: string, context?: LogContext, extra?: any): void {
    console.warn(this.formatMessage('warn', message, context, extra));
  }

  debug(message: string, context?: LogContext, extra?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.formatMessage('debug', message, context, extra));
    }
  }

  /**
   * Log API requests with redacted sensitive data
   */
  logApiRequest(req: ApiRequestLog): void {
    this.info('API Request', {
      method: req.method,
      url: req.url,
      requestId: req.requestId
    }, {
      headers: this.redactSensitiveData(req.headers),
      body: this.redactSensitiveData(req.body),
      timestamp: req.timestamp
    });
  }

  /**
   * Log API responses with redacted sensitive data
   */
  logApiResponse(res: ApiResponseLog): void {
    this.info('API Response', {
      requestId: res.requestId
    }, {
      status: res.status,
      headers: this.redactSensitiveData(res.headers),
      body: this.redactSensitiveData(res.body),
      duration: res.duration,
      timestamp: res.timestamp
    });
  }

  /**
   * Log webhook events
   */
  logWebhookEvent(eventType: string, tenantId: string, payload: any, processingResult?: any): void {
    this.info('Webhook Event', {
      tenantId,
      requestId: `webhook-${Date.now()}`
    }, {
      eventType,
      payload: this.redactSensitiveData(payload),
      result: processingResult
    });
  }

  /**
   * Log failed operations for retry queue
   */
  logFailedOperation(operation: string, tenantId: string, error: Error, retryCount: number = 0): void {
    this.error('Failed Operation', {
      tenantId,
      requestId: `fail-${Date.now()}`
    }, {
      operation,
      retryCount,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    });
  }
}

export const logger = new Logger();