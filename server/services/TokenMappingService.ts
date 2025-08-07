// Token Mapping Service for dynamic field extraction and PandaDoc token generation
import type { FieldMapping } from "@shared/schema";

export interface TokenResult {
  name: string;
  value: string;
  source: string; // Which field this token came from
  mapped: boolean; // Whether this was explicitly mapped or auto-generated
}

export interface MappingPreview {
  tokens: TokenResult[];
  missingFields: string[];
  warnings: string[];
  totalMappings: number;
  successfulMappings: number;
}

/**
 * Normalize PandaDoc token format
 * Converts between [field] and {{field}} formats for consistency
 */
export function normalizePandaDocToken(token: string): string {
  // Remove any existing brackets first
  const cleanToken = token.replace(/[{}\[\]]/g, '').trim();
  
  // Return in PandaDoc native format for display
  return `[${cleanToken}]`;
}

/**
 * Extract clean token name from any format
 */
export function extractTokenName(token: string): string {
  return token.replace(/[{}\[\]]/g, '').trim();
}

export interface ResolvedRecipient {
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  signing_order?: number;
  source: 'static' | 'dynamic';
  resolvedFrom?: string; // Which field/path this was resolved from
}

export class TokenMappingService {
  
  /**
   * Resolve recipients from template configuration and SugarCRM data
   */
  static async resolveRecipients(
    defaultRecipients: any[], 
    sugarCrmData: any, 
    sugarService?: any
  ): Promise<ResolvedRecipient[]> {
    const resolvedRecipients: ResolvedRecipient[] = [];

    for (const recipient of defaultRecipients) {
      try {
        const resolved = await this.resolveRecipient(recipient, sugarCrmData, sugarService);
        if (resolved) {
          resolvedRecipients.push(resolved);
        }
      } catch (error) {
        console.error(`[TokenMapping] Error resolving recipient:`, error);
        // Continue with other recipients
      }
    }

    return resolvedRecipients;
  }

  /**
   * Resolve a single recipient configuration
   */
  private static async resolveRecipient(
    recipient: any, 
    sugarCrmData: any, 
    sugarService?: any
  ): Promise<ResolvedRecipient | null> {
    // Static email address case
    if (recipient.email && this.isStaticEmail(recipient.email)) {
      return {
        email: recipient.email,
        first_name: recipient.first_name || '',
        last_name: recipient.last_name || '',
        role: recipient.role || 'Signer',
        signing_order: recipient.signing_order,
        source: 'static'
      };
    }

    // Dynamic field reference case (e.g., "opportunity>>Primary Contact>>email")
    if (recipient.email && this.isDynamicReference(recipient.email)) {
      const resolvedEmail = await this.resolveDynamicReference(
        recipient.email, 
        sugarCrmData, 
        sugarService
      );
      
      if (resolvedEmail) {
        // Try to resolve names as well if they're dynamic
        const firstName = recipient.first_name && this.isDynamicReference(recipient.first_name) 
          ? await this.resolveDynamicReference(recipient.first_name, sugarCrmData, sugarService)
          : recipient.first_name || '';
        
        const lastName = recipient.last_name && this.isDynamicReference(recipient.last_name)
          ? await this.resolveDynamicReference(recipient.last_name, sugarCrmData, sugarService)
          : recipient.last_name || '';

        return {
          email: resolvedEmail,
          first_name: firstName,
          last_name: lastName,
          role: recipient.role || 'Signer',
          signing_order: recipient.signing_order,
          source: 'dynamic',
          resolvedFrom: recipient.email
        };
      }
    }

    return null;
  }

  /**
   * Check if email is a static email address
   */
  private static isStaticEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if field reference is dynamic (contains >> for relationships)
   */
  private static isDynamicReference(reference: string): boolean {
    return reference.includes('>>') || reference.includes('.');
  }

  /**
   * Resolve dynamic field reference like "opportunity>>Primary Contact>>email"
   */
  private static async resolveDynamicReference(
    reference: string, 
    sugarCrmData: any, 
    sugarService?: any
  ): Promise<string | null> {
    try {
      // Parse the reference path
      const parts = reference.split('>>').map(p => p.trim());
      
      if (parts.length === 1) {
        // Simple field reference on current record
        const fieldName = parts[0];
        return this.extractFieldValue(sugarCrmData, fieldName);
      }

      if (parts.length >= 2 && sugarService) {
        // Relationship traversal needed
        const [sourceModule, ...relationshipPath] = parts;
        
        // Start with current record data
        let currentData = sugarCrmData;
        let currentModule = sourceModule.toLowerCase();

        // Traverse the relationship path
        for (let i = 0; i < relationshipPath.length - 1; i++) {
          const relationshipName = relationshipPath[i];
          const relatedRecordId = this.extractRelatedRecordId(currentData, relationshipName);
          
          if (!relatedRecordId) {
            console.log(`[TokenMapping] No related record ID found for ${relationshipName}`);
            return null;
          }

          // Determine target module for this relationship
          const targetModule = this.inferTargetModule(relationshipName);
          if (!targetModule) {
            console.log(`[TokenMapping] Could not infer target module for ${relationshipName}`);
            return null;
          }

          // Fetch the related record
          currentData = await sugarService.getRecord(targetModule, relatedRecordId);
          if (!currentData) {
            console.log(`[TokenMapping] Failed to fetch ${targetModule} record ${relatedRecordId}`);
            return null;
          }

          currentModule = targetModule.toLowerCase();
        }

        // Extract the final field value
        const finalFieldName = relationshipPath[relationshipPath.length - 1];
        return this.extractFieldValue(currentData, finalFieldName);
      }

      return null;
    } catch (error) {
      console.error(`[TokenMapping] Error resolving dynamic reference ${reference}:`, error);
      return null;
    }
  }

  /**
   * Extract related record ID from relationship field
   */
  private static extractRelatedRecordId(data: any, relationshipName: string): string | null {
    // Common SugarCRM relationship ID patterns
    const possibleFields = [
      `${relationshipName.toLowerCase()}_id`,
      `${relationshipName.toLowerCase().replace(' ', '_')}_id`,
      `${relationshipName.toLowerCase().replace('primary ', '').replace(' ', '_')}_id`,
      'assigned_user_id', // For "Assigned User" relationships
      'account_id',       // For "Account" relationships
      'contact_id',       // For "Contact" relationships
      'opportunity_id'    // For "Opportunity" relationships
    ];

    for (const field of possibleFields) {
      if (data[field]) {
        return data[field];
      }
    }

    // Special case for "Primary Contact" -> contact_id
    if (relationshipName.toLowerCase().includes('contact')) {
      return data.contact_id || data.primary_contact_id;
    }

    return null;
  }

  /**
   * Infer target module name from relationship name
   */
  private static inferTargetModule(relationshipName: string): string | null {
    const name = relationshipName.toLowerCase();
    
    if (name.includes('contact')) return 'Contacts';
    if (name.includes('account')) return 'Accounts';
    if (name.includes('user') || name.includes('assigned')) return 'Users';
    if (name.includes('opportunity')) return 'Opportunities';
    if (name.includes('lead')) return 'Leads';
    if (name.includes('case')) return 'Cases';
    
    return null;
  }

  /**
   * Generate tokens from SugarCRM record and field mappings
   */
  static generateTokens(record: any, mappings: FieldMapping[]): TokenResult[] {
    const tokens: TokenResult[] = [];
    
    for (const mapping of mappings) {
      const value = this.extractFieldValue(record, mapping.sugarField);
      
      if (value !== undefined && value !== null && value !== '') {
        tokens.push({
          name: this.cleanTokenName(mapping.pandaDocToken),
          value: this.formatValue(value, mapping.sugarFieldType || undefined),
          source: mapping.sugarField,
          mapped: true
        });
      }
    }
    
    return tokens;
  }

  /**
   * Preview mapping results without actually creating tokens
   */
  static previewMapping(record: any, mappings: FieldMapping[]): MappingPreview {
    const tokens: TokenResult[] = [];
    const missingFields: string[] = [];
    const warnings: string[] = [];
    
    for (const mapping of mappings) {
      const value = this.extractFieldValue(record, mapping.sugarField);
      
      if (value === undefined || value === null || value === '') {
        missingFields.push(mapping.sugarField);
        warnings.push(`Field '${mapping.sugarField}' (${mapping.sugarFieldLabel}) is missing or empty`);
      } else {
        tokens.push({
          name: this.cleanTokenName(mapping.pandaDocToken),
          value: this.formatValue(value, mapping.sugarFieldType || undefined),
          source: mapping.sugarField,
          mapped: true
        });
      }
    }
    
    return {
      tokens,
      missingFields,
      warnings,
      totalMappings: mappings.length,
      successfulMappings: tokens.length
    };
  }

  /**
   * Extract field value with support for nested fields and dot notation
   */
  private static extractFieldValue(record: any, fieldPath: string): any {
    // Support dot notation for nested fields (e.g., "account.name")
    const parts = fieldPath.split('.');
    let value = record;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Clean token name by removing {{}} or [] brackets and trimming
   * Supports both PandaDoc native [field] syntax and legacy {{field}} syntax
   */
  private static cleanTokenName(tokenName: string): string {
    // Remove both {{}} and [] brackets to support PandaDoc native format
    return tokenName.replace(/[{}\[\]]/g, '').trim();
  }

  /**
   * Format value based on field type
   */
  private static formatValue(value: any, fieldType?: string): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    switch (fieldType) {
      case 'currency':
        const numValue = parseFloat(value);
        return isNaN(numValue) ? String(value) : numValue.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD'
        });
      
      case 'date':
      case 'datetime':
        try {
          const date = new Date(value);
          return isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
        } catch {
          return String(value);
        }
      
      case 'bool':
      case 'boolean':
        return value ? 'Yes' : 'No';
      
      default:
        return String(value);
    }
  }

  /**
   * Discover available fields from a record object
   */
  static discoverFields(record: any, prefix = ''): Array<{name: string, type: string, value: any}> {
    const fields: Array<{name: string, type: string, value: any}> = [];
    
    for (const [key, value] of Object.entries(record)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      
      if (value === null || value === undefined) {
        fields.push({
          name: fieldName,
          type: 'unknown',
          value: null
        });
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse but limit depth to prevent infinite loops
        if (prefix.split('.').length < 3) {
          fields.push(...this.discoverFields(value, fieldName));
        }
      } else {
        fields.push({
          name: fieldName,
          type: this.inferFieldType(value),
          value: value
        });
      }
    }
    
    return fields;
  }

  /**
   * Infer field type from value
   */
  private static inferFieldType(value: any): string {
    if (typeof value === 'string') {
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return 'date';
      }
      // Check if it looks like an email
      if (value.includes('@') && value.includes('.')) {
        return 'email';
      }
      return 'varchar';
    }
    
    if (typeof value === 'number') {
      // Check if it looks like currency (has decimals or is large)
      if (value % 1 !== 0 || value > 1000) {
        return 'currency';
      }
      return 'int';
    }
    
    if (typeof value === 'boolean') {
      return 'bool';
    }
    
    return 'unknown';
  }

  /**
   * Validate token mappings against available fields
   */
  static validateMappings(record: any, mappings: FieldMapping[]): {
    valid: FieldMapping[];
    invalid: Array<{mapping: FieldMapping, reason: string}>;
  } {
    const valid: FieldMapping[] = [];
    const invalid: Array<{mapping: FieldMapping, reason: string}> = [];
    
    for (const mapping of mappings) {
      const value = this.extractFieldValue(record, mapping.sugarField);
      
      if (value === undefined) {
        invalid.push({
          mapping,
          reason: `Field '${mapping.sugarField}' not found in record`
        });
      } else if (!mapping.pandaDocToken || !mapping.pandaDocToken.trim()) {
        invalid.push({
          mapping,
          reason: 'PandaDoc token is empty'
        });
      } else {
        valid.push(mapping);
      }
    }
    
    return { valid, invalid };
  }
}