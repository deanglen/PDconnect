# SugarCRM ↔ PandaDoc Middleware - Multi-Cloud Deployment Guide

This middleware is designed to be deployed across different cloud providers with flexible authentication options.

## 🚀 Supported Deployment Platforms

### 1. **Replit Deployments** (Recommended for Quick Start)
```bash
# Deploy directly from Replit
# No additional configuration needed
# Built-in SSL, monitoring, and scaling
```

### 2. **AWS Lambda + RDS**
```bash
# Use AWS SAM or Serverless Framework
# Environment: AWS Lambda + Amazon RDS PostgreSQL
# Auto-scaling and pay-per-request pricing
```

### 3. **Google Cloud Run + Cloud SQL**
```bash
# Fully managed container platform
# Environment: Cloud Run + Cloud SQL PostgreSQL
# Automatic scaling to zero when idle
```

### 4. **Azure Container Instances + PostgreSQL**
```bash
# Serverless containers
# Environment: ACI + Azure Database for PostgreSQL
# Integrated with Azure Active Directory
```

### 5. **Heroku**
```bash
# Traditional PaaS deployment
# Environment: Heroku + Heroku Postgres
# Easy scaling and add-ons ecosystem
```

### 6. **Docker + Any Cloud**
```bash
# Containerized deployment
# Works with: AWS ECS, GKE, AKS, DigitalOcean, etc.
# Maximum portability and control
```

## 🔐 Authentication Configuration

### Flexible Authentication Modes

Set `AUTH_MODE` environment variable to choose authentication:

#### **Token Authentication** (Default - Recommended)
```bash
AUTH_MODE=token
ADMIN_TOKEN=your-secure-token-here
AUTH_TOKEN_HEADER=authorization  # Optional, defaults to 'authorization'
```

#### **Basic Authentication** (Web-friendly)
```bash
AUTH_MODE=basic
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

#### **No Authentication** (Development only)
```bash
AUTH_MODE=none
# WARNING: Only use for development or internal networks
```

#### **OAuth Integration** (Enterprise)
```bash
AUTH_MODE=oauth
OAUTH_PROVIDER=your-oauth-provider
# Custom OAuth integration required
```

## 📦 Environment Variables

### **Required**
```bash
DATABASE_URL=postgresql://user:pass@host:port/dbname
```

### **Authentication** (Choose one set)
```bash
# Token Auth (Recommended)
AUTH_MODE=token
ADMIN_TOKEN=your-secure-token

# OR Basic Auth
AUTH_MODE=basic
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-password

# OR No Auth (Development)
AUTH_MODE=none
```

### **Optional Performance**
```bash
NODE_ENV=production
PORT=5000
```

## 🌍 Cloud-Specific Deployment Instructions

### **AWS Lambda Deployment**

1. **Package the application:**
```bash
npm run build
zip -r middleware.zip dist/ node_modules/
```

2. **Create Lambda function:**
```bash
aws lambda create-function \
  --function-name sugarcrm-pandadoc-middleware \
  --runtime nodejs20.x \
  --handler dist/index.handler \
  --zip-file fileb://middleware.zip
```

3. **Set environment variables:**
```bash
aws lambda update-function-configuration \
  --function-name sugarcrm-pandadoc-middleware \
  --environment Variables='{
    "DATABASE_URL":"your-rds-connection-string",
    "AUTH_MODE":"token",
    "ADMIN_TOKEN":"your-secure-token"
  }'
```

### **Google Cloud Run Deployment**

1. **Build container:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

2. **Deploy to Cloud Run:**
```bash
gcloud run deploy sugarcrm-pandadoc-middleware \
  --source . \
  --platform managed \
  --region us-central1 \
  --set-env-vars="DATABASE_URL=your-cloud-sql-url,AUTH_MODE=token,ADMIN_TOKEN=your-token"
```

### **Azure Container Instances**

1. **Deploy with Azure CLI:**
```bash
az container create \
  --resource-group myResourceGroup \
  --name sugarcrm-pandadoc-middleware \
  --image your-registry/middleware:latest \
  --dns-name-label middleware-unique \
  --ports 5000 \
  --environment-variables \
    DATABASE_URL=your-postgresql-url \
    AUTH_MODE=token \
    ADMIN_TOKEN=your-secure-token
```

### **Heroku Deployment**

1. **Deploy to Heroku:**
```bash
heroku create your-middleware-app
heroku addons:create heroku-postgresql:standard-0
heroku config:set AUTH_MODE=token
heroku config:set ADMIN_TOKEN=your-secure-token
git push heroku main
```

### **Docker Deployment**

1. **Create Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

2. **Build and run:**
```bash
docker build -t sugarcrm-pandadoc-middleware .
docker run -p 5000:5000 \
  -e DATABASE_URL="your-postgresql-url" \
  -e AUTH_MODE="token" \
  -e ADMIN_TOKEN="your-secure-token" \
  sugarcrm-pandadoc-middleware
```

## 🔒 Security Best Practices

### **Production Security Checklist**

1. **Use strong authentication:**
   - Generate cryptographically secure admin tokens
   - Use environment variables, never hardcode credentials
   - Rotate tokens regularly

2. **Database security:**
   - Use SSL/TLS for database connections
   - Restrict database access to application only
   - Enable database encryption at rest

3. **Network security:**
   - Deploy behind HTTPS/TLS (cloud providers handle this)
   - Use VPC/private networks when available
   - Implement rate limiting if needed

4. **Monitoring:**
   - Enable cloud provider logging
   - Monitor `/health` endpoint for uptime
   - Set up alerts for failed webhooks

## 📊 Monitoring & Health Checks

### **Health Endpoint**
```bash
GET /health
# Returns: system status, uptime, retry queue stats
```

### **Auth Status Check**
```bash
GET /auth-status
# Returns: authentication configuration status
```

### **Cloud Provider Integration**
- **AWS**: CloudWatch logs and metrics
- **Google Cloud**: Cloud Logging and Cloud Monitoring  
- **Azure**: Azure Monitor and Application Insights
- **Heroku**: Built-in logging and metrics

## 🔧 Configuration Examples

### **High-Volume Production**
```bash
AUTH_MODE=token
ADMIN_TOKEN=prod-secure-token-2025
DATABASE_URL=postgresql://user:pass@prod-db:5432/middleware
NODE_ENV=production
```

### **Development/Testing**
```bash
AUTH_MODE=none
DATABASE_URL=postgresql://localhost:5432/middleware_dev
NODE_ENV=development
```

### **Enterprise with Basic Auth**
```bash
AUTH_MODE=basic
ADMIN_USERNAME=middleware-admin
ADMIN_PASSWORD=enterprise-secure-password-2025
DATABASE_URL=postgresql://enterprise-db/middleware
```

## 📈 Scaling Considerations

- **Stateless Design**: Middleware is fully stateless, scales horizontally
- **Database Connection Pooling**: Built-in with automatic connection management
- **Retry Queue**: Handles temporary failures gracefully
- **Rate Limiting**: Consider adding rate limiting for high-volume deployments

## 🆘 Troubleshooting

### **Common Issues**
1. **Database connection fails**: Check DATABASE_URL and network access
2. **Authentication errors**: Verify AUTH_MODE and credential configuration
3. **Webhook failures**: Check PandaDoc webhook configuration and signatures
4. **SugarCRM API errors**: Verify tenant API credentials and field mappings

### **Support**
- Check application logs in your cloud provider's logging service
- Use `/health` endpoint to verify system status
- Monitor retry queue statistics for failed operations

Your middleware is now ready for deployment on any cloud provider! 🚀