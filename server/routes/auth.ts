import { Router } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth";
import { storage } from "../storage";
import { requireAuth, optionalAuth } from "../middleware/auth";
import { 
  loginSchema, 
  changePasswordSchema, 
  resetPasswordSchema,
  insertUserSchema,
  type LoginRequest, 
  type ChangePasswordRequest, 
  type ResetPasswordRequest 
} from "@shared/schema";

const router = Router();

/**
 * Login endpoint
 */
router.post("/login", async (req, res) => {
  try {
    const credentials: LoginRequest = loginSchema.parse(req.body);
    
    const user = await AuthService.authenticate(credentials);
    
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const sessionToken = await AuthService.createSession(user.id);
    
    // Set secure HTTP-only cookie with production-compatible settings
    res.cookie("sessionToken", sessionToken, {
      httpOnly: true,
      secure: true, // Always secure for production HTTPS
      sameSite: "none", // Required for cross-origin in Replit production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/", // Explicit path
    });

    // Remove sensitive information from response
    const { passwordHash, passwordResetToken, ...safeUser } = user;
    
    res.json({ 
      message: "Login successful", 
      user: safeUser 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/**
 * Logout endpoint
 */
router.post("/logout", requireAuth, async (req, res) => {
  try {
    const sessionToken = req.cookies?.sessionToken;
    
    if (sessionToken) {
      await AuthService.deleteSession(sessionToken);
    }
    
    res.clearCookie("sessionToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
    });
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
});

/**
 * Get current user profile
 */
router.get("/me", optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Remove sensitive information
    const { passwordHash, passwordResetToken, ...safeUser } = req.user;
    res.json(safeUser);
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

/**
 * Change password
 */
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const data: ChangePasswordRequest = changePasswordSchema.parse(req.body);
    
    const success = await AuthService.changePassword(
      req.user!.id,
      data.currentPassword,
      data.newPassword
    );
    
    if (!success) {
      return res.status(400).json({ message: "Invalid current password" });
    }
    
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Change password error:", error);
    res.status(500).json({ message: "Failed to change password" });
  }
});

/**
 * Create user (admin only)
 */
router.post("/users", requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    if (!["super_admin", "admin"].includes(req.user!.role || "")) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    const userData = insertUserSchema.parse(req.body);
    
    // Hash the password
    const passwordHash = await AuthService.hashPassword(userData.password);
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(userData.username);
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Create the user
    const { password, ...userDataWithoutPassword } = userData;
    const user = await storage.createUser({
      ...userDataWithoutPassword,
      passwordHash,
    });

    // Remove sensitive information from response
    const { passwordHash: _, passwordResetToken, ...safeUser } = user;
    
    res.status(201).json({
      message: "User created successfully",
      user: safeUser
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

/**
 * Request password reset
 */
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const resetToken = await AuthService.generatePasswordResetToken(email);
    
    if (!resetToken) {
      // Don't reveal if email exists or not for security
      return res.json({ message: "If the email exists, a reset link has been sent" });
    }

    // In a real application, you would send an email here
    // For now, we'll just return the token (remove this in production)
    res.json({ 
      message: "Reset token generated", 
      resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ message: "Failed to process password reset" });
  }
});

/**
 * Reset password with token
 */
router.post("/reset-password", async (req, res) => {
  try {
    const data: ResetPasswordRequest = resetPasswordSchema.parse(req.body);
    
    const success = await AuthService.resetPassword(data.token, data.newPassword);
    
    if (!success) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    
    res.json({ message: "Password reset successful" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        message: "Validation error", 
        errors: error.errors 
      });
    }
    
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;