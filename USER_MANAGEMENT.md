# User Management & Administration Guide

Your SugarCRM ↔ PandaDoc middleware now includes comprehensive user management with role-based access control.

## 🔐 User Roles & Permissions

### **Super Admin**
- Full system access
- Can manage all users and tenants
- Can modify system configuration
- Can access all API endpoints

### **Admin**  
- Can manage assigned tenants
- Can view and edit tenant configurations
- Can manage users within their tenant scope
- Cannot modify system-wide settings

### **Viewer**
- Read-only access to assigned tenants
- Can view configurations and logs
- Cannot modify any settings
- Perfect for monitoring and support roles

## 👥 User Management API Endpoints

### **Create New User**
```bash
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.admin@company.com",
    "firstName": "John",
    "lastName": "Admin",
    "role": "admin",
    "tenantAccess": ["tenant-acme-corp"],
    "isActive": true
  }' \
  http://localhost:5000/api/users
```

### **Get All Users**
```bash
curl -H "Authorization: Bearer demo-admin-token-2025" \
     http://localhost:5000/api/users
```

### **Update User Role & Permissions**
```bash
curl -X PUT \
  -H "Authorization: Bearer demo-admin-token-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "super_admin",
    "tenantAccess": ["tenant-acme-corp", "tenant-global-tech"],
    "isActive": true
  }' \
  http://localhost:5000/api/users/USER_ID
```

### **Generate User API Key**
```bash
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  http://localhost:5000/api/users/USER_ID/api-key
```

### **User Profile (Self-Service)**
```bash
# Users can view their own profile using their personal API key
curl -H "Authorization: Bearer user_1753976789_abc123def456" \
     http://localhost:5000/api/users/me
```

### **Delete User**
```bash
curl -X DELETE \
  -H "Authorization: Bearer demo-admin-token-2025" \
  http://localhost:5000/api/users/USER_ID
```

## 🔑 Personal API Keys

Each user gets a **personal API key** that allows them to:
- Access their assigned tenants
- Use the middleware based on their role permissions
- Authenticate without sharing the master admin token

**API Key Format:** `user_1753976789_abc123def456`

## 📝 User Provisioning Workflow

### **1. Create New Administrator**
```bash
# Create a new admin user
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "sarah.manager@company.com",
    "firstName": "Sarah",
    "lastName": "Manager", 
    "role": "admin",
    "tenantAccess": ["tenant-acme-corp"],
    "isActive": true
  }' \
  http://localhost:5000/api/users

# Response includes the user ID and generated API key
{
  "id": "user-uuid-here",
  "email": "sarah.manager@company.com",
  "firstName": "Sarah",
  "lastName": "Manager",
  "role": "admin",
  "isActive": true,
  "tenantAccess": ["tenant-acme-corp"],
  "apiKey": "user_1753976789_xyz789abc123",
  "createdAt": "2025-01-31T15:47:00.000Z"
}
```

### **2. Share API Key with New Admin**
```bash
# The new admin can now use their personal API key
curl -H "Authorization: Bearer user_1753976789_xyz789abc123" \
     http://localhost:5000/api/tenants
```

### **3. Regenerate API Key (If Compromised)**
```bash
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  http://localhost:5000/api/users/user-uuid-here/api-key

# Response: {"apiKey": "user_1753976800_new456def789", "message": "New API key generated successfully"}
```

## 🏢 Tenant-Specific Access Control

Users can be assigned access to specific tenants:

```json
{
  "role": "admin",
  "tenantAccess": [
    "tenant-acme-corp",
    "tenant-startup-xyz"
  ]
}
```

This means the user can only:
- View/modify configurations for assigned tenants
- Access webhook logs for their tenants
- Manage field mappings for their tenants

## 🔒 Security Best Practices

### **API Key Management**
- Each user has a unique, auto-generated API key
- API keys include timestamp and random components
- Keys can be regenerated if compromised
- Inactive users' keys are automatically disabled

### **Role Assignment**
- Start with `viewer` role and promote as needed
- Use `admin` role for tenant-specific management
- Reserve `super_admin` for system administrators
- Regularly audit user permissions

### **Access Monitoring**
- `lastLoginAt` tracks user activity
- All API calls are logged with user identification
- Inactive users can be disabled without deletion

## 📊 User Management Dashboard

### **View All Users**
```bash
# Get comprehensive user list with roles and access
curl -H "Authorization: Bearer demo-admin-token-2025" \
     http://localhost:5000/api/users

# Response includes all user details:
[
  {
    "id": "user-uuid-1",
    "email": "john.admin@company.com",
    "firstName": "John",
    "lastName": "Admin",
    "role": "admin",
    "isActive": true,
    "tenantAccess": ["tenant-acme-corp"],
    "lastLoginAt": "2025-01-31T15:30:00.000Z",
    "createdAt": "2025-01-31T10:00:00.000Z"
  }
]
```

## 🚀 Quick Start: Add Your First Admin

```bash
# 1. Create an admin user for your organization
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourcompany.com",
    "firstName": "Your",
    "lastName": "Name",
    "role": "super_admin",
    "tenantAccess": [],
    "isActive": true
  }' \
  http://localhost:5000/api/users

# 2. Note the returned API key for your new admin
# 3. Use your personal API key instead of the demo token
# 4. Change the default admin token in production!
```

Your middleware now supports **multi-user administration** with **secure, role-based access control**! 🎉