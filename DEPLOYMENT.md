# Deployment Guide - SugarCRM ↔ PandaDoc Middleware

This guide covers deployment and CI/CD setup for the SugarCRM-PandaDoc integration middleware.

## Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Environment variables properly configured
- API credentials for SugarCRM and PandaDoc

## Environment Variables

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@host:5432/database

# Application
NODE_ENV=production
PORT=5000

# Security (optional - generated per tenant if not provided)
WEBHOOK_SHARED_SECRET=your-global-webhook-secret

# Monitoring
npm_package_version=1.0.0
```

### Tenant-Specific Configuration

These are stored in the database per tenant:
- `sugarCrmUrl` - SugarCRM instance URL
- `sugarCrmUsername` - SugarCRM username
- `sugarCrmPassword` - SugarCRM password  
- `pandaDocApiKey` - PandaDoc API key
- `webhookSharedSecret` - Tenant-specific webhook secret

## Deployment Platforms

### 1. Replit Deployment

```bash
# Build the application
npm run build

# Deploy using Replit's deployment feature
# The application will automatically use the provided DATABASE_URL
```

### 2. Heroku Deployment

```bash
# Install Heroku CLI and login
heroku login

# Create new Heroku app
heroku create your-app-name

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:basic

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set npm_package_version=1.0.0

# Deploy
git push heroku main

# Run database migrations
heroku run npm run db:push
```

### 3. AWS Lambda (Serverless)

```bash
# Install serverless framework
npm install -g serverless

# Create serverless.yml configuration
cat > serverless.yml << EOF
service: sugarcrm-pandadoc-middleware

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    DATABASE_URL: \${env:DATABASE_URL}
    NODE_ENV: production

functions:
  app:
    handler: dist/server/lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
      - http:
          path: /
          method: ANY
          cors: true

plugins:
  - serverless-offline
EOF

# Deploy
serverless deploy
```

### 4. Google Cloud Run

```bash
# Create Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
EOF

# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/sugarcrm-pandadoc
gcloud run deploy --image gcr.io/PROJECT_ID/sugarcrm-pandadoc --platform managed
```

## CI/CD Pipeline Setup

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run tests
      run: npm test
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
    
    - name: Build application
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Heroku
      uses: akhileshns/heroku-deploy@v3.12.12
      with:
        heroku_api_key: \${{secrets.HEROKU_API_KEY}}
        heroku_app_name: "your-app-name"
        heroku_email: "your-email@example.com"
```

## Database Setup

### Initial Migration

```bash
# Push schema to database
npm run db:push

# Verify tables created
psql $DATABASE_URL -c "\dt"
```

### Backup Strategy

```bash
# Automated daily backups (add to cron)
pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d).sql.gz

# Retention policy (keep 30 days)
find /path/to/backups -name "*.sql.gz" -mtime +30 -delete
```

## Monitoring & Health Checks

### Health Check Endpoint

The application provides a comprehensive health check at `/health`:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-30T21:43:39.795Z",
  "version": "1.0.0",
  "uptime": 3600,
  "retryQueue": {
    "totalJobs": 0,
    "readyJobs": 0,
    "failedJobs": 0,
    "averageRetries": 0
  }
}
```

### Log Monitoring

The application includes comprehensive logging with:
- Request/response logging with sensitive data redaction
- Webhook event logging
- Failed operation tracking
- Retry queue statistics

### Uptime Monitoring

Set up external monitoring for:
- `GET /health` - Application health
- `POST /webhook` - Webhook endpoint availability
- Database connectivity

## Security Considerations

### HTTPS Configuration

Always use HTTPS in production:

```nginx
# Nginx configuration example
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/private-key.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Environment Security

- Store all secrets in environment variables or secret management systems
- Use different webhook secrets per tenant
- Regularly rotate API keys
- Enable database SSL in production

### Access Control

- Implement IP whitelisting for admin endpoints
- Use strong authentication for administrative access
- Monitor webhook endpoint for suspicious activity

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Test database connectivity
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **SugarCRM API Issues**
   ```bash
   # Test SugarCRM connectivity
   curl -X POST "https://your-sugarcrm.com/rest/v11/oauth2/token" \
     -H "Content-Type: application/json" \
     -d '{"grant_type":"password","username":"user","password":"pass"}'
   ```

3. **PandaDoc API Issues**
   ```bash
   # Test PandaDoc connectivity
   curl -X GET "https://api.pandadoc.com/public/v1/accounts/self" \
     -H "Authorization: API-Key YOUR_API_KEY"
   ```

### Log Analysis

```bash
# Filter logs by request ID
grep "req-1753911820189" application.log

# Monitor webhook processing
grep "Webhook Event" application.log | tail -100

# Check retry queue activity
grep "retry queue" application.log
```

## Performance Optimization

### Database Optimization

```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_field_mappings_tenant_module ON field_mappings(tenant_id, sugar_module);
CREATE INDEX idx_webhook_logs_tenant_status ON webhook_logs(tenant_id, status);
CREATE INDEX idx_workflows_tenant_active ON workflows(tenant_id, is_active);
```

### Application Scaling

- Use connection pooling for database connections
- Implement Redis for session storage if using multiple instances
- Monitor retry queue size and adjust worker processes accordingly
- Consider implementing rate limiting for webhook endpoints

This deployment guide provides comprehensive coverage for production deployment with proper monitoring, security, and maintenance procedures.