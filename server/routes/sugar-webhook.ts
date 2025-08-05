import { Router, type Request, type Response } from "express";
import { SmartRouteHandler } from "../services/smart-route-handler";
import { handleDocumentCreation } from "../routes";

const router = Router();

/**
 * Generic SugarCRM Web Logic Hook handler
 * Dynamically routes requests based on path configuration
 */
router.post("*", async (req: Request, res: Response) => {
  try {
    console.log(`[SugarWebhook] Received request to ${req.path}`, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent']
      },
      bodySize: JSON.stringify(req.body).length
    });

    // Analyze request using smart routing
    const routeMatch = await SmartRouteHandler.analyzeRequest(req);
    
    if (!routeMatch) {
      console.log(`[SugarWebhook] No route configuration found for ${req.path}`);
      return res.status(404).json({
        success: false,
        error: "No route configuration found",
        path: req.path,
        hint: "Configure a route template record for this path in the admin interface",
        timestamp: new Date().toISOString()
      });
    }

    console.log(`[SugarWebhook] Route matched:`, {
      tenantId: routeMatch.tenantId,
      templateId: routeMatch.templateId,
      module: routeMatch.module,
      recordId: routeMatch.recordId
    });

    // Create mock request for document creation handler
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
    if (routeMatch.routeRecord.asyncProcessing) {
      // Return immediate response and process in background
      SmartRouteHandler.createSuccessResponse(res, {
        message: "Document creation queued for processing",
        requestId: `sugar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      }, routeMatch.routeRecord);

      // Process in background (fire and forget)
      setImmediate(async () => {
        try {
          await handleDocumentCreation(documentReq, {
            json: () => {},
            status: () => ({ json: () => {} }),
            getHeaders: () => ({}),
          } as any);
        } catch (error) {
          console.error(`[SugarWebhook] Background processing failed:`, error);
        }
      });

      return;
    }

    // Synchronous processing - call document creation handler
    await handleDocumentCreation(documentReq, res);

  } catch (error) {
    console.error(`[SugarWebhook] Error processing request:`, error);
    
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET endpoint for testing routes
 */
router.get("*", async (req: Request, res: Response) => {
  try {
    const routeMatch = await SmartRouteHandler.analyzeRequest(req);
    
    if (!routeMatch) {
      return res.status(404).json({
        success: false,
        error: "No route configuration found",
        path: req.path,
        availableRoutes: await getAvailableRoutes(),
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      route: {
        path: req.path,
        tenantId: routeMatch.tenantId,
        templateId: routeMatch.templateId,
        module: routeMatch.module,
        tenant: routeMatch.tenant.name,
        template: routeMatch.template.name,
        requiresAuth: routeMatch.routeRecord.requiresAuth,
        asyncProcessing: routeMatch.routeRecord.asyncProcessing,
        responseFormat: routeMatch.routeRecord.responseFormat
      },
      message: "Route configuration found - ready to process SugarCRM webhooks",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[SugarWebhook] Error testing route:`, error);
    return res.status(500).json({
      success: false,
      error: "Failed to test route",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    });
  }
});

async function getAvailableRoutes() {
  try {
    const routes = await storage.getRouteTemplateRecords();
    return routes
      .filter(route => route.isActive)
      .map(route => ({
        path: route.routePath,
        module: route.sugarModule,
        tenant: route.tenantId
      }));
  } catch (error) {
    console.error("Error fetching available routes:", error);
    return [];
  }
}

export default router;