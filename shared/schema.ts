import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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
  conditions: jsonb("conditions").default([]),
  actions: jsonb("actions").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  documentId: text("document_id"),
  documentName: text("document_name"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(), // "processed", "failed", "pending"
  actionsTriggered: integer("actions_triggered").default(0),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
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

export const certificateConfigs = pgTable("certificate_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Production SSL Certificate"
  certificateType: text("certificate_type").notNull(), // "client", "server", "ca"
  certificatePem: text("certificate_pem"), // PEM encoded certificate
  issuer: text("issuer"),
  subject: text("subject"),
  serialNumber: text("serial_number"),
  fingerprint: text("fingerprint"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
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
  certificateConfigs: many(certificateConfigs),
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

export const certificateConfigsRelations = relations(certificateConfigs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [certificateConfigs.tenantId],
    references: [tenants.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

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
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCertificateConfigSchema = createInsertSchema(certificateConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
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
export type InsertCertificateConfig = z.infer<typeof insertCertificateConfigSchema>;
export type CertificateConfig = typeof certificateConfigs.$inferSelect;
