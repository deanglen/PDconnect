# Production Database Setup Guide

## After Deployment - Database Initialization

Once your application is deployed to production, you need to initialize the database with an admin user.

### Method 1: Using Replit Database Console (Recommended)

1. **Access the Database Console:**
   - Go to your deployed Replit project
   - Open the Database tab in the sidebar
   - Click on "Console" to access the SQL console

2. **Run the Initialization Script:**
   ```sql
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
   ```

3. **Verify Setup:**
   ```sql
   SELECT username, email, role, is_active FROM users WHERE username = 'admin';
   ```

### Method 2: Using Database Migration (Alternative)

1. **Run Database Push:**
   ```bash
   npm run db:push
   ```

2. **Connect to Production Database:**
   Use the production database URL from your environment variables

3. **Execute the SQL Script:**
   Run the `database-init.sql` file against your production database

### Production Login Credentials

After initialization, you can log in with:
- **Username:** `admin`
- **Password:** `admin123`
- **Role:** Super Admin (full system access)

### Important Notes

- The password hash is pre-generated using bcrypt with 12 salt rounds
- The admin user has `super_admin` role with full system access
- The script uses `ON CONFLICT` to safely update existing records
- Always verify the user was created successfully before proceeding

### Post-Setup Verification

1. Navigate to your deployed application
2. Go to the login page
3. Use the credentials: admin / admin123
4. Verify you can access all admin features

### Security Recommendations

After initial setup:
1. Change the default admin password
2. Create additional users with appropriate roles
3. Disable the default admin user if using SSO
4. Enable audit logging for user activities