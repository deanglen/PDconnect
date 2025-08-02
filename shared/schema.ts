import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").default("viewer"), // "super_admin", "admin", "viewer"  
  isActive: boolean("is_active").default(true),
  tenantAccess: jsonb("tenant_access").$type<string[]>().default([]), // Array of tenant IDs user can access
  apiKey: varchar("api_key").unique(), // Personal API key for this user
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  eventId: text("event_id").unique(), // PandaDoc event ID for deduplication
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  documentId: text("document_id"),
  documentName: text("document_name"),
  payload: jsonb("payload").notNull(),
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
});

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

export const documentTemplatesRelations = relations(documentTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documentTemplates.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schemas for user management
export const insertUserSchema = createInsertSchema(users).extend({
  email: z.string().email("Invalid email address"),
  role: z.enum(["super_admin", "admin", "viewer"]).default("viewer"),
  isActive: z.boolean().default(true),
  tenantAccess: z.array(z.string()).default([]),
}).omit({ id: true, apiKey: true, lastLoginAt: true, createdAt: true, updatedAt: true });

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

// User management types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
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
