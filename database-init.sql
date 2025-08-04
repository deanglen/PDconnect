-- Database Initialization Script for Production Deployment
-- Run this script after deployment to set up the admin user

-- Create the admin user with verified credentials
INSERT INTO users (id, username, email, password_hash, role, is_active, created_at, updated_at) 
VALUES (
  'f541f696-86b3-406c-bda7-e174d0bd38b0', 
  'admin', 
  'admin@integration.com', 
  '$2b$12$Dj1T9UB.zL7Gd4L7vMo0FOABt8h2kOCGWSaryWou2rPT6O8GUt0Jy', 
  'super_admin', 
  true, 
  NOW(), 
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Verify the user was created
SELECT username, email, role, is_active FROM users WHERE username = 'admin';