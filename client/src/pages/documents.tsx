import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FileText, Plus, ExternalLink, Send } from "lucide-react";
import type { Tenant, Document } from "@shared/schema";

interface CreateDocumentForm {
  tenantId: string;
  sugarRecordId: string;
  sugarModule: string;
  templateId: string;
  name?: string;
  recipients: Array<{
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  }>;
  tokens: Array<{
    name: string;
    value: string;
  }>;
  sendImmediately: boolean;
  subject?: string;
  message?: string;
}

export default function DocumentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateDocumentForm>({
    tenantId: "",
    sugarRecordId: "",
    sugarModule: "Opportunities",
    templateId: "",
    recipients: [{ email: "", first_name: "", last_name: "", role: "Signer" }],
    tokens: [{ name: "", value: "" }],
    sendImmediately: false
  });

  // Fetch tenants
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  // Fetch documents for selected tenant
  const { data: documents = [], isLoading: documentsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", selectedTenant],
    enabled: !!selectedTenant,
  });

  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (data: CreateDocumentForm) => {
      const response = await fetch("/api/documents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create document");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Document Created",
        description: `Document "${data.document.name}" has been created successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setShowCreateForm(false);
      setFormData({
        tenantId: "",
        sugarRecordId: "",
        sugarModule: "Opportunities",
        templateId: "",
        recipients: [{ email: "", first_name: "", last_name: "", role: "Signer" }],
        tokens: [{ name: "", value: "" }],
        sendImmediately: false
      });
    },
    onError: (error: any) => {
      toast({
        title: "Document Creation Failed",
        description: error.error || "Failed to create document. Please check your configuration.",
        variant: "destructive",
      });
    },
  });

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, { email: "", first_name: "", last_name: "", role: "Signer" }]
    }));
  };

  const addToken = () => {
    setFormData(prev => ({
      ...prev,
      tokens: [...prev.tokens, { name: "", value: "" }]
    }));
  };

  const updateRecipient = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((r, i) => 
        i === index ? { ...r, [field]: value } : r
      )
    }));
  };

  const updateToken = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      tokens: prev.tokens.map((t, i) => 
        i === index ? { ...t, [field]: value } : t
      )
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.tenantId || !formData.sugarRecordId || !formData.templateId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Filter out empty recipients
    const validRecipients = formData.recipients.filter(r => 
      r.email && r.first_name && r.last_name
    );

    if (validRecipients.length === 0) {
      toast({
        title: "Validation Error", 
        description: "At least one recipient is required.",
        variant: "destructive",
      });
      return;
    }

    // Filter out empty tokens
    const validTokens = formData.tokens.filter(t => t.name && t.value);

    createDocumentMutation.mutate({
      ...formData,
      recipients: validRecipients,
      tokens: validTokens
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "document.uploaded": "secondary",
      "document.draft": "outline", 
      "document.sent": "default",
      "document.completed": "default",
      "document.cancelled": "destructive"
    };
    
    return (
      <Badge variant={statusColors[status] || "outline"}>
        {status.replace('document.', '')}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">
            Create PandaDoc documents from SugarCRM records and manage document lifecycle
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Document
        </Button>
      </div>

      {/* Tenant Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Tenant</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a tenant to view documents" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.id} value={tenant.id}>
                  {tenant.name} {!tenant.isActive && "(Inactive)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Documents List */}
      {selectedTenant && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {documentsLoading ? (
              <div>Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No documents found for this tenant. Create your first document to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Sugar Module</TableHead>
                    <TableHead>Sugar Record</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">{doc.name}</TableCell>
                      <TableCell>{doc.sugarModule}</TableCell>
                      <TableCell>{doc.sugarRecordId}</TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell>
                        {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        {doc.publicUrl && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            asChild
                          >
                            <a 
                              href={doc.publicUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              View
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Document Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Document</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tenant">Tenant *</Label>
                  <Select value={formData.tenantId} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, tenantId: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants.filter(t => t.isActive).map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sugarModule">SugarCRM Module *</Label>
                  <Select value={formData.sugarModule} onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, sugarModule: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Opportunities">Opportunities</SelectItem>
                      <SelectItem value="Contacts">Contacts</SelectItem>
                      <SelectItem value="Accounts">Accounts</SelectItem>
                      <SelectItem value="Leads">Leads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sugarRecordId">SugarCRM Record ID *</Label>
                  <Input
                    id="sugarRecordId"
                    value={formData.sugarRecordId}
                    onChange={(e) => setFormData(prev => ({ ...prev, sugarRecordId: e.target.value }))}
                    placeholder="Enter SugarCRM record ID"
                  />
                </div>

                <div>
                  <Label htmlFor="templateId">PandaDoc Template ID *</Label>
                  <Input
                    id="templateId"
                    value={formData.templateId}
                    onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                    placeholder="Enter PandaDoc template UUID"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="name">Document Name (Optional)</Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Leave blank to auto-generate from SugarCRM data"
                  />
                </div>
              </div>

              {/* Recipients */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Recipients *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Recipient
                  </Button>
                </div>
                <div className="space-y-3">
                  {formData.recipients.map((recipient, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded">
                      <Input
                        placeholder="Email *"
                        value={recipient.email}
                        onChange={(e) => updateRecipient(index, "email", e.target.value)}
                      />
                      <Input
                        placeholder="First Name *"
                        value={recipient.first_name}
                        onChange={(e) => updateRecipient(index, "first_name", e.target.value)}
                      />
                      <Input
                        placeholder="Last Name *"
                        value={recipient.last_name}
                        onChange={(e) => updateRecipient(index, "last_name", e.target.value)}
                      />
                      <Select value={recipient.role} onValueChange={(value) => updateRecipient(index, "role", value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Signer">Signer</SelectItem>
                          <SelectItem value="Approver">Approver</SelectItem>
                          <SelectItem value="CC">CC</SelectItem>
                          <SelectItem value="Viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tokens */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Template Tokens (Optional)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addToken}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Token
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.tokens.map((token, index) => (
                    <div key={index} className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Token name (e.g., ClientName)"
                        value={token.name}
                        onChange={(e) => updateToken(index, "name", e.target.value)}
                      />
                      <Input
                        placeholder="Token value"
                        value={token.value}
                        onChange={(e) => updateToken(index, "value", e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Send Options */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sendImmediately"
                    checked={formData.sendImmediately}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, sendImmediately: checked }))}
                  />
                  <Label htmlFor="sendImmediately">Send document immediately after creation</Label>
                </div>

                {formData.sendImmediately && (
                  <div className="grid grid-cols-1 gap-4 pl-6">
                    <div>
                      <Label htmlFor="subject">Email Subject</Label>
                      <Input
                        id="subject"
                        value={formData.subject || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Please review and sign this document"
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Email Message</Label>
                      <Textarea
                        id="message"
                        value={formData.message || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                        placeholder="Please review and sign the attached document."
                        rows={3}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={createDocumentMutation.isPending}
                  className="gap-2"
                >
                  {createDocumentMutation.isPending ? (
                    "Creating..."
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Create Document
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}