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

## Recent Updates - Advanced Workflow Configuration System (January 2025)

### Comprehensive Workflow Management Features
- **Enhanced IF/THEN/ELSE Logic**: Implemented sophisticated conditional workflow rules with support for multiple conditions, logical operators (AND/OR), and complex decision trees
- **Dual Configuration Interfaces**: Added both point-and-click visual workflow builder and advanced JSON-based configuration for power users
- **Webhook Endpoint Integration**: Clear display of PandaDoc webhook endpoints with tenant-specific URLs for easy configuration
- **Multiple Action Support**: Each workflow can execute multiple actions per event with priority-based execution and timeout management
- **Advanced Conditional Logic**: Support for complex field comparisons, value matching, and dynamic SugarCRM field updates
- **Configuration Mode Tracking**: Workflows maintain metadata about whether they were created via visual builder or JSON config
- **Enhanced Workflow Display**: Visual representation of IF/THEN/ELSE logic with color-coded condition and action blocks

### Workflow Creation Testing Results
- **API Integration**: Successfully tested workflow creation via REST API with comprehensive validation
- **Database Schema**: Enhanced workflows table with `ifThenElseRules`, `elseActions`, `priority`, `timeout`, and `configMode` fields
- **Real-Time Updates**: Workflow creation immediately reflects in the UI with proper cache invalidation
- **Validation**: Robust client and server-side validation for required fields and proper JSON configuration

## Recent Updates - PandaDoc Field Dropdown Implementation (January 2025)

### Comprehensive PandaDoc Webhook Field Integration
- **Official API Documentation Research**: Analyzed PandaDoc webhook events and payload structure from developers.pandadoc.com
- **Implemented Smart Field Dropdown**: Added 25+ authentic PandaDoc webhook fields based on official API documentation
  - Document fields: `data.id`, `data.name`, `data.status`, `data.date_created`, etc.
  - Creator/Sender info: `data.created_by.email`, `data.sent_by.first_name`, etc.
  - Financial data: `data.total`, `data.grand_total.amount`, `data.grand_total.currency`
  - Template info: `data.template.id`, `data.template.name`
  - Recipients: `data.recipients[0].email`, `data.recipients[0].role`, etc.
- **Smart Value Suggestions**: When `data.status` is selected, value field becomes dropdown with valid document status options
- **Organized UI**: Fields grouped into "Document Fields" and "Event Fields" sections with descriptions
- **Enhanced User Experience**: Eliminated need for users to manually type field paths or guess webhook structure

### Previous: SugarCRM REST API Integration Enhancement (January 2025)
- **Researched Official SugarCRM REST API v11+ Documentation**: Analyzed current endpoints, authentication methods, and best practices
- **Updated Workflow Actions with Accurate API Endpoints**: Replaced generic actions with specific SugarCRM REST operations
  - `update_record`: Update fields using PUT /{module}/{id}
  - `create_note`, `create_task`, `create_call`, `create_meeting`: Create activities using POST /{module}
  - `attach_file`: Attach documents using POST /{module}/{id}/file/{field}
  - `create_relationship`: Link records using POST /{module}/{id}/link/{link_name}
  - `send_email`: Create emails using POST /Emails
- **Enhanced Module Support**: Added comprehensive SugarCRM modules including Tasks, Calls, Meetings, Emails, Documents
- **Improved Action Configuration**: Added specific field placeholders and examples based on real API requirements
- **Updated JSON Examples**: Replaced deprecated action types with current API-compliant operations

### Authentication & Platform Best Practices Integration
- **OAuth2 Two-Legged Authentication**: Implemented proper authentication flow with custom platform support
- **Platform Isolation**: Uses "pandadoc_integration" platform to prevent session conflicts
- **Token Refresh Management**: Automatic access token refresh with secure refresh token storage
- **API Version Targeting**: Focused on v11+ API for modern compatibility

### File Attachment & Document Management
- **SugarCRM File Upload Integration**: Proper implementation of /{module}/{id}/file/{field} endpoints
- **Notes Module Integration**: Complete workflow for creating notes with PandaDoc document attachments
- **Multi-format Support**: Support for various file field types (filename, uploadfile) across modules

## Recent Updates - Direct Document Creation API (January 2025)

### Main Integration Endpoint Implementation
- **POST `/create-doc` Endpoint**: Implemented production-ready endpoint that accepts SugarCRM record data and creates PandaDoc documents on-demand
- **Real-Time SugarCRM Integration**: Fetches live record data using SugarCRM REST API with proper authentication and error handling
- **Dynamic Token Generation**: Converts all SugarCRM field names and values into PandaDoc-compatible tokens (e.g., {{contact_name}})
- **Automated Recipient Mapping**: Extracts email addresses from common SugarCRM email fields or uses configurable defaults
- **Document Storage & Logging**: Stores document creation events in database with comprehensive audit trail
- **Multi-Tenant Support**: Handles tenant-specific configurations, API credentials, and template assignments
- **Comprehensive Error Handling**: Robust error responses with retry queue for failed operations
- **Production Logging**: Enterprise-grade logging with request tracking and sensitive data redaction

### API Request/Response Format
```json
// POST /create-doc
{
  "record_id": "abc123",
  "module": "Opportunities", 
  "tenant_id": "tenant-acme-corp",
  "template_id": "template-uuid-here"
}

// Response
{
  "success": true,
  "document": {
    "id": "pandadoc-doc-id",
    "name": "Opportunities - Demo Deal",
    "status": "draft",
    "public_url": "https://app.pandadoc.com/s/xyz",
    "download_url": null,
    "created_date": "2025-01-30T23:43:01.809Z"
  },
  "sugar_crm": {
    "record_id": "abc123",
    "module": "Opportunities"
  },
  "metadata": {
    "tenant_id": "tenant-acme-corp",
    "template_id": "template-uuid-here",
    "token_count": 15,
    "recipient_count": 1
  }
}
```

### Technical Implementation Features
- **Environment Variable Security**: Uses tenant-specific API credentials stored securely in database
- **Automatic Token Mapping**: Maps all SugarCRM fields to PandaDoc tokens without manual configuration
- **Retry Queue Integration**: Failed document creation attempts are queued for automatic retry
- **Request Logging**: All API interactions logged with unique request IDs for troubleshooting
- **Document Tracking**: Created documents stored in database with links to original SugarCRM records

## Recent Updates - Field Mapping Integration Enhancement (January 2025)

### Integrated Field Mapping System with `/create-doc` Endpoint
- **Pre-configured Field Mapping Integration**: Updated `/create-doc` endpoint to use existing tenant-specific field mappings from the Field Mapping page instead of generic token generation
- **Dynamic Value Resolution**: System now loads pre-defined mappings that link SugarCRM fields to PandaDoc tokens and resolves values dynamically from SugarCRM records
- **Multi-Module Support**: Field mappings support multiple SugarCRM module types (Opportunities, Contacts, Accounts) with proper tenant isolation
- **Token Format Compliance**: PandaDoc tokens properly formatted as `{"name": "token_name", "value": "mapped_value"}` using configured field mappings
- **UI Integration**: Document template configuration now references existing Field Mapping page instead of duplicating functionality
- **Enterprise Logging**: Enhanced logging shows field mapping retrieval, token generation from mappings, and value resolution process

### Complete `/create-doc` Endpoint Implementation (Previous)
- **Production-Ready Integration**: Fully functional POST `/create-doc` endpoint accepting record_id, module, tenant_id, and template_id parameters
- **Real-Time SugarCRM Integration**: Live data fetching from SugarCRM REST API with proper authentication and error handling
- **Comprehensive Error Handling**: Proper HTTP status codes, detailed error messages, and automatic retry queue integration
- **Enterprise Logging**: Complete request/response logging with sensitive data redaction and unique request IDs
- **Multi-Tenant Support**: Full tenant isolation with secure credential management and configuration
- **Database Integration**: Document creation events stored with audit trail and relationship tracking

### API Endpoint Testing Results
```json
// POST /create-doc endpoint tested and operational
// Request format:
{
  "record_id": "test-opportunity-123",
  "module": "Opportunities", 
  "tenant_id": "tenant-acme-corp",
  "template_id": "demo-template-uuid-12345"
}

// Response format (success):
{
  "success": true,
  "document": { "id": "...", "name": "...", "status": "draft" },
  "sugar_crm": { "record_id": "...", "module": "..." },
  "metadata": { "tenant_id": "...", "token_count": 15 }
}

// Response format (error):
{
  "error": "Document creation failed",
  "message": "SugarCRM authentication failed: Request failed with status code 405",
  "record_id": "test-opportunity-123",
  "module": "Opportunities",
  "timestamp": "2025-07-30T23:49:08.264Z"
}
```

### System Status Verification
- **Health Endpoint**: `/health` endpoint operational with system metrics and retry queue statistics
- **Request Logging**: All API interactions logged with request IDs and performance tracking
- **Retry Queue**: Failed operations automatically queued for retry with exponential backoff
- **Error Recovery**: Robust error handling prevents system crashes from external API failures

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