import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Plus, Edit, Trash2, Copy, Settings, Code2 } from "lucide-react";
import type { Tenant, DocumentTemplate, InsertDocumentTemplate } from "@shared/schema";

export default function PDRequestsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [configMode, setConfigMode] = useState<'visual' | 'conditions' | 'json'>('visual');
  const [jsonConfig, setJsonConfig] = useState("");
  
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
    generationConditions: [],
    requireAllConditions: true,
    customConditionsScript: "",
    skipIfDocumentExists: true,
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

  // Fetch field mappings for auto-populating token mappings
  const { data: fieldMappings = [] } = useQuery({
    queryKey: ["/api/field-mappings", selectedTenant, formData.sugarModule],
    queryFn: async () => {
      if (!selectedTenant || !formData.sugarModule) return [];
      const response = await fetch(`/api/field-mappings?tenantId=${selectedTenant}&module=${formData.sugarModule}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedTenant && !!formData.sugarModule,
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
      generationConditions: [],
      requireAllConditions: true,
      customConditionsScript: "",
      skipIfDocumentExists: true,
      isActive: true,
      isDefault: false
    });
    setJsonConfig("");
    setConfigMode('visual');
  };

  const openCreateForm = () => {
    resetForm();
    const autoTokenMappings = fieldMappings.map((mapping: any) => ({
      sugar_field: mapping.sugarField,
      panda_doc_token: mapping.pandaDocToken.replace(/[{}]/g, '') // Remove {{ }} brackets
    }));
    
    setFormData(prev => ({ 
      ...prev, 
      tenantId: selectedTenant,
      tokenMappings: autoTokenMappings
    }));
    setShowCreateForm(true);
  };

  const handleInputChange = (field: keyof InsertDocumentTemplate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-populate token mappings when module changes
    if (field === 'sugarModule' && fieldMappings.length > 0 && !editingTemplate) {
      const moduleFieldMappings = fieldMappings.filter((mapping: any) => 
        mapping.sugarModule.toLowerCase() === value.toLowerCase()
      );
      if (moduleFieldMappings.length > 0) {
        const autoTokenMappings = moduleFieldMappings.map((mapping: any) => ({
          sugar_field: mapping.sugarField,
          panda_doc_token: mapping.pandaDocToken.replace(/[{}]/g, '')
        }));
        setFormData(prev => ({ ...prev, tokenMappings: autoTokenMappings }));
      } else {
        // Clear token mappings if no field mappings exist for this module
        setFormData(prev => ({ ...prev, tokenMappings: [] }));
      }
    }
  };

  // Auto-populate token mappings when field mappings are available and module matches
  useEffect(() => {
    if (fieldMappings.length > 0 && formData.sugarModule && showCreateForm && !editingTemplate) {
      const moduleFieldMappings = fieldMappings.filter((mapping: any) => 
        mapping.sugarModule.toLowerCase() === formData.sugarModule.toLowerCase()
      );
      if (moduleFieldMappings.length > 0) {
        const autoTokenMappings = moduleFieldMappings.map((mapping: any) => ({
          sugar_field: mapping.sugarField,
          panda_doc_token: mapping.pandaDocToken.replace(/[{}]/g, '')
        }));
        setFormData(prev => ({ ...prev, tokenMappings: autoTokenMappings }));
      }
    }
  }, [fieldMappings, formData.sugarModule, showCreateForm, editingTemplate]);

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
    setJsonConfig(JSON.stringify(template, null, 2));
    setShowCreateForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let submitData = formData;
    
    if (configMode === 'json') {
      try {
        const parsedConfig = JSON.parse(jsonConfig);
        submitData = parsedConfig;
      } catch (error) {
        toast({ 
          title: "Error", 
          description: "Invalid JSON configuration. Please check your syntax.",
          variant: "destructive" 
        });
        return;
      }
    }
    
    if (!submitData.name || !submitData.tenantId || !submitData.pandaDocTemplateId) {
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
        data: submitData as InsertDocumentTemplate 
      });
    } else {
      createTemplateMutation.mutate(submitData as InsertDocumentTemplate);
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
            <h1 className="text-2xl font-bold">PD Requests</h1>
          </div>
          <Button onClick={openCreateForm} disabled={!selectedTenant}>
            <Plus className="h-4 w-4 mr-2" />
            Create Request
          </Button>
        </div>

        <p className="text-muted-foreground">
          Create requests for automatic PandaDoc document generation from SugarCRM records.
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
            <CardTitle>Create Requests</CardTitle>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Request Template" : "Create Request Template"}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={configMode} onValueChange={(value) => setConfigMode(value as 'visual' | 'conditions' | 'json')} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Basic Config
              </TabsTrigger>
              <TabsTrigger value="conditions" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Conditions
              </TabsTrigger>
              <TabsTrigger value="json" className="flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                JSON Config
              </TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto max-h-[calc(90vh-10rem)] pr-2">
              <TabsContent value="visual" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Request Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Contract Request"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sugarModule">SugarCRM Module *</Label>
                <Select 
                  value={formData.sugarModule || ""} 
                  onValueChange={(value) => handleInputChange('sugarModule', value)}
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
                  <Label htmlFor="isDefault">Default Request</Label>
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

            {/* Default Recipients Configuration */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Recipients</Label>
                <p className="text-sm text-muted-foreground">
                  Configure default recipients for documents created from this template.
                </p>
                <div className="space-y-2">
                  {(formData.defaultRecipients as any[])?.map((recipient: any, index: number) => (
                    <div key={index} className="flex items-center space-x-2 p-3 border rounded">
                      <Input
                        placeholder="Email address"
                        value={recipient.email || ""}
                        onChange={(e) => {
                          const newRecipients = [...(formData.defaultRecipients as any[] || [])];
                          newRecipients[index] = { ...recipient, email: e.target.value };
                          setFormData(prev => ({ ...prev, defaultRecipients: newRecipients }));
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Role (e.g., signer)"
                        value={recipient.role || "signer"}
                        onChange={(e) => {
                          const newRecipients = [...(formData.defaultRecipients as any[] || [])];
                          newRecipients[index] = { ...recipient, role: e.target.value };
                          setFormData(prev => ({ ...prev, defaultRecipients: newRecipients }));
                        }}
                        className="w-32"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newRecipients = (formData.defaultRecipients as any[] || []).filter((_, i) => i !== index);
                          setFormData(prev => ({ ...prev, defaultRecipients: newRecipients }));
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newRecipients = [...(formData.defaultRecipients as any[] || []), { email: "", role: "signer" }];
                      setFormData(prev => ({ ...prev, defaultRecipients: newRecipients }));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Recipient
                  </Button>
                </div>
              </div>

              {/* Field Mapping Reference */}
              <div className="space-y-2">
                <Label>SugarCRM to PandaDoc Token Mapping</Label>
                <div className="p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-3">
                    Configure how SugarCRM fields map to PandaDoc tokens for this request. 
                    Field mappings are managed separately and support multiple module types with dynamic value resolution.
                  </p>
                  <div className="flex items-center space-x-2">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Manage field mappings in the Field Mapping section</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Field mappings automatically resolve values from SugarCRM records and related records, 
                    then map them to PandaDoc tokens for document creation.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active Request</Label>
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
              </TabsContent>

              <TabsContent value="conditions" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Document Generation Conditions</Label>
                    <p className="text-sm text-muted-foreground">
                      Set conditions that must be met before a document is generated. This helps prevent unnecessary document creation.
                    </p>
                  </div>

                  {/* Condition Logic Type */}
                  <div className="space-y-2">
                    <Label>Condition Logic</Label>
                    <Select 
                      value={formData.requireAllConditions ? "all" : "any"} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, requireAllConditions: value === "all" }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ALL conditions must be met (AND)</SelectItem>
                        <SelectItem value="any">ANY condition can be met (OR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Generation Conditions */}
                  <div className="space-y-3">
                    <Label>Conditions</Label>
                    {(formData.generationConditions as any[] || []).map((condition: any, index: number) => (
                      <div key={index} className="grid grid-cols-4 gap-2 p-3 border rounded">
                        <Select 
                          value={condition.field || ""} 
                          onValueChange={(value) => {
                            const newConditions = [...(formData.generationConditions as any[] || [])];
                            newConditions[index] = { ...newConditions[index], field: value };
                            setFormData(prev => ({ ...prev, generationConditions: newConditions }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="sales_stage">Sales Stage</SelectItem>
                            <SelectItem value="probability">Probability</SelectItem>
                            <SelectItem value="assigned_user_id">Assigned User</SelectItem>
                            <SelectItem value="date_closed">Close Date</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select 
                          value={condition.operator || ""} 
                          onValueChange={(value) => {
                            const newConditions = [...(formData.generationConditions as any[] || [])];
                            newConditions[index] = { ...newConditions[index], operator: value };
                            setFormData(prev => ({ ...prev, generationConditions: newConditions }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="not_equals">Not Equals</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="not_empty">Not Empty</SelectItem>
                            <SelectItem value="empty">Empty</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Input
                          placeholder="Value"
                          value={condition.value || ""}
                          onChange={(e) => {
                            const newConditions = [...(formData.generationConditions as any[] || [])];
                            newConditions[index] = { ...newConditions[index], value: e.target.value };
                            setFormData(prev => ({ ...prev, generationConditions: newConditions }));
                          }}
                        />
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newConditions = (formData.generationConditions as any[] || []).filter((_, i) => i !== index);
                            setFormData(prev => ({ ...prev, generationConditions: newConditions }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newConditions = [...(formData.generationConditions as any[] || []), { field: "", operator: "", value: "" }];
                        setFormData(prev => ({ ...prev, generationConditions: newConditions }));
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Condition
                    </Button>
                  </div>

                  {/* Advanced Options */}
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="skipIfDocumentExists">Skip if Document Exists</Label>
                        <p className="text-sm text-muted-foreground">
                          Prevent creating duplicate documents for the same record
                        </p>
                      </div>
                      <Switch
                        id="skipIfDocumentExists"
                        checked={formData.skipIfDocumentExists ?? true}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, skipIfDocumentExists: checked }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customConditionsScript">Custom JavaScript (Advanced)</Label>
                      <Textarea
                        id="customConditionsScript"
                        value={formData.customConditionsScript || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, customConditionsScript: e.target.value }))}
                        placeholder={`// Custom condition logic
// Return true to generate document, false to skip
// Available variables: record, tenant, template
if (record.amount > 1000 && record.sales_stage === "Closed Won") {
  return true;
}
return false;`}
                        className="min-h-[120px] font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Optional: Write custom JavaScript for complex conditions. Leave empty to use basic conditions above.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="json" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>JSON Configuration</Label>
                    <p className="text-sm text-muted-foreground">
                      Advanced configuration using JSON format. Use this when the visual form doesn't meet your requirements.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Textarea
                      value={jsonConfig}
                      onChange={(e) => setJsonConfig(e.target.value)}
                      placeholder={`{
  "tenantId": "tenant-id",
  "name": "Request Name",
  "sugarModule": "Opportunities",
  "pandaDocTemplateId": "template-uuid",
  "folderUuid": "",
  "tags": [],
  "detectTitleVariables": true,
  "defaultRecipients": [
    {
      "email": "user@example.com",
      "role": "signer"
    }
  ],
  "tokenMappings": [],
  "fieldMappings": [],
  "isActive": true,
  "isDefault": false
}`}
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>
                </div>
              </TabsContent>

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
                  {editingTemplate ? "Update Request" : "Create Request"}
                </Button>
              </div>
            </form>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}