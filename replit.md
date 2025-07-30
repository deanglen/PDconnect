# Integration Manager - SugarCRM ↔ PandaDoc Middleware

## Overview

This is a full-stack web application that serves as a middleware integration between SugarCRM and PandaDoc. The application allows users to create PandaDoc documents from SugarCRM records, manage field mappings between the two systems, configure automated workflows triggered by document events, and monitor integration performance through a comprehensive dashboard.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state management
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with hot module replacement

### Backend Architecture
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Authentication**: Custom session-based authentication
- **External APIs**: SugarCRM REST API, PandaDoc API

### Multi-Tenant Design
The application supports multiple tenant configurations, where each tenant has:
- Separate SugarCRM and PandaDoc credentials
- Custom field mappings between systems
- Independent workflow configurations
- Isolated data and webhook processing

## Key Components

### Database Schema
- **Users**: Basic user authentication
- **Tenants**: Multi-tenant configuration with API credentials
- **Field Mappings**: SugarCRM field to PandaDoc token mappings
- **Workflows**: Configurable automation rules for webhook events
- **Webhook Logs**: Audit trail of all webhook events and processing results
- **Documents**: Tracking of created PandaDoc documents

### Service Layer
- **SugarCRMService**: Handles authentication and data retrieval from SugarCRM
- **PandaDocService**: Manages document creation and API interactions with PandaDoc
- **WorkflowEngine**: Processes webhook events and executes configured actions
- **WebhookVerifier**: Validates incoming webhook signatures for security

### Frontend Pages
- **Dashboard**: Performance metrics and system overview
- **Tenants**: Multi-tenant configuration management
- **Field Mappings**: Configure SugarCRM to PandaDoc field mappings
- **Workflows**: Design automation rules for document lifecycle events
- **Tokens**: Explore available merge field tokens and preview values
- **Webhooks**: Monitor webhook logs and processing status

## Data Flow

### Document Creation Flow
1. SugarCRM user clicks "Send to PandaDoc" button with record ID
2. Middleware retrieves record data from SugarCRM API
3. System applies configured field mappings to generate PandaDoc tokens
4. Document is created in PandaDoc using predefined template
5. Public document link is returned to SugarCRM user

### Webhook Processing Flow
1. PandaDoc sends webhook to middleware endpoint on document events
2. Webhook signature is verified for security
3. Tenant is identified from webhook payload
4. Matching workflows are retrieved and evaluated
5. Configured actions are executed (update SugarCRM, attach documents, etc.)
6. Processing results are logged for audit and monitoring

## External Dependencies

### SugarCRM Integration
- **Authentication**: OAuth2 with custom platform "pandadoc_integration"
- **API Version**: REST API v11 (upgraded for better compatibility)
- **Token Management**: Automatic access token refresh with refresh token storage
- **Error Handling**: Robust retry logic for expired tokens and API errors
- **Modules**: Supports Opportunities, Contacts, Accounts, and other modules
- **Field Discovery**: Dynamic field retrieval for mapping configuration

### PandaDoc Integration
- **Authentication**: API Key-based (supports both sandbox and production keys)
- **Environment**: Uses same base URL, environment determined by API key
- **Webhooks**: HMAC-SHA256 signature verification for security
- **Document Creation**: Template-based with tenant metadata injection
- **Error Handling**: Comprehensive validation and error reporting
- **Rate Limits**: Sandbox (10 req/min), Production (contact sales for high volume)

### Database
- **Provider**: Neon serverless PostgreSQL
- **Connection**: WebSocket-based connection pooling
- **Migrations**: Drizzle Kit for schema management
- **Environment**: Requires DATABASE_URL environment variable

## Deployment Strategy

### Development
- **Frontend**: Vite dev server with HMR
- **Backend**: tsx for TypeScript execution with auto-reload
- **Database**: Drizzle push for schema synchronization
- **Environment**: Local development with environment variables

### Production
- **Build Process**: 
  - Frontend: Vite build to static assets
  - Backend: esbuild bundle for Node.js deployment
- **Static Serving**: Express serves built frontend assets
- **Database**: Production PostgreSQL instance
- **Process Management**: Single Node.js process serving both API and frontend

### Configuration Requirements
- `DATABASE_URL`: PostgreSQL connection string
- Tenant-specific API credentials stored in database
- PandaDoc webhook secret for signature verification
- SugarCRM API credentials per tenant

The application is designed to be deployed as a single service that handles both the web interface and API endpoints, with the database as the only external dependency requiring configuration.

## Recent Updates - API Compliance & Best Practices

### SugarCRM API Improvements (January 2025)
- **Upgraded to REST API v11** for better stability and feature support
- **Custom Platform Authentication**: Uses "pandadoc_integration" platform to prevent session conflicts
- **Token Refresh Management**: Automatic access token refresh with secure refresh token storage
- **Enhanced Error Handling**: Retry logic for 401 errors with automatic token refresh
- **Improved Field Discovery**: Better parsing of field metadata and labels

### PandaDoc API Improvements (January 2025)  
- **Enhanced Webhook Security**: HMAC-SHA256 signature verification with timing-safe comparison
- **Payload Validation**: Comprehensive webhook payload structure validation
- **Tenant Identification**: Automatic tenant metadata injection in document creation
- **Better Error Handling**: Detailed error messages and validation for document creation
- **Production Ready**: Proper rate limiting awareness and error recovery patterns

### Security Enhancements
- **Webhook Signature Verification**: Implemented PandaDoc's HMAC-SHA256 verification with tenant-specific secrets
- **Timing Attack Prevention**: Using crypto.timingSafeEqual for signature comparison
- **Tenant-Specific Webhook Secrets**: Each tenant can configure their own webhook shared secret for enhanced security
- **Environment Variable Security**: Proper handling of webhook secrets and API keys
- **Tenant Isolation**: Enhanced tenant identification from webhook payloads

## Recent Updates - Production-Ready Enhancements (January 2025)

### Operational Excellence Features
- **Health Check Endpoint**: Added comprehensive `/health` endpoint with system status, uptime, and retry queue statistics
- **Enhanced Logging System**: Implemented enterprise-grade logging with sensitive data redaction
  - Automatic redaction of passwords, API keys, tokens, and secrets
  - Request/response logging with unique request IDs
  - Webhook event logging with processing results
  - Failed operation tracking for debugging

### Retry Queue Implementation
- **Failed Operation Recovery**: Automatic retry queue for failed webhook processing, SugarCRM updates, and PandaDoc document creation
- **Exponential Backoff**: Smart retry delays with jitter to prevent thundering herd problems
- **Retry Statistics**: Real-time monitoring of retry queue performance
- **Graceful Degradation**: System continues operation even when external APIs temporarily fail

### Security & Monitoring Enhancements
- **Request/Response Logging**: All API interactions logged with sensitive data automatically redacted
- **Webhook Processing Resilience**: Failed webhook events queued for retry instead of lost
- **Performance Monitoring**: Request duration tracking and system uptime monitoring
- **Error Recovery**: Comprehensive error handling with automatic retry mechanisms

### Deployment & CI/CD Documentation
- **Production Deployment Guide**: Complete deployment documentation for multiple platforms (Heroku, AWS Lambda, Google Cloud Run)
- **CI/CD Pipeline Templates**: GitHub Actions workflow for automated testing and deployment
- **Security Best Practices**: HTTPS configuration, environment variable management, and access control guidelines
- **Monitoring Setup**: Health check configuration and log analysis procedures

### Database Schema Enhancement (Previous)
- **Added webhookSharedSecret field** to tenants table for storing PandaDoc webhook shared secrets
- **Optional Configuration**: Tenants can optionally configure webhook secrets for enhanced security
- **Secure Storage**: Webhook secrets are stored securely in the database per tenant

### Enhanced Webhook Processing (Previous)
- **Tenant-Specific Verification**: Webhook signatures are now verified using tenant-specific shared secrets
- **Graceful Fallback**: System handles tenants without webhook secrets configured
- **Improved Security Logging**: Enhanced logging for webhook signature verification success/failure

### User Interface Improvements (Previous)
- **Webhook Secret Management**: Added webhook shared secret configuration to tenant creation and editing forms
- **Visual Indicators**: Tenant cards now show whether webhook secrets are configured
- **Security Best Practices**: Forms include helpful text explaining webhook secret usage
- **Edit Functionality**: Complete tenant editing interface with webhook secret management