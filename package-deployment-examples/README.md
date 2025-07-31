# Deployment Examples

This directory contains ready-to-use deployment configurations for various cloud providers and container orchestration platforms.

## 🚀 Quick Start Deployments

### Docker Compose (Local/Production)
```bash
# Copy and customize docker-compose.yml
docker-compose up -d
```

### Kubernetes
```bash
# Apply the Kubernetes manifests
kubectl apply -f kubernetes.yml
```

### AWS Lambda
```bash
# Deploy using AWS SAM
sam deploy --template-file aws-lambda.yml
```

### Google Cloud Run
```bash
# Deploy to Cloud Run
gcloud run services replace google-cloud-run.yml
```

### Azure Container Instances
```bash
# Deploy to Azure
az container create --file azure-container.yml
```

## 🔐 Authentication Configuration

Each deployment example supports different authentication modes:

- **TOKEN**: Bearer token authentication (recommended)
- **BASIC**: Username/password authentication  
- **NONE**: No authentication (development only)
- **OAUTH**: OAuth integration (custom implementation)

## 📝 Customization

1. **Replace placeholders** in deployment files:
   - `your-registry/sugarcrm-pandadoc-middleware:latest`
   - `your-secure-production-token-2025`
   - Database connection strings

2. **Set environment variables** for your deployment:
   - `DATABASE_URL`: PostgreSQL connection string
   - `AUTH_MODE`: Authentication mode (token/basic/none)
   - `ADMIN_TOKEN`: Admin authentication token

3. **Configure secrets** in your cloud provider:
   - Database credentials
   - Admin tokens
   - API keys

## 🔒 Security Best Practices

- Always use HTTPS in production
- Store secrets in your cloud provider's secret management
- Use strong, unique admin tokens
- Enable database SSL/TLS
- Set up monitoring and alerts

## 📊 Monitoring

All deployments include health checks at `/health` endpoint for:
- Application uptime monitoring
- Load balancer health checks
- Auto-scaling decisions
- Deployment verification