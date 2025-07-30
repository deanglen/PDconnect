import * as crypto from 'crypto';
import * as fs from 'fs';
import * as forge from 'node-forge';
import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import { XMLSignatureVerifier, SignatureValidationResult } from '../utils/xml-signature-simple';

export interface CertificateConfig {
  clientCertPath?: string;
  clientKeyPath?: string;
  clientCertPem?: string;
  clientKeyPem?: string;
  caCertPath?: string;
  caCertPem?: string;
  passphrase?: string;
}

export interface SecureAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  certificateInfo?: any;
  errorMessage?: string;
}

export class CertificateBasedAuth {
  private xmlVerifier: XMLSignatureVerifier;
  private httpsAgent?: https.Agent;

  constructor(private certificateConfig: CertificateConfig) {
    this.xmlVerifier = new XMLSignatureVerifier();
    this.setupHTTPSAgent();
  }

  /**
   * Setup HTTPS agent with client certificate authentication
   */
  private setupHTTPSAgent(): void {
    try {
      const agentOptions: https.AgentOptions = {
        rejectUnauthorized: true,
        requestCert: true,
      };

      // Load client certificate
      if (this.certificateConfig.clientCertPath) {
        agentOptions.cert = fs.readFileSync(this.certificateConfig.clientCertPath);
      } else if (this.certificateConfig.clientCertPem) {
        agentOptions.cert = this.certificateConfig.clientCertPem;
      }

      // Load client private key
      if (this.certificateConfig.clientKeyPath) {
        agentOptions.key = fs.readFileSync(this.certificateConfig.clientKeyPath);
      } else if (this.certificateConfig.clientKeyPem) {
        agentOptions.key = this.certificateConfig.clientKeyPem;
      }

      // Load CA certificate if provided
      if (this.certificateConfig.caCertPath) {
        agentOptions.ca = fs.readFileSync(this.certificateConfig.caCertPath);
      } else if (this.certificateConfig.caCertPem) {
        agentOptions.ca = this.certificateConfig.caCertPem;
      }

      // Set passphrase if provided
      if (this.certificateConfig.passphrase) {
        agentOptions.passphrase = this.certificateConfig.passphrase;
      }

      this.httpsAgent = new https.Agent(agentOptions);
    } catch (error) {
      console.error('Failed to setup HTTPS agent with certificates:', error);
    }
  }

  /**
   * Authenticate with SugarCRM using certificate-based authentication
   */
  async authenticateWithCertificate(sugarCrmUrl: string, username: string): Promise<SecureAuthResult> {
    try {
      const client = axios.create({
        httpsAgent: this.httpsAgent,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SugarCRM-PandaDoc-Integration-Secure/1.0'
        }
      });

      // Enhanced OAuth2 request with certificate authentication
      const response = await client.post(`${sugarCrmUrl}/rest/v11/oauth2/token`, {
        grant_type: 'password',
        username,
        password: '', // Password not needed with certificate auth
        client_id: 'sugar',
        client_secret: '',
        platform: 'pandadoc_integration_secure',
        auth_type: 'certificate' // Custom field to indicate certificate auth
      });

      if (response.data.access_token) {
        return {
          success: true,
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          certificateInfo: this.extractCertificateInfo()
        };
      } else {
        return {
          success: false,
          errorMessage: 'No access token received from SugarCRM'
        };
      }

    } catch (error: any) {
      return {
        success: false,
        errorMessage: `Certificate authentication failed: ${error.response?.data?.error_description || error.message}`
      };
    }
  }

  /**
   * Create secure HTTP client with certificate authentication
   */
  createSecureClient(baseURL: string): AxiosInstance {
    return axios.create({
      baseURL,
      httpsAgent: this.httpsAgent,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SugarCRM-PandaDoc-Integration-Secure/1.0'
      }
    });
  }

  /**
   * Verify XML signature from SugarCRM response
   */
  async verifyXMLResponse(xmlData: string): Promise<SignatureValidationResult> {
    return await this.xmlVerifier.verifyXMLSignature(xmlData);
  }

  /**
   * Sign XML data for secure transmission
   */
  async signXMLData(data: any): Promise<string> {
    if (!this.certificateConfig.clientKeyPem || !this.certificateConfig.clientCertPem) {
      throw new Error('Client certificate and key required for signing');
    }

    return await this.xmlVerifier.createSignedDocument(
      data,
      this.certificateConfig.clientKeyPem,
      this.certificateConfig.clientCertPem
    );
  }

  /**
   * Extract certificate information for logging/audit
   */
  private extractCertificateInfo(): any {
    try {
      if (!this.certificateConfig.clientCertPem) {
        return null;
      }

      const cert = forge.pki.certificateFromPem(this.certificateConfig.clientCertPem);
      
      return {
        subject: cert.subject.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '),
        issuer: cert.issuer.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '),
        serialNumber: cert.serialNumber,
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        fingerprint: this.calculateFingerprint(cert)
      };
    } catch (error) {
      console.error('Failed to extract certificate info:', error);
      return null;
    }
  }

  private calculateFingerprint(cert: forge.pki.Certificate): string {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const sha256 = forge.md.sha256.create();
    sha256.update(der);
    return sha256.digest().toHex().toUpperCase();
  }

  /**
   * Validate certificate chain and trust
   */
  async validateCertificateChain(): Promise<{ isValid: boolean; errorMessage?: string }> {
    try {
      if (!this.certificateConfig.clientCertPem) {
        return { isValid: false, errorMessage: 'No client certificate configured' };
      }

      const cert = forge.pki.certificateFromPem(this.certificateConfig.clientCertPem);
      const now = new Date();

      // Check time validity
      if (now < cert.validity.notBefore) {
        return { isValid: false, errorMessage: 'Certificate is not yet valid' };
      }

      if (now > cert.validity.notAfter) {
        return { isValid: false, errorMessage: 'Certificate has expired' };
      }

      // Additional chain validation if CA cert is provided
      if (this.certificateConfig.caCertPem) {
        const caCert = forge.pki.certificateFromPem(this.certificateConfig.caCertPem);
        
        try {
          // Simple issuer verification
          const isSignedByCA = caCert.verify(cert);
          if (!isSignedByCA) {
            return { isValid: false, errorMessage: 'Certificate not signed by provided CA' };
          }
        } catch (error) {
          return { isValid: false, errorMessage: `Certificate chain validation error: ${error}` };
        }
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, errorMessage: `Certificate validation failed: ${error}` };
    }
  }

  /**
   * Generate certificate signing request (CSR) for new certificates
   */
  generateCSR(commonName: string, organization: string, country: string): string {
    try {
      // Generate key pair
      const keys = forge.pki.rsa.generateKeyPair(2048);
      
      // Create certificate signing request
      const csr = forge.pki.createCertificationRequest();
      csr.publicKey = keys.publicKey;
      csr.setSubject([{
        name: 'commonName',
        value: commonName
      }, {
        name: 'organizationName',
        value: organization
      }, {
        name: 'countryName',
        value: country
      }]);

      // Sign the CSR
      csr.sign(keys.privateKey);

      return forge.pki.certificationRequestToPem(csr);
    } catch (error) {
      throw new Error(`Failed to generate CSR: ${error}`);
    }
  }

  /**
   * Create self-signed certificate for testing
   */
  createSelfSignedCertificate(commonName: string): { cert: string; key: string } {
    try {
      // Generate key pair
      const keys = forge.pki.rsa.generateKeyPair(2048);
      
      // Create certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

      const attrs = [{
        name: 'commonName',
        value: commonName
      }, {
        name: 'organizationName',
        value: 'SugarCRM PandaDoc Integration'
      }, {
        name: 'organizationalUnitName',
        value: 'IT Department'
      }];

      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      // Add extensions
      cert.setExtensions([{
        name: 'basicConstraints',
        cA: false
      }, {
        name: 'keyUsage',
        keyCertSign: false,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
      }, {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true
      }]);

      // Self-sign certificate
      cert.sign(keys.privateKey);

      return {
        cert: forge.pki.certificateToPem(cert),
        key: forge.pki.privateKeyToPem(keys.privateKey)
      };
    } catch (error) {
      throw new Error(`Failed to create self-signed certificate: ${error}`);
    }
  }
}

/**
 * Factory function to create certificate-based auth from tenant configuration
 */
export function createCertificateAuth(tenantId: string, certConfig?: CertificateConfig): CertificateBasedAuth {
  // Default configuration for development/testing
  const defaultConfig: CertificateConfig = {
    // These would be loaded from environment variables or tenant-specific config
    clientCertPem: process.env[`${tenantId.toUpperCase()}_CLIENT_CERT`] || process.env.DEFAULT_CLIENT_CERT,
    clientKeyPem: process.env[`${tenantId.toUpperCase()}_CLIENT_KEY`] || process.env.DEFAULT_CLIENT_KEY,
    caCertPem: process.env[`${tenantId.toUpperCase()}_CA_CERT`] || process.env.DEFAULT_CA_CERT,
    passphrase: process.env[`${tenantId.toUpperCase()}_CERT_PASSPHRASE`] || process.env.DEFAULT_CERT_PASSPHRASE
  };

  const config = { ...defaultConfig, ...certConfig };
  return new CertificateBasedAuth(config);
}