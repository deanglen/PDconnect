# Integration Manager - SugarCRM ↔ PandaDoc Middleware

## Overview

This is a full-stack web application serving as middleware for SugarCRM and PandaDoc. It enables users to create PandaDoc documents from SugarCRM records, manage field mappings, configure automated workflows based on document events, and monitor integration performance. The project aims to streamline document generation and workflow automation, offering a robust, multi-tenant solution for businesses using both platforms.

**Status: PRODUCTION READY** - End-to-end document creation successfully tested and confirmed working with live SugarCRM and PandaDoc environments (January 2025).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js with Express.js REST API
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM (Neon serverless PostgreSQL)
- **Authentication**: Comprehensive username/password authentication with secure session management using HTTP-only cookies. Hybrid system supporting both web UI authentication and API key authentication for external integrations.
- **External APIs**: SugarCRM REST API (v11+), PandaDoc API

### Multi-Tenant Design
The application supports multi-tenancy, providing isolated configurations for each tenant, including separate API credentials, custom field mappings, independent workflow configurations, and isolated data processing.

### Key Components
- **Database Schema**: Manages users, tenants, field mappings, workflows, webhook logs, and documents.
- **Service Layer**: Includes `SugarCRMService`, `PandaDocService`, `WorkflowEngine`, and `WebhookVerifier` for handling system interactions and logic.
- **Frontend Pages**: Dashboard, Tenants, Field Mappings, Workflows, Tokens, and Webhooks for managing configurations and monitoring.

### Data Flow
- **Document Creation**: Triggered from SugarCRM, the middleware retrieves record data, applies field mappings, creates the PandaDoc document, and returns a public link.
- **Webhook Processing**: PandaDoc events trigger webhooks, which are verified, matched to tenant workflows, and execute configured actions (e.g., updating SugarCRM records).

### Technical Implementations
- **Workflow System**: Supports advanced IF/THEN/ELSE logic, visual and JSON-based configuration, and multiple actions per event.
- **API Compliance**: Upgraded to SugarCRM REST API v11 with OAuth2 and custom platform authentication. PandaDoc webhooks use HMAC-SHA256 signature verification.
- **Direct Document Creation API**: A `/create-doc` endpoint allows on-demand document creation, fetching live SugarCRM data, generating dynamic tokens, and handling recipient mapping.
- **User Management**: Comprehensive role-based access control (super_admin, admin, viewer) with personal API keys, CRUD operations, tenant-specific access, and professional username/password login interface. Features secure session management, password hashing with bcrypt, and both web UI and API authentication methods.
- **Operational Excellence**: Includes a `/health` endpoint, enhanced logging with sensitive data redaction, and an automatic retry queue with exponential backoff for failed operations.
- **Performance Optimization**: Client-side optimizations for field mapping UI and JSON view/edit capabilities.
- **Tenant-Specific API Keys**: Enhanced authentication system with tenant-specific integration API keys for better SugarCRM integration. Each tenant can generate unique API keys that automatically identify the tenant without requiring explicit tenantId in requests.
- **File Attachment System**: PDF files are downloaded from PandaDoc using `data.id` and uploaded to SugarCRM Notes module with flexible parent relationships. Notes can be attached to any SugarCRM module (Opportunities, Accounts, Contacts, Cases, Leads, Tasks, Meetings, Calls, custom modules). The middleware automatically extracts record_id from metadata and sets parent_type/parent_id accordingly. Standard configuration: Field Name = "filename", File Source = "data.id", Target Module = "Notes", Parent Module = "auto-detect from metadata".
- **Dynamic Field Selection**: Intelligent workflow builder with real-time SugarCRM field discovery. API endpoint `/api/tenants/{tenantId}/sugarcrm/fields/{module}` fetches live field metadata with filtering support. Update Record actions show all available fields, while Attach File actions display only file attachment fields. Reduces configuration errors through automated field validation and dropdown selection.
- **Smart Routes System**: Complete SugarCRM Web Logic Hook automation with route template management. Supports URL pattern matching, tenant/template auto-detection, and seamless integration with existing document creation workflow. Route templates are stored in database with proper authentication requirements and foreign key relationships.
- **Production Integration Success**: Successfully tested end-to-end document creation from SugarCRM Cloud to PandaDoc with live data. API authentication, recipient configuration, token generation, and document creation all confirmed working (January 2025).

## External Dependencies

- **SugarCRM**:
    - **API**: REST API v11+
    - **Authentication**: OAuth2 with custom platform "pandadoc_integration" for token refresh and management.
    - **Modules**: Supports Opportunities, Contacts, Accounts, and other modules; dynamic field discovery.
    - **Integration**: Handles data retrieval, record updates, file attachments, and relationship management.

- **PandaDoc**:
    - **API**: API Key-based authentication (supports sandbox and production).
    - **Webhooks**: HMAC-SHA256 signature verification for security, tenant-specific secrets.
    - **Document Creation**: Template-based with dynamic token injection and recipient mapping.

- **Database**:
    - **Type**: PostgreSQL
    - **Provider**: Neon serverless PostgreSQL
    - **ORM**: Drizzle ORM for schema management and migrations.
    - **Connection**: WebSocket-based connection pooling.

- **Deployment Environment**:
    - **Containerization**: Docker
    - **Orchestration**: Kubernetes
    - **Cloud Platforms**: AWS Lambda, Google Cloud Run, Azure Container Instances, Heroku.