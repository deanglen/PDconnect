import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ExternalLink, Play } from "lucide-react";

export default function DocumentTest() {
  const [recordId, setRecordId] = useState("");
  const [module, setModule] = useState("Opportunities");
  const [tenantId, setTenantId] = useState("5e8d9370-9b67-4fd0-a7f7-6083c5419c59");
  const [templateId, setTemplateId] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const generateUrl = () => {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      record_id: recordId,
      module: module,
      tenant_id: tenantId,
      template_id: templateId
    });
    return `${baseUrl}/api/create-doc?${params.toString()}`;
  };

  const testDocument = async () => {
    if (!recordId || !templateId) {
      setResponse("Please fill in Record ID and Template ID");
      return;
    }

    setIsLoading(true);
    setResponse("Creating document...");

    try {
      const url = generateUrl();
      const response = await fetch(url);
      const data = await response.json();
      
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const openInNewTab = () => {
    if (!recordId || !templateId) {
      alert("Please fill in Record ID and Template ID");
      return;
    }
    window.open(generateUrl(), '_blank');
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(generateUrl());
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Document Creation Test</h1>
        <p className="text-muted-foreground">
          Test the Generate Doc feature with real SugarCRM record IDs
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Test Parameters</CardTitle>
            <CardDescription>
              Enter your SugarCRM record details to test document creation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recordId">SugarCRM Record ID *</Label>
              <Input
                id="recordId"
                placeholder="e.g., 12345-abcd-6789-efgh"
                value={recordId}
                onChange={(e) => setRecordId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="module">Module</Label>
              <select
                id="module"
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                value={module}
                onChange={(e) => setModule(e.target.value)}
              >
                <option value="Opportunities">Opportunities</option>
                <option value="Accounts">Accounts</option>
                <option value="Contacts">Contacts</option>
                <option value="Leads">Leads</option>
                <option value="Cases">Cases</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateId">PandaDoc Template ID *</Label>
              <Input
                id="templateId"
                placeholder="e.g., your-template-id"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenantId">Tenant ID</Label>
              <Input
                id="tenantId"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={testDocument} disabled={isLoading} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                {isLoading ? "Creating..." : "Test Document"}
              </Button>
              <Button variant="outline" onClick={openInNewTab}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* URL and Response */}
        <div className="space-y-6">
          {/* Generated URL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated URL</CardTitle>
              <CardDescription>
                Copy this URL to use in SugarCRM custom buttons
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Textarea
                  value={generateUrl()}
                  readOnly
                  className="font-mono text-sm min-h-[100px]"
                />
                <Button variant="outline" onClick={copyUrl} className="w-full">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy URL
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Response */}
          {response && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Response</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={response}
                  readOnly
                  className="font-mono text-sm min-h-[200px]"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Instructions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>How to Use in SugarCRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>For SugarCRM Custom Button:</strong><br/>
              1. Go to Admin → Studio → [Module] → Layouts → Detail View<br/>
              2. Add a new button with this JavaScript code:
            </AlertDescription>
          </Alert>

          <Textarea
            readOnly
            value={`var recordId = app.controller.context.get('model').get('id');
var templateId = '${templateId || 'YOUR_TEMPLATE_ID'}'; // Replace with your template ID
var url = '${window.location.origin}/api/create-doc?' +
  'record_id=' + recordId +
  '&module=${module}' +
  '&tenant_id=${tenantId}' +
  '&template_id=' + templateId;

window.open(url, '_blank');`}
            className="font-mono text-sm min-h-[120px]"
          />

          <Alert>
            <AlertDescription>
              <strong>For HTML Button (outside SugarCRM):</strong><br/>
              Use the generated URL above and replace the record_id parameter with your actual record ID.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}