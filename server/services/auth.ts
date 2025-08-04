import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import type { LoginRequest, User } from "@shared/schema";

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Authenticate a user with username and password
   */
  static async authenticate(credentials: LoginRequest): Promise<User | null> {
    try {
      const user = await storage.getUserByUsername(credentials.username);
      
      if (!user || !user.passwordHash || !user.isActive) {
        return null;
      }

      const isValid = await this.verifyPassword(credentials.password, user.passwordHash);
      
      if (!isValid) {
        return null;
      }

      // Update last login time
      await storage.updateUserLoginTime(user.id);
      
      return user;
    } catch (error) {
      console.error("Authentication error:", error);
      return null;
    }
  }

  /**
   * Create a new session for a user
   */
  static async createSession(userId: string): Promise<string> {
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await storage.createSession({
      sessionToken,
      userId,
      expires: expiresAt,
    });

    return sessionToken;
  }

  /**
   * Get a user by session token
   */
  static async getUserBySession(sessionToken: string): Promise<User | null> {
    try {
      const session = await storage.getSessionByToken(sessionToken);
      
      if (!session || session.expires < new Date()) {
        // Clean up expired session
        if (session) {
          await storage.deleteSession(sessionToken);
        }
        return null;
      }

      const user = await storage.getUser(session.userId);
      
      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      console.error("Session lookup error:", error);
      return null;
    }
  }

  /**
   * Delete a session
   */
  static async deleteSession(sessionToken: string): Promise<void> {
    try {
      await storage.deleteSession(sessionToken);
    } catch (error) {
      console.error("Delete session error:", error);
    }
  }

  /**
   * Change a user's password
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      
      if (!user || !user.passwordHash) {
        return false;
      }

      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.passwordHash);
      
      if (!isCurrentPasswordValid) {
        return false;
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      await storage.updateUserPassword(userId, newPasswordHash);
      
      return true;
    } catch (error) {
      console.error("Change password error:", error);
      return false;
    }
  }

  /**
   * Generate a password reset token
   */
  static async generatePasswordResetToken(email: string): Promise<string | null> {
    try {
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return null;
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

      await storage.updateUserResetToken(user.id, resetToken, expiresAt);
      
      return resetToken;
    } catch (error) {
      console.error("Generate reset token error:", error);
      return null;
    }
  }

  /**
   * Reset password using a token
   */
  static async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const user = await storage.getUserByResetToken(token);
      
      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return false;
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      await storage.updateUserPassword(user.id, newPasswordHash);
      
      // Clear the reset token
      await storage.updateUserResetToken(user.id, null, null);
      
      return true;
    } catch (error) {
      console.error("Reset password error:", error);
      return false;
    }
  }
}