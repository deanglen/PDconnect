import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertFieldMappingSchema } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = z.object({
  tenantId: z.string().min(1, "Tenant is required"),
  sugarModule: z.string().min(1, "Module is required"),
  sugarField: z.string().min(1, "SugarCRM field is required"),
  sugarFieldLabel: z.string().min(1, "Field label is required"),
  sugarFieldType: z.string().min(1, "Field type is required"),
  pandaDocToken: z.string().min(1, "PandaDoc token is required"),
  isActive: z.boolean().default(true),
});

export default function Mappings() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [activeModule, setActiveModule] = useState("opportunities");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  const createMutation = useMutation({
    mutationFn: api.createFieldMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/field-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens'] });
      setIsDialogOpen(false);
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tenantId: "",
      sugarModule: "",
      sugarField: "",
      sugarFieldLabel: "",
      sugarFieldType: "",
      pandaDocToken: "",
      isActive: true,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMutation.mutate({
      ...values,
      tenantId: selectedTenant,
      sugarModule: activeModule,
    });
  };

  const modules = [
    { value: "opportunities", label: "Opportunities", icon: "fas fa-bullseye" },
    { value: "contacts", label: "Contacts", icon: "fas fa-user" },
    { value: "accounts", label: "Accounts", icon: "fas fa-building" },
  ];

  const selectedTenantData = tenants.find((t: any) => t.id === selectedTenant);
  const availableFields = tokens?.tokens || [];
  const unmappedFields = availableFields.filter(field => !field.mapped);

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
                            <FormLabel>PandaDoc Token</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="{{company_name}}" />
                            </FormControl>
                            <FormMessage />
                            <p className="text-xs text-gray-500">
                              Use double curly braces format: {`{{token_name}}`}
                            </p>
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                          {createMutation.isPending ? "Creating..." : "Create Mapping"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
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
                      {unmappedFields.map((field: any) => (
                        <div key={field.name} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
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
                                  form.setValue('pandaDocToken', `{{${field.name.toLowerCase()}}}`);
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
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
