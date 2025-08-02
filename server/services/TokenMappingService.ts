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

export class TokenMappingService {
  
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
   * Clean token name by removing {{}} brackets and trimming
   */
  private static cleanTokenName(tokenName: string): string {
    return tokenName.replace(/[{}]/g, '').trim();
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