// Mock SugarCRM schemas and data for UAT testing
// This simulates what would come from a real SugarCRM API

export const opportunitySchema = [
  {
    "name": "id",
    "label": "ID",
    "type": "id",
    "required": true
  },
  {
    "name": "name",
    "label": "Opportunity Name",
    "type": "varchar",
    "required": true
  },
  {
    "name": "amount",
    "label": "Amount",
    "type": "currency",
    "required": false
  },
  {
    "name": "date_closed",
    "label": "Expected Close Date",
    "type": "date",
    "required": false
  },
  {
    "name": "sales_stage",
    "label": "Sales Stage",
    "type": "enum",
    "required": false
  },
  {
    "name": "description",
    "label": "Description",
    "type": "text",
    "required": false
  },
  {
    "name": "account_name",
    "label": "Account Name",
    "type": "relate",
    "required": false
  },
  {
    "name": "assigned_user_name",
    "label": "Assigned To",
    "type": "relate",
    "required": false
  },
  {
    "name": "created_by_name",
    "label": "Created By",
    "type": "relate",
    "required": false
  }
];

export const mockOpportunityRecords = {
  "oppty_1234": {
    "id": "oppty_1234",
    "name": "Big Deal Opportunity",
    "amount": 45000,
    "date_closed": "2025-10-01",
    "sales_stage": "Proposal",
    "description": "This is a major strategic client deal.",
    "account_name": "Acme Corporation",
    "assigned_user_name": "John Sales",
    "created_by_name": "Jane Admin"
  },
  "oppty_5678": {
    "id": "oppty_5678",
    "name": "Enterprise Software License",
    "amount": 120000,
    "date_closed": "2025-12-15",
    "sales_stage": "Negotiation",
    "description": "Multi-year enterprise software licensing deal.",
    "account_name": "Global Tech Solutions",
    "assigned_user_name": "Sarah Enterprise",
    "created_by_name": "Mike Manager"
  },
  "oppty_7890": {
    "id": "oppty_7890",
    "name": "Consulting Services Contract",
    "amount": 75000,
    "date_closed": "2025-08-30",
    "sales_stage": "Prospecting",
    "description": "Professional consulting services engagement.",
    "account_name": "StartupXYZ",
    "assigned_user_name": "Alex Consultant",
    "created_by_name": "Lisa Lead"
  },
  "oppty_9999": {
    "id": "oppty_9999",
    "name": "Hardware Procurement Deal",
    "amount": 89000,
    "date_closed": "2025-11-20",
    "sales_stage": "Closed Won",
    "description": "Large scale hardware procurement for data center.",
    "account_name": "Tech Infrastructure Corp",
    "assigned_user_name": "David Hardware",
    "created_by_name": "Emma Executive"
  }
};

export const notesSchema = [
  {
    "name": "id",
    "label": "ID",
    "type": "id",
    "required": true
  },
  {
    "name": "name",
    "label": "Subject",
    "type": "varchar",
    "required": true
  },
  {
    "name": "filename",
    "label": "File Name",
    "type": "file",
    "required": false
  },
  {
    "name": "file_attachment",
    "label": "File Attachment",
    "type": "file",
    "required": false
  },
  {
    "name": "file_mime_type",
    "label": "File MIME Type",
    "type": "varchar",
    "required": false
  },
  {
    "name": "uploadfile",
    "label": "Upload File",
    "type": "file",
    "required": false
  },
  {
    "name": "description",
    "label": "Description",
    "type": "text",
    "required": false
  },
  {
    "name": "parent_type",
    "label": "Parent Type",
    "type": "varchar",
    "required": false
  },
  {
    "name": "parent_id",
    "label": "Parent ID",
    "type": "id",
    "required": false
  }
];

export const documentsSchema = [
  {
    "name": "id",
    "label": "ID",
    "type": "id",
    "required": true
  },
  {
    "name": "document_name",
    "label": "Document Name",
    "type": "varchar",
    "required": true
  },
  {
    "name": "filename",
    "label": "File Name",
    "type": "file",
    "required": false
  },
  {
    "name": "uploadfile",
    "label": "Upload File",
    "type": "file",
    "required": false
  },
  {
    "name": "file_attachment",
    "label": "File Attachment",
    "type": "file", 
    "required": false
  },
  {
    "name": "doc_type",
    "label": "Document Type",
    "type": "enum",
    "required": false
  },
  {
    "name": "category_id",
    "label": "Category",
    "type": "enum",
    "required": false
  }
];

export const moduleSchemas: Record<string, any[]> = {
  "Opportunities": opportunitySchema,
  "Notes": notesSchema,
  "Documents": documentsSchema,
  // Can add more modules as needed
};

export const mockRecords: Record<string, Record<string, any>> = {
  "Opportunities": mockOpportunityRecords,
  // Can add more modules as needed
};