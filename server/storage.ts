import { 
  users, tenants, fieldMappings, workflows, webhookLogs, documents, documentTemplates,
  type User, type UpsertUser, type InsertUser, type Tenant, type InsertTenant,
  type FieldMapping, type InsertFieldMapping, type Workflow, type InsertWorkflow,
  type WebhookLog, type InsertWebhookLog, type Document, type InsertDocument,
  type DocumentTemplate, type InsertDocumentTemplate
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getUserCount(): Promise<number>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserRole(userId: string, role: string, tenantAccess?: string[]): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Tenant methods
  getTenants(): Promise<Tenant[]>;
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;

  // Field mapping methods
  getFieldMappings(tenantId: string, module?: string): Promise<FieldMapping[]>;
  createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping>;
  updateFieldMapping(id: string, mapping: Partial<InsertFieldMapping>): Promise<FieldMapping>;
  deleteFieldMapping(id: string): Promise<void>;

  // Workflow methods
  getWorkflows(tenantId: string): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, workflow: Partial<InsertWorkflow>): Promise<Workflow>;
  deleteWorkflow(id: string): Promise<void>;
  getWorkflowsByEvent(tenantId: string, event: string): Promise<Workflow[]>;

  // Webhook log methods
  getWebhookLogs(tenantId?: string): Promise<WebhookLog[]>;
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  updateWebhookLog(id: string, log: Partial<InsertWebhookLog>): Promise<WebhookLog>;

  // Document methods
  getDocuments(tenantId: string): Promise<Document[]>;
  getDocument(pandaDocId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document>;

  // Document template methods
  getDocumentTemplates(tenantId: string, module?: string): Promise<DocumentTemplate[]>;
  getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined>;
  createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate>;
  updateDocumentTemplate(id: string, template: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate>;
  deleteDocumentTemplate(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql`count(*)` }).from(users);
    return Number(result[0].count);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserRole(userId: string, role: string, tenantAccess?: string[]): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        role, 
        tenantAccess: tenantAccess || [],
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async getTenants(): Promise<Tenant[]> {
    return await db.select().from(tenants).orderBy(desc(tenants.createdAt));
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant> {
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...tenant, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  async getFieldMappings(tenantId: string, module?: string): Promise<FieldMapping[]> {
    const conditions = [eq(fieldMappings.tenantId, tenantId)];
    if (module) {
      // Make module comparison case-insensitive by capitalizing first letter
      const normalizedModule = module.charAt(0).toUpperCase() + module.slice(1);
      conditions.push(eq(fieldMappings.sugarModule, normalizedModule));
    }
    return await db.select().from(fieldMappings).where(and(...conditions));
  }

  async createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping> {
    const [newMapping] = await db.insert(fieldMappings).values(mapping).returning();
    return newMapping;
  }

  async updateFieldMapping(id: string, mapping: Partial<InsertFieldMapping>): Promise<FieldMapping> {
    const [updatedMapping] = await db
      .update(fieldMappings)
      .set(mapping)
      .where(eq(fieldMappings.id, id))
      .returning();
    return updatedMapping;
  }

  async deleteFieldMapping(id: string): Promise<void> {
    await db.delete(fieldMappings).where(eq(fieldMappings.id, id));
  }

  async getWorkflows(tenantId: string): Promise<Workflow[]> {
    return await db.select().from(workflows)
      .where(eq(workflows.tenantId, tenantId))
      .orderBy(desc(workflows.createdAt));
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow || undefined;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const [newWorkflow] = await db.insert(workflows).values(workflow).returning();
    return newWorkflow;
  }

  async updateWorkflow(id: string, workflow: Partial<InsertWorkflow>): Promise<Workflow> {
    const [updatedWorkflow] = await db
      .update(workflows)
      .set({ ...workflow, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updatedWorkflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  async getWorkflowsByEvent(tenantId: string, event: string): Promise<Workflow[]> {
    return await db.select().from(workflows)
      .where(and(
        eq(workflows.tenantId, tenantId),
        eq(workflows.triggerEvent, event),
        eq(workflows.isActive, true)
      ));
  }

  async getWebhookLogs(tenantId?: string): Promise<WebhookLog[]> {
    const query = db.select().from(webhookLogs);
    if (tenantId) {
      return await query.where(eq(webhookLogs.tenantId, tenantId)).orderBy(desc(webhookLogs.createdAt));
    }
    return await query.orderBy(desc(webhookLogs.createdAt));
  }

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const [newLog] = await db.insert(webhookLogs).values(log).returning();
    return newLog;
  }

  async updateWebhookLog(id: string, log: Partial<InsertWebhookLog>): Promise<WebhookLog> {
    const [updatedLog] = await db
      .update(webhookLogs)
      .set(log)
      .where(eq(webhookLogs.id, id))
      .returning();
    return updatedLog;
  }

  async getDocuments(tenantId: string): Promise<Document[]> {
    return await db.select().from(documents)
      .where(eq(documents.tenantId, tenantId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocument(pandaDocId: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.pandaDocId, pandaDocId));
    return document || undefined;
  }

  async getDocumentByPandaDocId(pandaDocId: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.pandaDocId, pandaDocId));
    return document || undefined;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  // Document template methods
  async getDocumentTemplates(tenantId: string, module?: string): Promise<DocumentTemplate[]> {
    const conditions = [eq(documentTemplates.tenantId, tenantId)];
    
    if (module) {
      // Make module comparison case-insensitive by capitalizing first letter
      const normalizedModule = module.charAt(0).toUpperCase() + module.slice(1);
      conditions.push(eq(documentTemplates.sugarModule, normalizedModule));
    }
    
    return await db.select()
      .from(documentTemplates)
      .where(and(...conditions))
      .orderBy(desc(documentTemplates.createdAt));
  }

  async getDocumentTemplate(id: string): Promise<DocumentTemplate | undefined> {
    const [template] = await db.select().from(documentTemplates).where(eq(documentTemplates.id, id));
    return template || undefined;
  }

  async createDocumentTemplate(template: InsertDocumentTemplate): Promise<DocumentTemplate> {
    const [newTemplate] = await db.insert(documentTemplates).values(template).returning();
    return newTemplate;
  }

  async updateDocumentTemplate(id: string, template: Partial<InsertDocumentTemplate>): Promise<DocumentTemplate> {
    const [updated] = await db
      .update(documentTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(eq(documentTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteDocumentTemplate(id: string): Promise<void> {
    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));
  }
}

export const storage = new DatabaseStorage();
