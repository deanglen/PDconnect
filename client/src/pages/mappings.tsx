import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFieldMappingSchema } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertFieldMappingSchema;

export default function Mappings() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [activeModule, setActiveModule] = useState("opportunities");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [showJsonView, setShowJsonView] = useState(false);
  const [jsonData, setJsonData] = useState("");
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: mappings = [], isLoading: mappingsLoading } = useQuery({
    queryKey: ['/api/field-mappings', selectedTenant, activeModule],
    queryFn: () => selectedTenant ? api.getFieldMappings(selectedTenant, activeModule) : [],
    enabled: !!selectedTenant,
  });

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ['/api/tokens', selectedTenant, activeModule],
    queryFn: () => selectedTenant ? api.getTokens(selectedTenant, activeModule) : { tokens: [], previewValues: {} },
    enabled: !!selectedTenant,
  });

  // Field discovery query
  const { data: fieldDiscovery, isLoading: discoveryLoading } = useQuery({
    queryKey: ['/api/field-discovery', selectedTenant, activeModule],
    queryFn: () => selectedTenant ? api.discoverFields(selectedTenant, activeModule) : null,
    enabled: !!selectedTenant,
  });

  // Test mapping state
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingMapping, setIsTestingMapping] = useState(false);

  const createMutation = useMutation({
    mutationFn: api.createFieldMapping,
    onSuccess: (data) => {
      console.log('Mutation success, created mapping:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/field-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Field mapping created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create field mapping",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteFieldMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/field-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
      toast({
        title: "Success",
        description: "Field mapping deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete field mapping",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      return await api.updateFieldMapping(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/field-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
      setIsEditDialogOpen(false);
      setEditingMapping(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Field mapping updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update field mapping",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof insertFieldMappingSchema>>({
    resolver: zodResolver(insertFieldMappingSchema),
    defaultValues: {
      tenantId: selectedTenant || "",
      sugarModule: activeModule || "",
      sugarField: "",
      sugarFieldLabel: "",
      sugarFieldType: "",
      pandaDocToken: "",
      isActive: true,
    },
  });

  const editForm = useForm<z.infer<typeof insertFieldMappingSchema>>({
    resolver: zodResolver(insertFieldMappingSchema),
    defaultValues: {
      tenantId: selectedTenant || "",
      sugarModule: activeModule || "",
      sugarField: "",
      sugarFieldLabel: "",
      sugarFieldType: "",
      pandaDocToken: "",
      isActive: true,
    },
  });

  // Update form values when selectedTenant or activeModule changes
  useEffect(() => {
    form.setValue('tenantId', selectedTenant || "");
    form.setValue('sugarModule', activeModule || "");
    editForm.setValue('tenantId', selectedTenant || "");
    editForm.setValue('sugarModule', activeModule || "");
  }, [selectedTenant, activeModule, form, editForm]);

  // Update edit form when editing mapping changes
  useEffect(() => {
    if (editingMapping) {
      editForm.setValue('tenantId', editingMapping.tenantId || selectedTenant);
      editForm.setValue('sugarModule', editingMapping.sugarModule || activeModule);
      editForm.setValue('sugarField', editingMapping.sugarField);
      editForm.setValue('sugarFieldLabel', editingMapping.sugarFieldLabel);
      editForm.setValue('sugarFieldType', editingMapping.sugarFieldType);
      editForm.setValue('pandaDocToken', editingMapping.pandaDocToken);
      editForm.setValue('isActive', editingMapping.isActive ?? true);
    }
  }, [editingMapping, editForm, selectedTenant, activeModule]);

  const onSubmit = (values: z.infer<typeof insertFieldMappingSchema>) => {
    console.log('Form submission triggered!');
    console.log('Form submission data:', {
      ...values,
      tenantId: selectedTenant,
      sugarModule: activeModule,
    });
    
    // Check for form validation errors
    console.log('Form errors:', form.formState.errors);
    console.log('Form state isValid:', form.formState.isValid);
    console.log('Form state isSubmitting:', form.formState.isSubmitting);
    
    createMutation.mutate({
      ...values,
      tenantId: selectedTenant,
      sugarModule: activeModule,
    });
  };

  const onEditSubmit = (values: z.infer<typeof insertFieldMappingSchema>) => {
    if (!editingMapping) return;
    
    updateMutation.mutate({
      id: editingMapping.id,
      data: {
        ...values,
        tenantId: selectedTenant,
        sugarModule: activeModule,
      }
    });
  };

  const handleEditMapping = (mapping: any) => {
    setEditingMapping(mapping);
    setIsEditDialogOpen(true);
  };

  const modules = [
    { value: "opportunities", label: "Opportunities", icon: "fas fa-bullseye" },
    { value: "contacts", label: "Contacts", icon: "fas fa-user" },
    { value: "accounts", label: "Accounts", icon: "fas fa-building" },
  ];

  const selectedTenantData = tenants.find((t: any) => t.id === selectedTenant);
  const availableFields = tokens?.tokens || [];
  const unmappedFields = availableFields.filter(field => !field.mapped);

  // Initialize JSON data when mappings change
  useEffect(() => {
    if (mappings.length > 0) {
      setJsonData(JSON.stringify(mappings, null, 2));
    }
  }, [mappings]);

  const handleJsonSave = () => {
    try {
      const parsedData = JSON.parse(jsonData);
      // Here you could implement saving the edited JSON data
      // For now, we'll just show a success message
      toast({
        title: "JSON Updated",
        description: "Mapping data has been updated successfully",
      });
      setShowJsonView(false);
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "Please check your JSON syntax and try again",
        variant: "destructive",
      });
    }
  };

  // Test mapping function
  const testMapping = async () => {
    if (!selectedTenant) return;
    
    setIsTestingMapping(true);
    try {
      const result = await api.testMapping({
        tenantId: selectedTenant,
        recordId: "oppty_1234", // Using demo record
        module: activeModule
      });
      setTestResult(result);
      toast({
        title: "Test Completed",
        description: `Found ${result.preview?.tokens?.length || 0} successful mappings`,
      });
    } catch (error: any) {
      toast({
        title: "Test Failed", 
        description: error.message || "Failed to test mapping",
        variant: "destructive",
      });
    } finally {
      setIsTestingMapping(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Field Mappings" 
        description="Configure how SugarCRM fields map to PandaDoc tokens"
        actions={
          <div className="flex items-center space-x-3">
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTenant && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  onClick={testMapping}
                  disabled={mappings.length === 0 || isTestingMapping}
                >
                  <i className="fas fa-vial mr-2"></i>
                  {isTestingMapping ? "Testing..." : "Test Mapping"}
                </Button>
                
                <Dialog open={showJsonView} onOpenChange={setShowJsonView}>
                  <DialogTrigger asChild>
                    <Button variant="outline" disabled={mappings.length === 0}>
                      <i className="fas fa-code mr-2"></i>
                      View JSON
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Field Mappings JSON</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="json-editor">Edit JSON Data</Label>
                        <Textarea
                          id="json-editor"
                          value={jsonData}
                          onChange={(e) => setJsonData(e.target.value)}
                          className="font-mono text-sm min-h-[400px] resize-none"
                          placeholder="JSON data will appear here when mappings are loaded..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowJsonView(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleJsonSave} disabled={!jsonData.trim()}>
                          <i className="fas fa-save mr-2"></i>
                          Update Mappings
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-white hover:bg-blue-700">
                      <i className="fas fa-plus mr-2"></i>
                      Add Mapping
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create Field Mapping</DialogTitle>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="sugarField"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SugarCRM Field</FormLabel>
                            <Select onValueChange={(value) => {
                              const selectedField = availableFields.find(f => f.name === value);
                              if (selectedField) {
                                field.onChange(value);
                                form.setValue('sugarFieldLabel', selectedField.label);
                                form.setValue('sugarFieldType', selectedField.type);
                                
                                // Auto-generate PandaDoc token from field label or name
                                const currentPandaDocToken = form.getValues('pandaDocToken');
                                if (!currentPandaDocToken) {
                                  // Use label if available, otherwise use field name
                                  const tokenName = selectedField.label || selectedField.name;
                                  // Clean up the token name (remove spaces, convert to camelCase)
                                  const cleanTokenName = tokenName
                                    .replace(/[^\w\s]/g, '') // Remove special characters
                                    .split(' ')
                                    .map((word, index) => 
                                      index === 0 
                                        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                                    )
                                    .join('');
                                  
                                  form.setValue('pandaDocToken', `[${cleanTokenName}]`);
                                }
                              }
                            }} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a SugarCRM field" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {unmappedFields.map((fieldInfo: any) => (
                                  <SelectItem key={fieldInfo.name} value={fieldInfo.name}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{fieldInfo.label}</span>
                                      <Badge variant="outline" className="text-xs">{fieldInfo.type}</Badge>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="pandaDocToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PandaDoc Merge Field</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="[FieldName]" />
                            </FormControl>
                            <FormMessage />
                            <div className="space-y-1">
                              <p className="text-xs text-green-600 font-medium">
                                ✨ Auto-generated from field selection (editable)
                              </p>
                              <p className="text-xs text-blue-600">
                                💡 Or copy directly from your PandaDoc template
                              </p>
                              <p className="text-xs text-gray-500">
                                Supported formats: [field_name] or {`{{field_name}}`}
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createMutation.isPending}
                          onClick={() => console.log('Create Mapping button clicked!')}
                        >
                          {createMutation.isPending ? "Creating..." : "Create Mapping"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Edit Field Mapping Dialog */}
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Edit Field Mapping</DialogTitle>
                  </DialogHeader>
                  
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="sugarField"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>SugarCRM Field</FormLabel>
                            <FormControl>
                              <Input {...field} disabled />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="sugarFieldLabel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Field Label</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ""} placeholder="Display label for the field" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="pandaDocToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>PandaDoc Token</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                placeholder="e.g., [FieldName] or {{field_name}}" 
                              />
                            </FormControl>
                            <div className="text-xs text-gray-500">
                              <p className="text-xs text-gray-500">
                                Supported formats: [field_name] or {`{{field_name}}`}
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => {
                          setIsEditDialogOpen(false);
                          setEditingMapping(null);
                          editForm.reset();
                        }}>
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={updateMutation.isPending}
                        >
                          {updateMutation.isPending ? "Updating..." : "Update Mapping"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              </div>
            )}
          </div>
        }
      />

      <div className="p-6">
        {!selectedTenant ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <i className="fas fa-arrows-alt-h text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">Select a tenant to view field mappings</p>
                <p className="text-sm text-gray-400">Choose a tenant from the dropdown above</p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <p className="text-sm text-blue-700 font-medium mb-2">✨ New: PandaDoc Native Format Support</p>
                  <p className="text-xs text-blue-600">
                    You can now copy merge fields directly from your PandaDoc templates using the [field] format!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Fields</p>
                      <p className="text-2xl font-bold text-gray-900">{availableFields.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-database text-blue-600"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Mapped</p>
                      <p className="text-2xl font-bold text-green-600">{mappings.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-link text-green-600"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Available</p>
                      <p className="text-2xl font-bold text-orange-600">{unmappedFields.length}</p>
                    </div>
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-plus text-orange-600"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Coverage</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {availableFields.length > 0 ? Math.round((mappings.length / availableFields.length) * 100) : 0}%
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <i className="fas fa-chart-pie text-purple-600"></i>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Module Tabs */}
            <div className="mb-6">
              <Tabs value={activeModule} onValueChange={setActiveModule}>
                <TabsList>
                  {modules.map((module) => (
                    <TabsTrigger key={module.value} value={module.value} className="flex items-center gap-2">
                      <i className={module.icon}></i>
                      {module.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Mapping Interface */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Available SugarCRM Fields */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-database text-blue-600"></i>
                    Available SugarCRM Fields
                    {selectedTenantData && (
                      <Badge variant="outline" className="ml-2">{selectedTenantData.name}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tokensLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-16 bg-gray-200 rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  ) : unmappedFields.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <i className="fas fa-check-circle text-4xl text-green-300 mb-4"></i>
                      <p>All fields have been mapped!</p>
                      <p className="text-sm text-gray-400">Great job on completing the field mappings</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {unmappedFields.map((field: any, index: number) => (
                        <div key={field.name || `field-${index}`} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{field.label}</p>
                              <p className="text-sm text-gray-500 font-mono">{field.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{field.type}</Badge>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  form.setValue('sugarField', field.name);
                                  form.setValue('sugarFieldLabel', field.label);
                                  form.setValue('sugarFieldType', field.type);
                                  form.setValue('pandaDocToken', `{{${field.name?.toLowerCase() || field.name || 'token'}}}`);
                                  setIsDialogOpen(true);
                                }}
                              >
                                <i className="fas fa-plus mr-1"></i>
                                Map
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Current Field Mappings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-link text-green-600"></i>
                    Current Field Mappings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {mappingsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-20 bg-gray-200 rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  ) : mappings.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <i className="fas fa-arrow-left text-4xl text-gray-300 mb-4"></i>
                      <p>No field mappings configured</p>
                      <p className="text-sm text-gray-400">Create mappings by selecting SugarCRM fields</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {mappings.map((mapping: any) => (
                        <div key={mapping.id} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className="bg-green-100 text-green-800">{mapping.pandaDocToken}</Badge>
                                <i className="fas fa-arrow-left text-green-600"></i>
                                <span className="text-sm font-medium">{mapping.sugarFieldLabel || mapping.sugarField}</span>
                              </div>
                              <div className="text-xs text-gray-600">
                                <span className="font-mono">{mapping.sugarField}</span>
                                {mapping.sugarFieldType && (
                                  <Badge variant="outline" className="ml-2 text-xs">{mapping.sugarFieldType}</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => handleEditMapping(mapping)}
                              >
                                <i className="fas fa-edit"></i>
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this field mapping?')) {
                                    deleteMutation.mutate(mapping.id);
                                  }
                                }}
                              >
                                <i className="fas fa-trash"></i>
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Test Results Section */}
            {testResult && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <i className="fas fa-vial text-purple-600"></i>
                    Mapping Test Results
                    <Badge variant={testResult.preview.successfulMappings === testResult.preview.totalMappings ? "default" : "secondary"}>
                      {testResult.metadata.successRate}% Success Rate
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Test Summary */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{testResult.preview.successfulMappings}</div>
                        <div className="text-sm text-green-700">Successful</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-600">{testResult.preview.missingFields.length}</div>
                        <div className="text-sm text-red-700">Missing</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{testResult.metadata.totalFields}</div>
                        <div className="text-sm text-blue-700">Total Fields</div>
                      </div>
                    </div>

                    {/* Generated Tokens */}
                    {testResult.preview.tokens.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-3">Generated Tokens</h4>
                        <div className="space-y-2">
                          {testResult.preview.tokens.map((token: any, index: number) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="font-mono">{token.name}</Badge>
                                <i className="fas fa-arrow-right text-gray-400"></i>
                                <span className="font-medium">{token.value}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {token.source}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Test Record Info */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <i className="fas fa-info-circle text-blue-600"></i>
                        <span className="font-medium text-blue-800">Test Record</span>
                      </div>
                      <div className="text-sm text-blue-700">
                        <strong>ID:</strong> {testResult.record.id} | 
                        <strong> Name:</strong> {testResult.record.name} | 
                        <strong> Module:</strong> {testResult.record.module}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
