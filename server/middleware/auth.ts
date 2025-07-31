import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

// Extend Express Request type to include user data
declare global {
  namespace Express {
    interface Request {
      user?: {
        claims: {
          sub: string;
          email?: string;
          first_name?: string;
          last_name?: string;
          profile_image_url?: string;
        };
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
      };
    }
  }
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantAccess: string[];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user?.claims?.sub) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const user = await storage.getUser(req.user.claims.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach user data to request
    (req as any).authUser = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authUser = (req as any).authUser as AuthenticatedUser;
  
  if (!authUser || authUser.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}

export function requireTenantAccess(tenantId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = (req as any).authUser as AuthenticatedUser;
    
    if (!authUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Admin has access to everything
    if (authUser.role === "admin") {
      return next();
    }

    // Check if user has access to this tenant
    if (!authUser.tenantAccess.includes(tenantId)) {
      return res.status(403).json({ message: "Access denied to this tenant" });
    }
    
    next();
  };
}

export function canAccessTenant(authUser: AuthenticatedUser, tenantId: string): boolean {
  if (authUser.role === "admin") return true;
  return authUser.tenantAccess.includes(tenantId);
}