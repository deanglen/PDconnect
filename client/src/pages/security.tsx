import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { Shield, CheckCircle, XCircle, AlertTriangle, FileText, Key, Lock } from 'lucide-react';

interface SecurityInfo {
  tenantId: string;
  tenantName: string;
  certificateEnabled: boolean;
  certificateInfo?: any;
  xmlSignatureSupported: boolean;
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [xmlData, setXmlData] = useState('');
  const [testData, setTestData] = useState('');

  // Fetch security information
  const { data: securityInfo, isLoading } = useQuery<SecurityInfo[]>({
    queryKey: ['/api/security/info'],
  });

  // XML verification mutation
  const verifyXmlMutation = useMutation({
    mutationFn: async ({ tenantId, xmlData }: { tenantId: string; xmlData: string }) => {
      const response = await fetch('/api/security/verify-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, xmlData }),
      });
      
      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      if (data.isValid) {
        toast({
          title: "XML Signature Valid",
          description: "The XML signature has been successfully verified.",
        });
      } else {
        toast({
          title: "XML Signature Invalid",
          description: data.errorMessage || "The XML signature verification failed.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Verification Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Document signing mutation
  const signDocumentMutation = useMutation({
    mutationFn: async ({ tenantId, data }: { tenantId: string; data: any }) => {
      const response = await fetch('/api/security/create-signed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, data }),
      });
      
      if (!response.ok) {
        throw new Error(`Signing failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Document Signed",
        description: "The document has been successfully signed with XML signature.",
      });
      setTestData(data.signedDocument);
    },
    onError: (error: any) => {
      toast({
        title: "Signing Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleVerifyXml = (tenantId: string) => {
    if (!xmlData.trim()) {
      toast({
        title: "Missing Data",
        description: "Please provide XML data to verify.",
        variant: "destructive",
      });
      return;
    }
    
    verifyXmlMutation.mutate({ tenantId, xmlData });
  };

  const handleSignDocument = (tenantId: string) => {
    if (!testData.trim()) {
      toast({
        title: "Missing Data",
        description: "Please provide data to sign.",
        variant: "destructive",
      });
      return;
    }

    try {
      const data = JSON.parse(testData);
      signDocumentMutation.mutate({ tenantId, data });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please provide valid JSON data to sign.",
        variant: "destructive",
      });
    }
  };

  const getSecurityStatusIcon = (info: SecurityInfo) => {
    if (info.certificateEnabled && info.xmlSignatureSupported) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (info.certificateEnabled) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getSecurityStatusText = (info: SecurityInfo) => {
    if (info.certificateEnabled && info.xmlSignatureSupported) {
      return "Fully Secured";
    } else if (info.certificateEnabled) {
      return "Partially Secured";
    } else {
      return "Not Secured";
    }
  };

  const getSecurityStatusDescription = (info: SecurityInfo) => {
    if (info.certificateEnabled && info.xmlSignatureSupported) {
      return "Certificate-based authentication and XML signature verification are both enabled.";
    } else if (info.certificateEnabled) {
      return "Certificate-based authentication is enabled, but XML signature verification is not available.";
    } else {
      return "Standard password authentication is being used. Consider upgrading to certificate-based authentication for enhanced security.";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Security & Certificate Management</h1>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Security & Certificate Management</h1>
      </div>
      
      <div className="grid gap-6">
        {/* Security Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Overview
            </CardTitle>
            <CardDescription>
              Enterprise-grade security features for SugarCRM integration with XML signature verification and certificate-based authentication.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {securityInfo?.map((info) => (
                <Card key={info.tenantId} className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{info.tenantName}</CardTitle>
                      {getSecurityStatusIcon(info)}
                    </div>
                    <Badge variant={info.certificateEnabled ? "default" : "secondary"}>
                      {getSecurityStatusText(info)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <p className="text-sm text-muted-foreground mb-3">
                      {getSecurityStatusDescription(info)}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Certificate Auth:</span>
                        <Badge variant={info.certificateEnabled ? "default" : "outline"}>
                          {info.certificateEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>XML Signatures:</span>
                        <Badge variant={info.xmlSignatureSupported ? "default" : "outline"}>
                          {info.xmlSignatureSupported ? "Supported" : "Not Available"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security Tools */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Security Tools
            </CardTitle>
            <CardDescription>
              Test XML signature verification and document signing capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="verify" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="verify">Verify XML Signature</TabsTrigger>
                <TabsTrigger value="sign">Sign Document</TabsTrigger>
              </TabsList>
              
              <TabsContent value="verify" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="xml-data">XML Data to Verify</Label>
                  <Textarea
                    id="xml-data"
                    placeholder="Paste your signed XML document here..."
                    value={xmlData}
                    onChange={(e) => setXmlData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {securityInfo?.filter(info => info.certificateEnabled).map((info) => (
                    <Button
                      key={info.tenantId}
                      onClick={() => handleVerifyXml(info.tenantId)}
                      disabled={verifyXmlMutation.isPending}
                      variant="outline"
                    >
                      Verify with {info.tenantName}
                    </Button>
                  ))}
                </div>
                
                {securityInfo?.filter(info => info.certificateEnabled).length === 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      No tenants have certificate-based authentication enabled. XML signature verification is not available.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="sign" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-data">Data to Sign (JSON format)</Label>
                  <Textarea
                    id="test-data"
                    placeholder='{"employee": {"name": "John Doe", "id": "EMP001", "department": "HR"}}'
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  {securityInfo?.filter(info => info.certificateEnabled).map((info) => (
                    <Button
                      key={info.tenantId}
                      onClick={() => handleSignDocument(info.tenantId)}
                      disabled={signDocumentMutation.isPending}
                      variant="outline"
                    >
                      Sign with {info.tenantName}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Configuration Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Certificate Configuration Guide
            </CardTitle>
            <CardDescription>
              How to set up certificate-based authentication for your tenants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Certificate-based authentication requires additional configuration through environment variables.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Environment Variables</h4>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                  <div># For tenant-specific certificates:</div>
                  <div>ACME_CLIENT_CERT=-----BEGIN CERTIFICATE-----...</div>
                  <div>ACME_CLIENT_KEY=-----BEGIN PRIVATE KEY-----...</div>
                  <div>ACME_CA_CERT=-----BEGIN CERTIFICATE-----...</div>
                  <div></div>
                  <div># Or use default certificates for all tenants:</div>
                  <div>DEFAULT_CLIENT_CERT=-----BEGIN CERTIFICATE-----...</div>
                  <div>DEFAULT_CLIENT_KEY=-----BEGIN PRIVATE KEY-----...</div>
                  <div>DEFAULT_CA_CERT=-----BEGIN CERTIFICATE-----...</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">SugarCRM Configuration</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Your SugarCRM instance must be configured to accept certificate-based authentication:
                </p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li>Enable SSL/TLS with mutual authentication (mTLS)</li>
                  <li>Configure the certificate authority (CA) for client certificate validation</li>
                  <li>Set up user mapping from certificate subject to SugarCRM users</li>
                  <li>Enable the custom OAuth2 platform "pandadoc_integration_secure"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}