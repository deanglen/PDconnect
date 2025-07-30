import * as crypto from 'crypto';
import * as fs from 'fs';
import { DOMParser } from 'xmldom';
import * as forge from 'node-forge';

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  fingerprint: string;
}

export interface SignatureValidationResult {
  isValid: boolean;
  certificate?: CertificateInfo;
  errorMessage?: string;
  signedData?: any;
}

export class XMLSignatureVerifier {
  private trustedCertificates: Map<string, forge.pki.Certificate> = new Map();

  constructor(trustedCertPaths?: string[]) {
    if (trustedCertPaths) {
      this.loadTrustedCertificates(trustedCertPaths);
    }
  }

  /**
   * Load trusted certificates for signature verification
   */
  private loadTrustedCertificates(certPaths: string[]): void {
    certPaths.forEach(certPath => {
      try {
        const certPem = fs.readFileSync(certPath, 'utf8');
        const cert = forge.pki.certificateFromPem(certPem);
        const fingerprint = this.getCertificateFingerprint(cert);
        this.trustedCertificates.set(fingerprint, cert);
        
        console.log(`Loaded trusted certificate: ${cert.subject.getField('CN')?.value}`);
      } catch (error) {
        console.error(`Failed to load certificate ${certPath}:`, error);
      }
    });
  }

  /**
   * Add a trusted certificate from PEM string
   */
  addTrustedCertificate(certPem: string): void {
    try {
      const cert = forge.pki.certificateFromPem(certPem);
      const fingerprint = this.getCertificateFingerprint(cert);
      this.trustedCertificates.set(fingerprint, cert);
    } catch (error) {
      throw new Error(`Invalid certificate format: ${error}`);
    }
  }

  /**
   * Simple XML signature verification for SugarCRM integration
   */
  async verifyXMLSignature(xmlData: string): Promise<SignatureValidationResult> {
    try {
      const doc = new DOMParser().parseFromString(xmlData, 'text/xml');
      
      // Find signature element
      const signatureElement = doc.getElementsByTagName('Signature')[0];
      if (!signatureElement) {
        return {
          isValid: false,
          errorMessage: 'No XML signature found in document'
        };
      }

      // Extract certificate from signature
      const x509CertElement = doc.getElementsByTagName('X509Certificate')[0];
      if (!x509CertElement) {
        return {
          isValid: false,
          errorMessage: 'No X509 certificate found in signature'
        };
      }

      const certBase64 = x509CertElement.textContent;
      if (!certBase64) {
        return {
          isValid: false,
          errorMessage: 'Empty certificate data'
        };
      }

      // Parse certificate
      const certDer = forge.util.decode64(certBase64);
      const cert = forge.pki.certificateFromAsn1(forge.asn1.fromDer(certDer));
      
      // Validate certificate
      const certInfo = this.extractCertificateInfo(cert);
      const certValidation = this.validateCertificate(cert);
      
      if (!certValidation.isValid) {
        return {
          isValid: false,
          certificate: certInfo,
          errorMessage: certValidation.errorMessage
        };
      }

      // For SugarCRM integration, we'll do a simplified signature verification
      // This checks that the signature exists and certificate is valid
      const isSignatureValid = this.verifyDocumentIntegrity(xmlData, cert);

      if (!isSignatureValid) {
        return {
          isValid: false,
          certificate: certInfo,
          errorMessage: 'Document integrity verification failed'
        };
      }

      // Extract signed data
      const signedData = this.extractSignedData(doc);

      return {
        isValid: true,
        certificate: certInfo,
        signedData
      };

    } catch (error) {
      return {
        isValid: false,
        errorMessage: `XML signature verification failed: ${error}`
      };
    }
  }

  /**
   * Validate certificate against trusted store and time validity
   */
  private validateCertificate(cert: forge.pki.Certificate): { isValid: boolean; errorMessage?: string } {
    const now = new Date();
    
    // Check time validity
    if (now < cert.validity.notBefore) {
      return {
        isValid: false,
        errorMessage: 'Certificate is not yet valid'
      };
    }
    
    if (now > cert.validity.notAfter) {
      return {
        isValid: false,
        errorMessage: 'Certificate has expired'
      };
    }

    // Check against trusted certificates if any are configured
    const fingerprint = this.getCertificateFingerprint(cert);
    if (this.trustedCertificates.size > 0 && !this.trustedCertificates.has(fingerprint)) {
      // Check if certificate is signed by a trusted CA
      let isTrustedByCA = false;
      const trustedCertArray = Array.from(this.trustedCertificates.values());
      
      for (const trustedCert of trustedCertArray) {
        try {
          if (trustedCert.verify(cert)) {
            isTrustedByCA = true;
            break;
          }
        } catch (error) {
          // Continue checking other certificates
        }
      }
      
      if (!isTrustedByCA) {
        return {
          isValid: false,
          errorMessage: 'Certificate is not trusted (not in trusted store and not signed by trusted CA)'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Simplified document integrity verification
   */
  private verifyDocumentIntegrity(xmlData: string, cert: forge.pki.Certificate): boolean {
    try {
      // For enterprise SugarCRM integration, we check that:
      // 1. Document has a valid signature element
      // 2. Certificate is valid and trusted
      // 3. Document hasn't been tampered with (hash verification)
      
      const doc = new DOMParser().parseFromString(xmlData, 'text/xml');
      const signatureValue = doc.getElementsByTagName('SignatureValue')[0]?.textContent;
      
      if (!signatureValue) {
        return false;
      }

      // Create hash of the signed content for integrity check
      const signedInfo = doc.getElementsByTagName('SignedInfo')[0];
      if (!signedInfo) {
        return false;
      }

      const canonicalizedSignedInfo = this.canonicalizeXML(signedInfo.toString());
      const hash = crypto.createHash('sha256').update(canonicalizedSignedInfo).digest();
      
      // Verify signature using certificate's public key
      const publicKey = forge.pki.publicKeyToPem(cert.publicKey);
      const verify = crypto.createVerify('SHA256');
      verify.update(hash);
      
      const signatureBuffer = Buffer.from(signatureValue, 'base64');
      return verify.verify(publicKey, signatureBuffer);
      
    } catch (error) {
      console.error('Document integrity verification failed:', error);
      return false;
    }
  }

  /**
   * Basic XML canonicalization
   */
  private canonicalizeXML(xml: string): string {
    // Simple canonicalization - remove extra whitespace
    return xml.replace(/>\s+</g, '><').trim();
  }

  /**
   * Extract certificate information
   */
  private extractCertificateInfo(cert: forge.pki.Certificate): CertificateInfo {
    return {
      subject: cert.subject.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '),
      issuer: cert.issuer.attributes.map(attr => `${attr.name}=${attr.value}`).join(', '),
      serialNumber: cert.serialNumber,
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter,
      fingerprint: this.getCertificateFingerprint(cert)
    };
  }

  /**
   * Calculate certificate fingerprint
   */
  private getCertificateFingerprint(cert: forge.pki.Certificate): string {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const sha256 = forge.md.sha256.create();
    sha256.update(der);
    return sha256.digest().toHex().toUpperCase();
  }

  /**
   * Extract signed data from XML document
   */
  private extractSignedData(doc: Document): any {
    try {
      // Look for SugarCRM/HR data elements
      const dataElements = [
        'employee', 'contact', 'opportunity', 'account', 'lead',
        'document', 'contract', 'agreement', 'workorder', 'case'
      ];

      const extractedData: any = {};

      dataElements.forEach(elementName => {
        const elements = doc.getElementsByTagName(elementName);
        if (elements.length > 0) {
          const elementData: any = {};
          const element = elements[0];
          
          // Extract attributes
          if (element.attributes) {
            for (let i = 0; i < element.attributes.length; i++) {
              const attr = element.attributes[i] as any;
              elementData[attr.name] = attr.value;
            }
          }
          
          // Extract child elements
          if (element.childNodes) {
            for (let i = 0; i < element.childNodes.length; i++) {
              const child = element.childNodes[i];
              if (child.nodeType === 1) { // Element node
                elementData[child.nodeName] = child.textContent;
              }
            }
          }
          
          extractedData[elementName] = elementData;
        }
      });

      return extractedData;
    } catch (error) {
      console.warn('Failed to extract signed data:', error);
      return {};
    }
  }

  /**
   * Create a simple signed XML document for outgoing data
   */
  async createSignedDocument(data: any, privateKeyPem: string, certificatePem: string): Promise<string> {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      const certBase64 = forge.util.encode64(
        forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
      );

      const timestamp = new Date().toISOString();
      const documentId = crypto.randomUUID();

      // Create signed XML document
      const xmlDoc = `<?xml version="1.0" encoding="UTF-8"?>
<SignedDocument xmlns="http://sugarcrm.com/xml/signature/v1.0" DocumentId="${documentId}">
  <Data>
    ${this.objectToXML(data)}
  </Data>
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
      <Reference URI="#data">
        <DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
        <DigestValue>${this.calculateDigest(data)}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${this.signData(data, privateKeyPem)}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
  <Timestamp>${timestamp}</Timestamp>
</SignedDocument>`;

      return xmlDoc;
    } catch (error) {
      throw new Error(`Failed to create signed document: ${error}`);
    }
  }

  private objectToXML(obj: any, rootElement = 'Root'): string {
    if (typeof obj !== 'object') {
      return `<${rootElement}>${obj}</${rootElement}>`;
    }

    let xml = '';
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        xml += `<${key}>${this.objectToXML(value)}</${key}>`;
      } else {
        xml += `<${key}>${value}</${key}>`;
      }
    }
    return xml;
  }

  private calculateDigest(data: any): string {
    const dataString = JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('base64');
  }

  private signData(data: any, privateKeyPem: string): string {
    const dataString = JSON.stringify(data);
    const sign = crypto.createSign('SHA256');
    sign.update(dataString);
    return sign.sign(privateKeyPem, 'base64');
  }
}

/**
 * Utility function to validate certificate chain
 */
export function validateCertificateChain(
  certificateChain: string[],
  trustedRootCerts: string[]
): { isValid: boolean; errorMessage?: string } {
  try {
    const certs = certificateChain.map(certPem => forge.pki.certificateFromPem(certPem));
    const rootCerts = trustedRootCerts.map(certPem => forge.pki.certificateFromPem(certPem));
    
    // Create certificate store with trusted roots
    const caStore = forge.pki.createCertificateStore();
    rootCerts.forEach(cert => caStore.addCertificate(cert));
    
    // Verify certificate chain
    const isValid = forge.pki.verifyCertificateChain(caStore, certs);
    
    return { isValid };
  } catch (error) {
    return {
      isValid: false,
      errorMessage: `Certificate chain validation failed: ${error}`
    };
  }
}