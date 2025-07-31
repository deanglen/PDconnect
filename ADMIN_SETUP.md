# Admin Authentication Setup

Your SugarCRM ↔ PandaDoc middleware now includes admin authentication to protect sensitive endpoints.

## 🔐 Admin Access Methods

### Method 1: Token-Based Authentication (Recommended for API)

**For API calls to admin endpoints:**
```bash
# Set your admin token as environment variable (optional)
export ADMIN_TOKEN="your-secure-admin-token-here"

# Use in API calls
curl -H "Authorization: Bearer your-secure-admin-token-here" \
     https://your-app.replit.app/api/tenants
```

**Default admin token:** `demo-admin-token-2025`

### Method 2: Basic Authentication (For Web Interface)

**For web browser access to admin panel:**
- URL: `https://your-app.replit.app/admin`
- Username: `admin` (or set `ADMIN_USERNAME` env var)
- Password: `admin123` (or set `ADMIN_PASSWORD` env var)

## 🛡️ Protected Admin Endpoints

The following endpoints require admin authentication:

- `GET /api/tenants` - View all tenants
- `POST /api/tenants` - Create new tenant
- `PUT /api/tenants/:id` - Update tenant
- `DELETE /api/tenants/:id` - Delete tenant
- `GET /admin` - Admin dashboard access

## 🔧 Configuration

### Environment Variables

Set these in your Replit Secrets or deployment environment:

```bash
# Optional: Custom admin credentials
ADMIN_TOKEN="your-super-secure-token-2025"
ADMIN_USERNAME="youradmin"
ADMIN_PASSWORD="your-secure-password"
```

### Default Credentials (Change in Production!)

- **API Token:** `demo-admin-token-2025`
- **Web Username:** `admin`
- **Web Password:** `admin123`

## 🚀 Usage Examples

### Create a New Tenant
```bash
curl -X POST \
  -H "Authorization: Bearer demo-admin-token-2025" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "sugarCrmUrl": "https://mycompany.sugarcrm.com",
    "sugarCrmApiKey": "your-sugar-api-key",
    "pandaDocApiKey": "your-pandadoc-api-key"
  }' \
  https://your-app.replit.app/api/tenants
```

### Get All Tenants
```bash
curl -H "Authorization: Bearer demo-admin-token-2025" \
     https://your-app.replit.app/api/tenants
```

## 🔒 Security Best Practices

1. **Change default credentials immediately in production**
2. **Use strong, unique tokens and passwords**
3. **Set environment variables for credentials**
4. **Use HTTPS in production**
5. **Regularly rotate admin tokens**
6. **Monitor admin endpoint access logs**

## 📝 Public Endpoints (No Auth Required)

These endpoints remain public for integration purposes:

- `POST /api/webhook/pandadoc` - PandaDoc webhook receiver
- `POST /api/create-doc` - Document creation endpoint
- `GET /health` - Health check
- `GET /api/stats` - Dashboard statistics

Your middleware is now secure and ready for production deployment!