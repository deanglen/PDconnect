import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth";
import { storage } from "../storage";
import type { User } from "@shared/schema";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/**
 * Middleware to authenticate requests with session cookies
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (sessionToken) {
      const user = await AuthService.getUserBySession(sessionToken);
      req.user = user || undefined;
    }
    
    next();
  } catch (error) {
    console.error("Optional auth middleware error:", error);
    next();
  }
};

/**
 * Middleware to require authentication
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await AuthService.getUserBySession(sessionToken);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Require auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (!["super_admin", "admin"].includes((req.user as any).role || "viewer")) {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

/**
 * Middleware to require API key authentication (for external integrations)
 */
export const requireApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers.authorization?.replace("Bearer ", "");
    
    if (!apiKey) {
      return res.status(401).json({ message: "API key required" });
    }

    const user = await storage.validateApiKey(apiKey);
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "Invalid API key" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("API key auth middleware error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};