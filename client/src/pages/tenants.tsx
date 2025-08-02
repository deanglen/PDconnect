import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTenantSchema } from "@shared/schema";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const formSchema = insertTenantSchema.extend({
  confirmPassword: z.string().optional(),
});

export default function Tenants() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [viewingTenant, setViewingTenant] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const createMutation = useMutation({
    mutationFn: api.createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Tenant created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create tenant",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.updateTenant(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      setIsEditDialogOpen(false);
      setEditingTenant(null);
      toast({
        title: "Success",
        description: "Tenant updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tenant",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "Success",
        description: "Tenant deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tenant",
        variant: "destructive",
      });
    },
  });

  const generateApiKeyMutation = useMutation({
    mutationFn: api.generateTenantApiKey,
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenants'] });
      toast({
        title: "API Key Generated",
        description: `New tenant API key created. Use for SugarCRM integration: ${response.apiKey.substring(0, 20)}...`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate API key",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sugarCrmUrl: "",
      sugarCrmUsername: "",
      sugarCrmPassword: "",
      pandaDocApiKey: "",
      webhookSharedSecret: "",
      pandaDocSandbox: false,
      isActive: true,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const { confirmPassword, ...submitData } = values;
    createMutation.mutate(submitData);
  };

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sugarCrmUrl: "",
      sugarCrmUsername: "",
      sugarCrmPassword: "",
      pandaDocApiKey: "",
      webhookSharedSecret: "",
      pandaDocSandbox: false,
      isActive: true,
    },
  });

  const onEditSubmit = (values: z.infer<typeof formSchema>) => {
    if (!editingTenant) return;
    const { confirmPassword, ...submitData } = values;
    updateMutation.mutate({ id: editingTenant.id, data: submitData });
  };

  const openEditDialog = (tenant: any) => {
    setEditingTenant(tenant);
    editForm.reset({
      name: tenant.name,
      sugarCrmUrl: tenant.sugarCrmUrl,
      sugarCrmUsername: tenant.sugarCrmUsername || "",
      sugarCrmPassword: "", // Don't prefill password for security
      pandaDocApiKey: "", // Don't prefill API key for security
      webhookSharedSecret: "", // Don't prefill secret for security
      pandaDocSandbox: tenant.pandaDocSandbox,
      isActive: tenant.isActive,
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (tenant: any) => {
    setViewingTenant(tenant);
    setIsViewDialogOpen(true);
  };;

  const filteredTenants = tenants.filter((tenant: any) =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.sugarCrmUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1">
        <Topbar 
          title="Tenant Configuration" 
          description="Manage multi-tenant SugarCRM and PandaDoc credentials"
        />
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Tenant Configuration" 
        description="Manage multi-tenant SugarCRM and PandaDoc credentials"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-white hover:bg-blue-700">
                <i className="fas fa-plus mr-2"></i>
                Add Tenant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Tenant</DialogTitle>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tenant Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Acme Corporation" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sugarCrmUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SugarCRM URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://acme.sugarcrm.com" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="sugarCrmUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SugarCRM Username</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="admin" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sugarCrmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SugarCRM Password</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value || ""} type="password" placeholder="********" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="pandaDocApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PandaDoc API Key</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" placeholder="API Key from PandaDoc" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="webhookSharedSecret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Webhook Shared Secret
                          <span className="text-sm text-gray-500 ml-2">(Optional - for webhook signature verification)</span>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="password" placeholder="Enter webhook shared secret from PandaDoc" />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-gray-500 mt-1">
                          This secret is used to verify webhook signatures from PandaDoc for enhanced security.
                        </p>
                      </FormItem>
                    )}
                  />

                  <div className="flex items-center space-x-4">
                    <FormField
                      control={form.control}
                      name="pandaDocSandbox"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel>Use PandaDoc Sandbox</FormLabel>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="isActive"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel>Active</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Tenant"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                  <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-building text-blue-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold text-green-600">
                    {tenants.filter((t: any) => t.isActive).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-check-circle text-green-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Sandbox</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {tenants.filter((t: any) => t.pandaDocSandbox).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-flask text-orange-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Production</p>
                  <p className="text-2xl font-bold text-red-600">
                    {tenants.filter((t: any) => !t.pandaDocSandbox).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-rocket text-red-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Active Tenants</CardTitle>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Search tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
                <Button variant="ghost" size="sm">
                  <i className="fas fa-search"></i>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTenants.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-building text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No tenants found</p>
                <p className="text-sm text-gray-400">Add your first tenant to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Tenant Name</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">SugarCRM Instance</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((tenant: any) => (
                      <tr key={tenant.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-semibold text-gray-900">{tenant.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={tenant.isActive ? "default" : "secondary"} className="text-xs">
                                  {tenant.isActive ? "Active" : "Inactive"}
                                </Badge>
                                <Badge variant={tenant.pandaDocSandbox ? "outline" : "destructive"} className="text-xs">
                                  {tenant.pandaDocSandbox ? "Sandbox" : "Production"}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <a 
                            href={tenant.sugarCrmUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {tenant.sugarCrmUrl}
                          </a>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openViewDialog(tenant)}
                              className="text-gray-600 hover:text-gray-700"
                            >
                              <i className="fas fa-eye mr-1"></i>
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openEditDialog(tenant)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <i className="fas fa-edit mr-1"></i>
                              Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete ${tenant.name}?`)) {
                                  deleteMutation.mutate(tenant.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700"
                            >
                              <i className="fas fa-trash mr-1"></i>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Tenant Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Tenant Configuration</DialogTitle>
            </DialogHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Acme Corporation" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="sugarCrmUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SugarCRM URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://acme.sugarcrm.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="sugarCrmUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SugarCRM Username</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="admin" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="sugarCrmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SugarCRM Password</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="password" placeholder="Leave blank to keep existing" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="pandaDocApiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PandaDoc API Key</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Leave blank to keep existing" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="webhookSharedSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Webhook Shared Secret
                        <span className="text-sm text-gray-500 ml-2">(Optional - for webhook signature verification)</span>
                      </FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} type="password" placeholder="Leave blank to keep existing (or not set)" />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-gray-500 mt-1">
                        Configure this secret in your PandaDoc webhook settings to enable signature verification.
                      </p>
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-4">
                  <FormField
                    control={editForm.control}
                    name="pandaDocSandbox"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Use PandaDoc Sandbox</FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel>Active</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Updating..." : "Update Tenant"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* View Tenant Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Tenant Details: {viewingTenant?.name}</DialogTitle>
            </DialogHeader>
            
            {viewingTenant && (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Tenant Name</label>
                        <p className="text-sm text-gray-900">{viewingTenant.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Status</label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={viewingTenant.isActive ? "default" : "secondary"}>
                            {viewingTenant.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant={viewingTenant.pandaDocSandbox ? "outline" : "destructive"}>
                            {viewingTenant.pandaDocSandbox ? "Sandbox" : "Production"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">SugarCRM Configuration</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Instance URL</label>
                        <a 
                          href={viewingTenant.sugarCrmUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {viewingTenant.sugarCrmUrl}
                        </a>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Username</label>
                        <p className="text-sm text-gray-900">{viewingTenant.sugarCrmUsername}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* API Configuration */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">API Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">PandaDoc API Key</label>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {viewingTenant.pandaDocApiKey.substring(0, 8)}...
                          </span>
                          <Badge variant="outline">Configured</Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Integration API Key</label>
                        <div className="flex items-center gap-2">
                          {viewingTenant.integrationApiKey ? (
                            <>
                              <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded text-blue-800">
                                {viewingTenant.integrationApiKey.substring(0, 8)}...
                              </span>
                              <Badge variant="default">Generated</Badge>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Generate new API key for ${viewingTenant.name}? This will invalidate the existing key.`)) {
                                    generateApiKeyMutation.mutate(viewingTenant.id);
                                  }
                                }}
                                disabled={generateApiKeyMutation.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                <i className="fas fa-key mr-1"></i>
                                {generateApiKeyMutation.isPending ? "Generating..." : "Regenerate"}
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                                Not Generated
                              </span>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Generate API key for ${viewingTenant.name}?`)) {
                                    generateApiKeyMutation.mutate(viewingTenant.id);
                                  }
                                }}
                                disabled={generateApiKeyMutation.isPending}
                                className="text-green-600 hover:text-green-700"
                              >
                                <i className="fas fa-key mr-1"></i>
                                {generateApiKeyMutation.isPending ? "Generating..." : "Generate"}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-gray-600">Webhook Shared Secret</label>
                        <div className="flex items-center gap-2">
                          {viewingTenant.webhookSharedSecret ? (
                            <>
                              <span className="font-mono text-xs bg-green-100 px-2 py-1 rounded text-green-800">
                                Configured
                              </span>
                              <Badge variant="default">Secure</Badge>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded text-yellow-800">
                                Not Set
                              </span>
                              <Badge variant="outline">Optional</Badge>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">Environment</label>
                        <div className="flex items-center gap-2">
                          <Badge variant={viewingTenant.pandaDocSandbox ? "outline" : "destructive"}>
                            {viewingTenant.pandaDocSandbox ? "Sandbox Mode" : "Production Mode"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Usage Instructions */}
                {viewingTenant.integrationApiKey && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">SugarCRM Integration Usage</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 mb-2">Use this API key in SugarCRM for document creation:</p>
                      <div className="bg-white border rounded p-3 font-mono text-xs">
                        <div className="text-gray-500">// HTTP Header</div>
                        <div>Authorization: Bearer {viewingTenant.integrationApiKey}</div>
                        <div className="mt-2 text-gray-500">// Endpoint</div>
                        <div>POST /api/documents/create</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-500">
                  <div>
                    <label className="font-medium">Created</label>
                    <p>{new Date(viewingTenant.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="font-medium">Last Updated</label>
                    <p>{new Date(viewingTenant.updatedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    setIsViewDialogOpen(false);
                    openEditDialog(viewingTenant);
                  }}>
                    <i className="fas fa-edit mr-1"></i>
                    Edit Tenant
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
