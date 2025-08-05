import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { handleDocumentCreation } from "../routes";

/**
 * Register dynamic Smart Routes from database configuration
 */
export async function registerDynamicSmartRoutes(app: Express) {
  try {
    const routeTemplates = await storage.getRouteTemplateRecords();
    const activeRoutes = routeTemplates.filter(route => route.isActive);
    
    console.log(`[SmartRoutes] Registering ${activeRoutes.length} active routes`);
    
    for (const route of activeRoutes) {
      // Register POST handler for each route path
      app.post(route.routePath, async (req: Request, res: Response) => {
        console.log(`[SmartRoute] Processing ${route.routePath} webhook`);
        
        // Import here to avoid circular dependency
        const { SmartRouteHandler } = await import('./smart-route-handler');
        
        // Analyze request using smart routing
        const routeMatch = await SmartRouteHandler.analyzeRequest(req);
        
        if (!routeMatch) {
          console.log(`[SmartRoute] No route configuration found for ${req.path}`);
          return res.status(404).json({
            success: false,
            error: "No route configuration found",
            path: req.path,
            timestamp: new Date().toISOString()
          });
        }

        console.log(`[SmartRoute] Route matched:`, {
          tenantId: routeMatch.tenantId,
          templateId: routeMatch.templateId,
          module: routeMatch.module,
          recordId: routeMatch.recordId
        });

        // Create document request for the handler
        const documentReq = {
          ...req,
          body: {
            record_id: routeMatch.recordId,
            module: routeMatch.module,
            tenant_id: routeMatch.tenantId,
            template_id: routeMatch.templateId
          }
        } as Request;

        // Handle asynchronous processing if configured
        if (route.asyncProcessing) {
          // Return immediate response and process in background
          res.json({
            success: true,
            message: "Document creation queued for processing",
            requestId: `smart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            route: route.routePath,
            timestamp: new Date().toISOString()
          });

          // Process in background
          setImmediate(async () => {
            try {
              await handleDocumentCreation(documentReq, {
                json: () => {},
                status: () => ({ json: () => {} }),
                getHeaders: () => ({}),
              } as any);
            } catch (error) {
              console.error(`[SmartRoute] Background processing failed:`, error);
            }
          });

          return;
        }

        // Synchronous processing
        await handleDocumentCreation(documentReq, res);
      });
      
      console.log(`[SmartRoutes] Registered route: ${route.routePath} -> ${route.sugarModule} / ${route.templateId}`);
    }
    
  } catch (error) {
    console.error('[SmartRoutes] Failed to register dynamic routes:', error);
  }
}