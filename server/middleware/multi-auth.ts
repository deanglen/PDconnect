import type { Request, Response, NextFunction } from "express";

export interface AuthConfig {
  mode: 'token' | 'basic' | 'oauth' | 'none';
  tokenHeader?: string;
  adminToken?: string;
  basicAuth?: {
    username: string;
    password: string;
  };
  oauthProvider?: string;
  publicEndpoints?: string[];
}

// Get auth configuration from environment or defaults
function getAuthConfig(): AuthConfig {
  const mode = (process.env.AUTH_MODE || 'token') as AuthConfig['mode'];
  
  return {
    mode,
    tokenHeader: process.env.AUTH_TOKEN_HEADER || 'authorization',
    adminToken: process.env.ADMIN_TOKEN || 'demo-admin-token-2025',
    basicAuth: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123'
    },
    oauthProvider: process.env.OAUTH_PROVIDER,
    publicEndpoints: [
      '/health',
      '/api/stats',
      '/api/webhook/pandadoc',
      '/api/create-doc',
      '/api/tokens',
      '/api/users/me'  // User profile endpoint - uses personal API keys
    ]
  };
}

// Check if endpoint should be public
function isPublicEndpoint(path: string, config: AuthConfig): boolean {
  return config.publicEndpoints?.some(endpoint => 
    path.startsWith(endpoint) || path === endpoint
  ) || false;
}

// Token-based authentication - supports both admin tokens and personal API keys
async function validateTokenAuth(req: Request, config: AuthConfig): Promise<boolean> {
  const authHeader = req.headers[config.tokenHeader!.toLowerCase()];
  
  if (!authHeader || typeof authHeader !== 'string') {
    return false;
  }

  let token = authHeader;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  // First check if it's the admin token
  if (token === config.adminToken) {
    return true;
  }
  
  // Then check if it's a personal API key
  try {
    const { storage } = await import("../storage");
    const user = await storage.validateApiKey(token);
    if (user && user.isActive) {
      // Attach user to request for downstream use
      (req as any).user = user;
      return true;
    }
  } catch (error) {
    console.error('Error validating user API key:', error);
  }
  
  // Finally check if it's a tenant integration API key
  try {
    const { storage } = await import("../storage");
    const tenant = await storage.validateTenantApiKey(token);
    if (tenant && tenant.isActive) {
      // Attach tenant to request for downstream use
      (req as any).tenant = tenant;
      (req as any).authType = 'tenant_api_key';
      return true;
    }
  } catch (error) {
    console.error('Error validating tenant API key:', error);
  }

  return false;
}

// Session-based authentication using cookies
async function validateSessionAuth(req: Request): Promise<boolean> {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      return false;
    }

    const { AuthService } = await import("../services/auth");
    const user = await AuthService.getUserBySession(sessionToken);
    
    if (user && user.isActive) {
      // Attach user to request for downstream use
      (req as any).user = user;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error validating session:', error);
    return false;
  }
}

// Basic authentication
function validateBasicAuth(req: Request, config: AuthConfig): boolean {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  
  return username === config.basicAuth!.username && 
         password === config.basicAuth!.password;
}

// Main authentication middleware
export function createAuthMiddleware() {
  const config = getAuthConfig();

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for public endpoints
    if (isPublicEndpoint(req.path, config)) {
      return next();
    }

    // Skip auth if mode is 'none' (for development or specific deployments)
    if (config.mode === 'none') {
      return next();
    }

    let isAuthenticated = false;

    // Try session authentication first (for web UI)
    isAuthenticated = await validateSessionAuth(req);
    
    // If session auth fails, try token auth (for API access)
    if (!isAuthenticated) {
      switch (config.mode) {
        case 'token':
          isAuthenticated = await validateTokenAuth(req, config);
          if (!isAuthenticated) {
            return res.status(401).json({
              message: "Authentication required",
              hint: "Use Authorization: Bearer <admin_token_or_personal_api_key>"
            });
          }
          break;

        case 'basic':
          isAuthenticated = validateBasicAuth(req, config);
          if (!isAuthenticated) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
            return res.status(401).json({
              message: "Basic authentication required",
              hint: "Use username:password credentials"
            });
          }
        break;

      case 'oauth':
        // OAuth integration would go here
        // For now, fall back to token auth
        isAuthenticated = await validateTokenAuth(req, config);
        if (!isAuthenticated) {
          return res.status(401).json({
            message: "OAuth authentication not implemented, falling back to token auth"
          });
        }
        break;

      default:
        return res.status(500).json({
          message: "Invalid authentication mode configured"
        });
      }
    }

    next();
  };
}

// Health check for auth configuration
export function getAuthStatus(): object {
  const config = getAuthConfig();
  
  return {
    mode: config.mode,
    tokenHeaderConfigured: !!config.tokenHeader,
    adminTokenConfigured: !!config.adminToken,
    basicAuthConfigured: !!(config.basicAuth?.username && config.basicAuth?.password),
    oauthConfigured: !!config.oauthProvider,
    publicEndpoints: config.publicEndpoints?.length || 0
  };
}