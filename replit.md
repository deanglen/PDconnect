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
- **Authentication**: OAuth2 or username/password
- **API Version**: REST API v10
- **Modules**: Supports Opportunities, Contacts, Accounts, and other modules
- **Field Discovery**: Dynamic field retrieval for mapping configuration

### PandaDoc Integration
- **Authentication**: API Key-based
- **Environment**: Supports sandbox and production environments
- **Webhooks**: Handles document lifecycle events (signed, viewed, updated)
- **Document Creation**: Template-based document generation with merge fields

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