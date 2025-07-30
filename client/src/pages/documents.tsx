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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Plus, Edit, Trash2, Copy, Settings } from "lucide-react";
import type { Tenant, DocumentTemplate, InsertDocumentTemplate } from "@shared/schema";

export default function DocumentTemplatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>("");
  
  const [formData, setFormData] = useState<Partial<InsertDocumentTemplate>>({
    tenantId: "",
    name: "",
    sugarModule: "Opportunities",
    pandaDocTemplateId: "",
    folderUuid: "",
    tags: [],
    detectTitleVariables: true,
    defaultRecipients: [],
    tokenMappings: [],
    fieldMappings: [],
    isActive: true,
    isDefault: false
  });

  // Fetch tenants
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  // Fetch document templates for selected tenant
  const { data: templates = [], isLoading: templatesLoading, refetch: refetchTemplates } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates", selectedTenant, moduleFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ tenantId: selectedTenant });
      if (moduleFilter) {
        params.append('module', moduleFilter);
      }
      const response = await fetch(`/api/document-templates?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json();
    },
    enabled: !!selectedTenant,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: InsertDocumentTemplate) => {
      const response = await fetch("/api/document-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Document template created successfully" });
      setShowCreateForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create template",
        variant: "destructive" 
      });
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertDocumentTemplate> }) => {
      const response = await fetch(`/api/document-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update template");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Document template updated successfully" });
      setEditingTemplate(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update template",
        variant: "destructive" 
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/document-templates/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete template");
      }
      return null;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Document template deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to delete template",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      tenantId: "",
      name: "",
      sugarModule: "Opportunities",
      pandaDocTemplateId: "",
      folderUuid: "",
      tags: [],
      detectTitleVariables: true,
      defaultRecipients: [],
      tokenMappings: [],
      fieldMappings: [],
      isActive: true,
      isDefault: false
    });
  };

  const openCreateForm = () => {
    resetForm();
    setFormData(prev => ({ ...prev, tenantId: selectedTenant }));
    setShowCreateForm(true);
  };

  const openEditForm = (template: DocumentTemplate) => {
    setFormData({
      tenantId: template.tenantId,
      name: template.name,
      sugarModule: template.sugarModule,
      pandaDocTemplateId: template.pandaDocTemplateId,
      folderUuid: template.folderUuid,
      tags: template.tags,
      detectTitleVariables: template.detectTitleVariables,
      defaultRecipients: template.defaultRecipients,
      tokenMappings: template.tokenMappings,
      fieldMappings: template.fieldMappings,
      isActive: template.isActive,
      isDefault: template.isDefault
    });
    setEditingTemplate(template);
    setShowCreateForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.tenantId || !formData.pandaDocTemplateId) {
      toast({ 
        title: "Error", 
        description: "Please fill in all required fields",
        variant: "destructive" 
      });
      return;
    }

    if (editingTemplate) {
      updateTemplateMutation.mutate({ 
        id: editingTemplate.id, 
        data: formData as InsertDocumentTemplate 
      });
    } else {
      createTemplateMutation.mutate(formData as InsertDocumentTemplate);
    }
  };

  const duplicateTemplate = (template: DocumentTemplate) => {
    setFormData({
      tenantId: template.tenantId,
      name: `${template.name} (Copy)`,
      sugarModule: template.sugarModule,
      pandaDocTemplateId: template.pandaDocTemplateId,
      folderUuid: template.folderUuid,
      tags: template.tags,
      detectTitleVariables: template.detectTitleVariables,
      defaultRecipients: template.defaultRecipients,
      tokenMappings: template.tokenMappings,
      fieldMappings: template.fieldMappings,
      isActive: template.isActive,
      isDefault: false // Don't copy default status
    });
    setEditingTemplate(null);
    setShowCreateForm(true);
  };

  const modules = ["Opportunities", "Contacts", "Accounts", "Leads", "Tasks", "Calls", "Meetings"];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">Document Templates</h1>
          </div>
          <Button onClick={openCreateForm} disabled={!selectedTenant}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>

        <p className="text-muted-foreground">
          Manage reusable document creation templates for automatic PandaDoc document generation from SugarCRM records.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tenant-select">Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="module-filter">SugarCRM Module</Label>
              <Select value={moduleFilter || "all"} onValueChange={(value) => setModuleFilter(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((module) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      {selectedTenant && (
        <Card>
          <CardHeader>
            <CardTitle>Document Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {templatesLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-muted-foreground">Loading templates...</div>
              </div>
            ) : templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium">No Templates Found</h3>
                  <p className="text-muted-foreground">
                    Create your first document template to get started.
                  </p>
                </div>
                <Button onClick={openCreateForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Template
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>PandaDoc Template</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{template.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {template.isDefault ? "Default template" : "Custom template"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{template.sugarModule}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {template.pandaDocTemplateId}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={template.isActive ? "default" : "secondary"}>
                          {template.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditForm(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateTemplate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Document Template"}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Contract Template"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sugarModule">SugarCRM Module *</Label>
                <Select 
                  value={formData.sugarModule || ""} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, sugarModule: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select module" />
                  </SelectTrigger>
                  <SelectContent>
                    {modules.map((module) => (
                      <SelectItem key={module} value={module}>
                        {module}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="folderUuid">PandaDoc Folder UUID (Optional)</Label>
              <Input
                id="folderUuid"
                value={formData.folderUuid || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, folderUuid: e.target.value }))}
                placeholder="Optional folder UUID for organizing documents"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pandaDocTemplateId">PandaDoc Template ID *</Label>
              <Input
                id="pandaDocTemplateId"
                value={formData.pandaDocTemplateId || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, pandaDocTemplateId: e.target.value }))}
                placeholder="e.g., ABC123XYZ"
                required
              />
              <p className="text-sm text-muted-foreground">
                The PandaDoc template ID to use for document creation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="detectTitleVariables">Detect Title Variables</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect variables in document title
                  </p>
                </div>
                <Switch
                  id="detectTitleVariables"
                  checked={formData.detectTitleVariables ?? true}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, detectTitleVariables: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isDefault">Default Template</Label>
                  <p className="text-sm text-muted-foreground">
                    Use as default for this module
                  </p>
                </div>
                <Switch
                  id="isDefault"
                  checked={formData.isDefault || false}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Configuration</Label>
              <p className="text-sm text-muted-foreground">
                Recipients, token mappings, and field mappings can be configured after creating the template.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Template</Label>
                <p className="text-sm text-muted-foreground">
                  Available for document creation
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive ?? true}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false);
                  setEditingTemplate(null);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              >
                {editingTemplate ? "Update Template" : "Create Template"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}