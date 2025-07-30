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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      sugarCrmUrl: "",
      sugarCrmUsername: "",
      sugarCrmPassword: "",
      pandaDocApiKey: "",
      pandaDocSandbox: false,
      isActive: true,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const { confirmPassword, ...submitData } = values;
    createMutation.mutate(submitData);
  };

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
              
              {/* Quick Templates */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Quick Setup Templates</p>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.reset({
                        name: "Demo Corporation",
                        sugarCrmUrl: "https://demo.sugarcrm.com",
                        sugarCrmUsername: "admin",
                        sugarCrmPassword: "",
                        pandaDocApiKey: "",
                        pandaDocSandbox: true,
                        isActive: true,
                      });
                    }}
                  >
                    <i className="fas fa-flask mr-1"></i>
                    Demo Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.reset({
                        name: "Enterprise Client",
                        sugarCrmUrl: "https://company.sugarondemand.com",
                        sugarCrmUsername: "integration_user",
                        sugarCrmPassword: "",
                        pandaDocApiKey: "",
                        pandaDocSandbox: false,
                        isActive: true,
                      });
                    }}
                  >
                    <i className="fas fa-building mr-1"></i>
                    Enterprise Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.reset({
                        name: "Test Environment",
                        sugarCrmUrl: "https://test.sugarcrm.eu",
                        sugarCrmUsername: "test_user",
                        sugarCrmPassword: "",
                        pandaDocApiKey: "",
                        pandaDocSandbox: true,
                        isActive: false,
                      });
                    }}
                  >
                    <i className="fas fa-vial mr-1"></i>
                    Testing Template
                  </Button>
                </div>
              </div>

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
              <div className="space-y-4">
                {filteredTenants.map((tenant: any) => (
                  <Card key={tenant.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold text-gray-900">{tenant.name}</h3>
                            <Badge variant={tenant.isActive ? "default" : "secondary"}>
                              {tenant.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant={tenant.pandaDocSandbox ? "outline" : "destructive"}>
                              {tenant.pandaDocSandbox ? "Sandbox" : "Production"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-gray-600 mb-1">SugarCRM Instance</p>
                              <p className="text-sm font-medium text-blue-600 hover:text-blue-800">
                                <a href={tenant.sugarCrmUrl} target="_blank" rel="noopener noreferrer">
                                  {tenant.sugarCrmUrl}
                                </a>
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600 mb-1">Username</p>
                              <p className="text-sm font-medium">{tenant.sugarCrmUsername}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-key text-gray-400"></i>
                              <span className="text-gray-600">API Key: </span>
                              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                                {tenant.pandaDocApiKey.substring(0, 8)}...
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <i className="fas fa-calendar text-gray-400"></i>
                              <span className="text-gray-600">Created: </span>
                              <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <i className="fas fa-clock text-gray-400"></i>
                              <span className="text-gray-600">Updated: </span>
                              <span>{new Date(tenant.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 ml-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <i className="fas fa-edit mr-1"></i>
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${tenant.name}?`)) {
                                deleteMutation.mutate(tenant.id);
                              }
                            }}
                          >
                            <i className="fas fa-trash mr-1"></i>
                            Delete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
