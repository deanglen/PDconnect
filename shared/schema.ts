import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").unique().notNull(), // Username for login
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash").notNull(), // Bcrypt hashed password
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").default("viewer"), // "super_admin", "admin", "viewer"  
  isActive: boolean("is_active").default(true),
  tenantAccess: jsonb("tenant_access").$type<string[]>().default([]), // Array of tenant IDs user can access
  apiKey: varchar("api_key").unique(), // Personal API key for this user (optional, for API access)
  lastLoginAt: timestamp("last_login_at"),
  passwordResetToken: varchar("password_reset_token"), // For password reset functionality
  passwordResetExpires: timestamp("password_reset_expires"), // Reset token expiration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: varchar("session_token").unique().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sugarCrmUrl: text("sugar_crm_url").notNull(),
  sugarCrmUsername: text("sugar_crm_username"),
  sugarCrmPassword: text("sugar_crm_password"),
  sugarCrmApiKey: text("sugar_crm_api_key"),
  pandaDocApiKey: text("panda_doc_api_key").notNull(),
  pandaDocSandbox: boolean("panda_doc_sandbox").default(false),
  webhookSharedSecret: text("webhook_shared_secret"),
  integrationApiKey: text("integration_api_key").unique(), // Tenant-specific API key for SugarCRM integration
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fieldMappings = pgTable("field_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  sugarModule: text("sugar_module").notNull(), // e.g., "Opportunities", "Contacts"
  sugarField: text("sugar_field").notNull(),
  sugarFieldLabel: text("sugar_field_label"),
  sugarFieldType: text("sugar_field_type"),
  pandaDocToken: text("panda_doc_token").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  triggerEvent: text("trigger_event").notNull(), // e.g., "document.signed"
  // Enhanced workflow logic with IF/THEN/ELSE support
  conditions: jsonb("conditions").default([]), // Array of condition groups
  ifThenElseRules: jsonb("if_then_else_rules").default({}), // Complex conditional logic
  actions: jsonb("actions").notNull(), // Multiple actions per workflow
  elseActions: jsonb("else_actions").default([]), // Actions for ELSE case
  priority: integer("priority").default(100), // Execution priority
  timeout: integer("timeout").default(30), // Timeout in seconds
  isActive: boolean("is_active").default(true),
  configMode: text("config_mode").default("point_click"), // "point_click" or "json"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(), // PandaDoc event ID for deduplication
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  documentId: text("document_id"),
  documentName: text("document_name"),
  payload: jsonb("payload").notNull(),
  response: jsonb("response"), // Store the middleware response for each webhook
  status: text("status").notNull().default("pending"), // "pending", "processing", "success", "failed", "permanently_failed"
  actionsTriggered: integer("actions_triggered").default(0),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Composite unique constraint to allow same event_id with different event_type
  uniqueEventIdType: unique().on(table.eventId, table.eventType),
}));

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  pandaDocId: text("panda_doc_id").notNull().unique(),
  sugarRecordId: text("sugar_record_id"),
  sugarModule: text("sugar_module"),
  name: text("name").notNull(),
  status: text("status").notNull(),
  publicUrl: text("public_url"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documentTemplates = pgTable("document_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  pandaDocTemplateId: text("panda_doc_template_id").notNull(),
  sugarModule: text("sugar_module").notNull(), // Which SugarCRM module this template is for
  isDefault: boolean("is_default").default(false),
  // Document creation configuration
  folderUuid: text("folder_uuid"), // Optional PandaDoc folder
  tags: jsonb("tags").default([]), // Array of tags to apply
  detectTitleVariables: boolean("detect_title_variables").default(true),
  // Recipients configuration - can be overridden by request
  defaultRecipients: jsonb("default_recipients").default([]),
  // Token mappings - map SugarCRM fields to PandaDoc tokens
  tokenMappings: jsonb("token_mappings").default([]),
  // Field mappings - pre-fill form fields
  fieldMappings: jsonb("field_mappings").default([]),
  // Conditional logic for when to generate documents
  generationConditions: jsonb("generation_conditions").default([]), // Array of conditions that must be met
  requireAllConditions: boolean("require_all_conditions").default(true), // AND vs OR logic
  // Advanced conditions
  customConditionsScript: text("custom_conditions_script"), // Optional JavaScript for complex conditions
  skipIfDocumentExists: boolean("skip_if_document_exists").default(true), // Prevent duplicate generation
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Route Template Records - Maps incoming SugarCRM webhook routes to templates
export const routeTemplateRecords = pgTable("route_template_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  routePath: text("route_path").notNull(), // e.g., "/generate-opportunity-contract"
  sugarModule: text("sugar_module").notNull(), // e.g., "Opportunities"
  templateId: varchar("template_id").notNull().references(() => documentTemplates.id, { onDelete: "cascade" }),
  // Matching criteria for incoming requests
  matchCriteria: jsonb("match_criteria").default({}), // Additional field matching (optional)
  // Webhook configuration
  requiresAuth: boolean("requires_auth").default(false), // Whether this route requires authentication
  allowedMethods: jsonb("allowed_methods").default(["POST"]), // Array of allowed HTTP methods
  // Processing options
  asyncProcessing: boolean("async_processing").default(false), // Process in background
  responseFormat: text("response_format").default("json"), // "json" or "redirect"
  successRedirectUrl: text("success_redirect_url"), // URL to redirect on success (if responseFormat is "redirect")
  errorRedirectUrl: text("error_redirect_url"), // URL to redirect on error
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const tenantsRelations = relations(tenants, ({ many }) => ({
  fieldMappings: many(fieldMappings),
  workflows: many(workflows),
  webhookLogs: many(webhookLogs),
  documents: many(documents),
  documentTemplates: many(documentTemplates),
  routeTemplateRecords: many(routeTemplateRecords),
}));

export const fieldMappingsRelations = relations(fieldMappings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [fieldMappings.tenantId],
    references: [tenants.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workflows.tenantId],
    references: [tenants.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
}));

export const documentTemplatesRelations = relations(documentTemplates, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documentTemplates.tenantId],
    references: [tenants.id],
  }),
  routeTemplateRecords: many(routeTemplateRecords),
}));

export const routeTemplateRecordsRelations = relations(routeTemplateRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [routeTemplateRecords.tenantId],
    references: [tenants.id],
  }),
  template: one(documentTemplates, {
    fields: [routeTemplateRecords.templateId],
    references: [documentTemplates.id],
  }),
}));

// Insert schemas for user management
export const insertUserSchema = createInsertSchema(users).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["super_admin", "admin", "viewer"]).default("viewer"),
  isActive: z.boolean().default(true),
  tenantAccess: z.array(z.string()).default([]),
}).omit({ id: true, passwordHash: true, apiKey: true, lastLoginAt: true, passwordResetToken: true, passwordResetExpires: true, createdAt: true, updatedAt: true });

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateUserSchema = insertUserSchema.partial();

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFieldMappingSchema = createInsertSchema(fieldMappings).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  receivedAt: true,
}).extend({
  status: z.enum(["pending", "processing", "success", "failed", "permanently_failed"]).default("pending"),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Authentication types
export type LoginRequest = z.infer<typeof loginSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

// User management types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertFieldMapping = z.infer<typeof insertFieldMappingSchema>;
export type FieldMapping = typeof fieldMappings.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;
export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplates.$inferSelect;

// Route Template Record schemas and types
export const insertRouteTemplateRecordSchema = createInsertSchema(routeTemplateRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRouteTemplateRecord = z.infer<typeof insertRouteTemplateRecordSchema>;
export type RouteTemplateRecord = typeof routeTemplateRecords.$inferSelect;
