import type { Request, Response, NextFunction } from "express";

// Simple admin authentication middleware
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      message: "Admin authentication required",
      hint: "Use Authorization: Bearer <admin_token>" 
    });
  }

  const token = authHeader.substring(7);
  const adminToken = process.env.ADMIN_TOKEN || 'demo-admin-token-2025';
  
  if (token !== adminToken) {
    return res.status(403).json({ message: "Invalid admin token" });
  }

  next();
}

// Optional: Basic auth for web interface
export function requireBasicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Panel"');
    return res.status(401).json({ message: "Authentication required" });
  }

  const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (username !== adminUsername || password !== adminPassword) {
    return res.status(403).json({ message: "Invalid credentials" });
  }

  next();
}