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

// Token-based authentication
function validateTokenAuth(req: Request, config: AuthConfig): boolean {
  const authHeader = req.headers[config.tokenHeader!.toLowerCase()];
  
  if (!authHeader || typeof authHeader !== 'string') {
    return false;
  }

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === config.adminToken;
  }
  
  return authHeader === config.adminToken;
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

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip auth for public endpoints
    if (isPublicEndpoint(req.path, config)) {
      return next();
    }

    // Skip auth if mode is 'none' (for development or specific deployments)
    if (config.mode === 'none') {
      return next();
    }

    let isAuthenticated = false;

    switch (config.mode) {
      case 'token':
        isAuthenticated = validateTokenAuth(req, config);
        if (!isAuthenticated) {
          return res.status(401).json({
            message: "Admin authentication required",
            hint: "Use Authorization: Bearer <admin_token> or set AUTH_MODE=none for development"
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
        isAuthenticated = validateTokenAuth(req, config);
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