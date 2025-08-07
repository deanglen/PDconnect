# Integration Manager - SugarCRM ↔ PandaDoc Middleware

## Overview

This is a full-stack web application serving as middleware for SugarCRM and PandaDoc. It enables users to create PandaDoc documents from SugarCRM records, manage field mappings, configure automated workflows based on document events, and monitor integration performance. The project aims to streamline document generation and workflow automation, offering a robust, multi-tenant solution for businesses using both platforms.

**Status: PRODUCTION READY** - End-to-end document creation AND webhook automation successfully tested and confirmed working with live SugarCRM and PandaDoc environments (August 2025).

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
- **SugarCRM Update Capability Confirmed**: Direct SugarCRM record updates working with live authentication. Successfully updated opportunity d5914f20-4369-11ee-b000-02d60046d9de via SugarCRMService. OAuth2 authentication, field updates, and full record retrieval all operational (August 2025).
- **Webhook Automation System Operational**: Complete end-to-end webhook processing pipeline confirmed working. Webhooks are successfully received, persisted, and trigger automated SugarCRM workflows. "Update Field in Sugar" workflow tested with live document_updated events, achieving 1.964s processing time with successful SugarCRM record updates (August 2025).
- **Conditional Document Generation**: Complete conditional logic system for controlling when documents are generated. Supports field-based conditions (equals, greater than, contains, etc.), AND/OR logic, custom JavaScript evaluation, duplicate document detection, and condition preview. UI includes dedicated "Conditions" tab in Document Templates with visual condition builder and advanced scripting capabilities.
- **Bidirectional Field Synchronization Complete**: Full SugarCRM ↔ PandaDoc field mapping implemented and tested. Document creation successfully pushes SugarCRM field values (like description) into PandaDoc template variables [description]. Merge field write back from PandaDoc to SugarCRM operational via sync_fields action type. Both directions confirmed working with live data (August 2025).
- **PandaDoc Native Format Support**: Enhanced TokenMappingService to accept PandaDoc's native [field] syntax directly, eliminating user confusion. Users can now copy merge fields directly from PandaDoc templates without format conversion. Supports both [field] and {{field}} formats for backward compatibility. UI updated with helpful examples and guidance for seamless user experience (August 2025).
- **Bidirectional Field Sync Issue Resolved**: Fixed critical webhook processing bug preventing PandaDoc-to-SugarCRM field updates. Implemented proper sync_fields action type in workflow engine, enhanced webhook processor to extract field values directly from webhook payload instead of making API calls, and confirmed end-to-end field synchronization working with live testing. System now successfully processes signed document field values and updates SugarCRM records automatically (August 2025).
- **Webhook Duplicate Detection Bug FIXED**: Resolved critical issue where document completion webhooks were incorrectly marked as duplicates, preventing file attachment and field sync workflows. Fixed by updating duplicate detection to use composite key (event_id + event_type) instead of just event_id, allowing same document to trigger multiple event types (state_changed, completed, signed). Database schema updated with proper unique constraint, application logic enhanced with getWebhookLogByEventIdAndType method. End-to-end webhook automation now fully operational with confirmed PDF upload and field synchronization (August 2025).
- **Enhanced Recipient Resolution System**: Implemented comprehensive dynamic recipient resolution supporting both static email addresses and dynamic SugarCRM field references. TokenMappingService.resolveRecipients method handles complex relationship traversal (e.g., "opportunity>>Primary Contact>>email") with automatic fallback to static configuration. UI enhanced with intuitive recipient configuration supporting PandaDoc's native format (email, first_name, last_name, role, signing_order). System automatically detects static vs dynamic references, resolves related records through SugarCRM API, and provides detailed logging for troubleshooting. Maintains backward compatibility while enabling flexible recipient automation (August 2025).
- **File Attachment Bug FIXED**: Resolved critical SugarCRM file attachment issue where middleware reported successful PDF uploads but files weren't actually attached to Notes records. Root cause: previous implementation used incorrect API format (single POST with base64 content) instead of SugarCRM's required multi-step process. Fixed by implementing proper 3-step approach: 1) Create Note record, 2) Upload file using multipart/form-data to `/Notes/{id}/file/filename` endpoint, 3) Verify attachment. Enhanced error logging and response validation. Previous successful webhook responses showed "file_size": 0 confirming silent upload failures. New implementation ensures actual file content reaches SugarCRM (August 2025).
- **Dual Processing Path Issue Resolved**: Fixed inconsistent API payload tracking between enhanced workflow engine and WebhookProcessor service. Both processing paths now capture complete request/response data including SugarCRM API calls, PandaDoc downloads, execution times, and error details. Historical webhooks showing "details not available" were processed before this enhancement - expected behavior. All future webhook processing provides comprehensive API visibility for debugging and monitoring (August 2025).

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