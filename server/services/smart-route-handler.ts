import { storage } from "../storage";
import { type RouteTemplateRecord, type DocumentTemplate, type Tenant } from "@shared/schema";
import type { Request, Response } from "express";

export interface SugarWebHookPayload {
  id?: string;                    // Record ID
  module?: string;               // SugarCRM module name
  module_name?: string;          // Alternative module name field
  bean_id?: string;              // Alternative record ID field
  record_id?: string;            // Direct record ID field
  bean?: any;                    // Full record data
  [key: string]: any;            // Additional fields
}

export interface SmartRouteMatch {
  tenantId: string;
  templateId: string;
  module: string;
  recordId: string;
  routeRecord: RouteTemplateRecord;
  template: DocumentTemplate;
  tenant: Tenant;
}

export class SmartRouteHandler {
  /**
   * Analyze incoming SugarCRM Web Logic Hook request and determine routing
   */
  static async analyzeRequest(req: Request): Promise<SmartRouteMatch | null> {
    try {
      const routePath = req.path;
      const payload: SugarWebHookPayload = req.body;

      console.log(`[SmartRoute] Analyzing request to ${routePath}`, {
        payload: this.sanitizePayload(payload)
      });

      // Step 1: Find matching route template record
      const routeRecord = await this.findRouteByPath(routePath);
      if (!routeRecord) {
        console.log(`[SmartRoute] No route template found for path: ${routePath}`);
        return null;
      }

      console.log(`[SmartRoute] Found route template:`, {
        id: routeRecord.id,
        module: routeRecord.sugarModule,
        templateId: routeRecord.templateId
      });

      // Step 2: Extract record ID from payload
      const recordId = this.extractRecordId(payload);
      if (!recordId) {
        console.log(`[SmartRoute] No record ID found in payload`);
        return null;
      }

      // Step 3: Load tenant and template data
      const [tenant, template] = await Promise.all([
        storage.getTenant(routeRecord.tenantId),
        storage.getDocumentTemplate(routeRecord.templateId)
      ]);

      if (!tenant) {
        console.log(`[SmartRoute] Tenant not found: ${routeRecord.tenantId}`);
        return null;
      }

      if (!template) {
        console.log(`[SmartRoute] Template not found: ${routeRecord.templateId}`);
        return null;
      }

      // Step 4: Validate module consistency
      const detectedModule = this.extractModule(payload) || routeRecord.sugarModule;
      if (detectedModule !== routeRecord.sugarModule && detectedModule !== template.sugarModule) {
        console.log(`[SmartRoute] Module mismatch - detected: ${detectedModule}, expected: ${routeRecord.sugarModule}`);
      }

      // Step 5: Additional criteria matching (if configured)
      if (!this.matchesCriteria(payload, routeRecord.matchCriteria as any)) {
        console.log(`[SmartRoute] Payload does not match additional criteria`);
        return null;
      }

      console.log(`[SmartRoute] Successfully matched route:`, {
        tenantId: tenant.id,
        templateId: template.id,
        module: routeRecord.sugarModule,
        recordId
      });

      return {
        tenantId: tenant.id,
        templateId: template.id,
        module: routeRecord.sugarModule,
        recordId,
        routeRecord,
        template,
        tenant
      };

    } catch (error) {
      console.error(`[SmartRoute] Error analyzing request:`, error);
      return null;
    }
  }

  /**
   * Find route template record by path
   */
  private static async findRouteByPath(routePath: string): Promise<RouteTemplateRecord | null> {
    try {
      const routes = await storage.getRouteTemplateRecords();
      
      // Exact path match first
      let match = routes.find(route => 
        route.isActive && route.routePath === routePath
      );

      // Pattern matching (basic wildcard support)
      if (!match) {
        match = routes.find(route => {
          if (!route.isActive) return false;
          
          // Simple wildcard matching: /opportunity/* matches /opportunity/contract
          const pattern = route.routePath.replace(/\*/g, '.*');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(routePath);
        });
      }

      return match || null;
    } catch (error) {
      console.error(`[SmartRoute] Error finding route by path:`, error);
      return null;
    }
  }

  /**
   * Extract record ID from various possible fields in the payload
   */
  private static extractRecordId(payload: SugarWebHookPayload): string | null {
    // Try multiple common field names for record ID
    const possibleFields = ['id', 'record_id', 'bean_id'];
    
    for (const field of possibleFields) {
      if (payload[field] && typeof payload[field] === 'string') {
        return payload[field];
      }
    }

    // Check if there's a nested bean object
    if (payload.bean && typeof payload.bean === 'object') {
      for (const field of possibleFields) {
        if (payload.bean[field] && typeof payload.bean[field] === 'string') {
          return payload.bean[field];
        }
      }
    }

    return null;
  }

  /**
   * Extract module name from payload
   */
  private static extractModule(payload: SugarWebHookPayload): string | null {
    const possibleFields = ['module', 'module_name'];
    
    for (const field of possibleFields) {
      if (payload[field] && typeof payload[field] === 'string') {
        return payload[field];
      }
    }

    // Check nested bean object
    if (payload.bean && typeof payload.bean === 'object') {
      for (const field of possibleFields) {
        if (payload.bean[field] && typeof payload.bean[field] === 'string') {
          return payload.bean[field];
        }
      }
    }

    return null;
  }

  /**
   * Check if payload matches additional criteria
   */
  private static matchesCriteria(payload: SugarWebHookPayload, criteria: any): boolean {
    if (!criteria || typeof criteria !== 'object' || Object.keys(criteria).length === 0) {
      return true; // No criteria means always match
    }

    try {
      for (const [field, expectedValue] of Object.entries(criteria)) {
        const actualValue = this.getNestedValue(payload, field);
        
        if (Array.isArray(expectedValue)) {
          // Array means "any of these values"
          if (!expectedValue.includes(actualValue)) {
            return false;
          }
        } else {
          // Exact match required
          if (actualValue !== expectedValue) {
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      console.error(`[SmartRoute] Error matching criteria:`, error);
      return false;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Sanitize payload for logging (remove sensitive fields)
   */
  private static sanitizePayload(payload: any): any {
    const sensitive = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...payload };
    
    const sanitizeObj = (obj: any, path = ''): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = Array.isArray(obj) ? [] : {};
      
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        const lowerKey = key.toLowerCase();
        
        if (sensitive.some(s => lowerKey.includes(s))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeObj(value, fullPath);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    };
    
    return sanitizeObj(sanitized);
  }

  /**
   * Create error response based on route configuration
   */
  static createErrorResponse(
    res: Response, 
    error: string, 
    routeRecord?: RouteTemplateRecord,
    statusCode = 400
  ): Response {
    if (routeRecord?.responseFormat === 'redirect' && routeRecord.errorRedirectUrl) {
      const redirectUrl = new URL(routeRecord.errorRedirectUrl);
      redirectUrl.searchParams.set('error', error);
      return res.redirect(redirectUrl.toString());
    }
    
    return res.status(statusCode).json({
      success: false,
      error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create success response based on route configuration
   */
  static createSuccessResponse(
    res: Response, 
    data: any, 
    routeRecord?: RouteTemplateRecord
  ): Response {
    if (routeRecord?.responseFormat === 'redirect' && routeRecord.successRedirectUrl) {
      const redirectUrl = new URL(routeRecord.successRedirectUrl);
      redirectUrl.searchParams.set('success', 'true');
      if (data.documentId) {
        redirectUrl.searchParams.set('documentId', data.documentId);
      }
      if (data.publicUrl) {
        redirectUrl.searchParams.set('url', data.publicUrl);
      }
      return res.redirect(redirectUrl.toString());
    }
    
    return res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  }
}