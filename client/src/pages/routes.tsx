import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, TestTube, RefreshCw } from "lucide-react";

interface RouteTemplateRecord {
  id: string;
  tenantId: string;
  templateId: string;
  routePath: string;
  sugarModule: string;
  matchCriteria: Record<string, any>;
  requiresAuth: boolean;
  asyncProcessing: boolean;
  responseFormat: 'json' | 'redirect';
  successRedirectUrl?: string;
  errorRedirectUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Tenant {
  id: string;
  name: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  sugarModule: string;
}

export default function Routes() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteTemplateRecord | null>(null);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch routes
  const { data: routes = [], isLoading } = useQuery<RouteTemplateRecord[]>({
    queryKey: ["/api/route-templates"],
  });

  // Fetch tenants for dropdown
  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  // Fetch document templates for selected tenant
  const { data: templates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: [`/api/document-templates/${selectedTenant}`],
    enabled: !!selectedTenant,
  });

  // Create/Update route mutation
  const createRouteMutation = useMutation({
    mutationFn: async (data: Partial<RouteTemplateRecord>) => {
      if (editingRoute) {
        return await apiRequest(`/api/route-templates/${editingRoute.id}`, {
          method: "PUT",
          body: JSON.stringify(data),
        });
      } else {
        return await apiRequest("/api/route-templates", {
          method: "POST", 
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-templates"] });
      setIsDialogOpen(false);
      setEditingRoute(null);
      toast({
        title: "Success",
        description: `Route ${editingRoute ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/route-templates/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/route-templates"] });
      toast({
        title: "Success",
        description: "Route deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test route mutation
  const testRouteMutation = useMutation({
    mutationFn: async (routePath: string) => {
      const response = await fetch(`/sugar${routePath}`, { method: 'GET' });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Route Test Result",
        description: data.success ? 
          `Route is configured correctly for ${data.route?.tenant}` :
          data.error || "Route test failed",
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      tenantId: formData.get("tenantId") as string,
      templateId: formData.get("templateId") as string,
      routePath: formData.get("routePath") as string,
      sugarModule: formData.get("sugarModule") as string,
      matchCriteria: formData.get("matchCriteria") ? 
        JSON.parse(formData.get("matchCriteria") as string) : {},
      requiresAuth: formData.get("requiresAuth") === "on",
      asyncProcessing: formData.get("asyncProcessing") === "on",
      responseFormat: formData.get("responseFormat") as 'json' | 'redirect',
      successRedirectUrl: formData.get("successRedirectUrl") as string || undefined,
      errorRedirectUrl: formData.get("errorRedirectUrl") as string || undefined,
      isActive: formData.get("isActive") === "on",
    };

    createRouteMutation.mutate(data);
  };

  const openEditDialog = (route: RouteTemplateRecord) => {
    setEditingRoute(route);
    setSelectedTenant(route.tenantId);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRoute(null);
    setSelectedTenant("");
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SugarCRM Web Logic Hook Routes</h1>
          <p className="text-muted-foreground mt-2">
            Configure intelligent routing for SugarCRM Web Logic Hooks to automatically determine tenant, template, and module
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingRoute ? 'Edit' : 'Create'} Route Template</DialogTitle>
              <DialogDescription>
                Configure a route pattern that will automatically handle SugarCRM Web Logic Hook requests
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tenantId">Tenant *</Label>
                  <Select 
                    name="tenantId" 
                    value={selectedTenant} 
                    onValueChange={setSelectedTenant}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tenant" />
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
                <div>
                  <Label htmlFor="templateId">Document Template *</Label>
                  <Select name="templateId" defaultValue={editingRoute?.templateId} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.sugarModule})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="routePath">Route Path *</Label>
                  <Input 
                    name="routePath" 
                    placeholder="/opportunity/contract"
                    defaultValue={editingRoute?.routePath}
                    required 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    URL path that SugarCRM will POST to (supports wildcards with *)
                  </p>
                </div>
                <div>
                  <Label htmlFor="sugarModule">SugarCRM Module *</Label>
                  <Input 
                    name="sugarModule" 
                    placeholder="Opportunities"
                    defaultValue={editingRoute?.sugarModule}
                    required 
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="matchCriteria">Additional Match Criteria (JSON)</Label>
                <Textarea 
                  name="matchCriteria" 
                  placeholder='{"sales_stage": ["Proposal", "Negotiation"]}'
                  defaultValue={editingRoute?.matchCriteria ? JSON.stringify(editingRoute.matchCriteria, null, 2) : "{}"}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional JSON criteria to match against the webhook payload
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="responseFormat">Response Format</Label>
                  <Select name="responseFormat" defaultValue={editingRoute?.responseFormat || "json"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON Response</SelectItem>
                      <SelectItem value="redirect">Browser Redirect</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      name="requiresAuth" 
                      defaultChecked={editingRoute?.requiresAuth ?? false}
                    />
                    <Label>Requires Authentication</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      name="asyncProcessing" 
                      defaultChecked={editingRoute?.asyncProcessing ?? false}
                    />
                    <Label>Async Processing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      name="isActive" 
                      defaultChecked={editingRoute?.isActive ?? true}
                    />
                    <Label>Active</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="successRedirectUrl">Success Redirect URL</Label>
                  <Input 
                    name="successRedirectUrl" 
                    placeholder="https://your-app.com/success"
                    defaultValue={editingRoute?.successRedirectUrl}
                  />
                </div>
                <div>
                  <Label htmlFor="errorRedirectUrl">Error Redirect URL</Label>
                  <Input 
                    name="errorRedirectUrl" 
                    placeholder="https://your-app.com/error"
                    defaultValue={editingRoute?.errorRedirectUrl}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRouteMutation.isPending}>
                  {createRouteMutation.isPending ? "Saving..." : "Save Route"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Routes</CardTitle>
          <CardDescription>
            Routes are matched against incoming SugarCRM Web Logic Hook requests to automatically determine processing parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route Path</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Settings</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.map((route) => {
                const tenant = tenants.find(t => t.id === route.tenantId);
                return (
                  <TableRow key={route.id}>
                    <TableCell className="font-mono text-sm">
                      {route.routePath}
                    </TableCell>
                    <TableCell>{tenant?.name || route.tenantId}</TableCell>
                    <TableCell>{route.sugarModule}</TableCell>
                    <TableCell className="max-w-32 truncate">
                      {route.templateId}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {route.requiresAuth && (
                          <Badge variant="secondary" className="text-xs">Auth</Badge>
                        )}
                        {route.asyncProcessing && (
                          <Badge variant="secondary" className="text-xs">Async</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {route.responseFormat}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={route.isActive ? "default" : "secondary"}>
                        {route.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testRouteMutation.mutate(route.routePath)}
                          disabled={testRouteMutation.isPending}
                        >
                          <TestTube className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(route)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteRouteMutation.mutate(route.id)}
                          disabled={deleteRouteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {routes.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No routes configured yet. Create your first route to enable SugarCRM Web Logic Hook integration.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold">1. Configure SugarCRM Web Logic Hook</h4>
            <p className="text-sm text-muted-foreground">
              Set up a SugarCRM Web Logic Hook to POST to: <code className="bg-muted px-1 rounded">/sugar/your-route-path</code>
            </p>
          </div>
          <div>
            <h4 className="font-semibold">2. Automatic Route Matching</h4>
            <p className="text-sm text-muted-foreground">
              The middleware analyzes the incoming request path and payload to determine the correct tenant, template, and module automatically.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">3. Document Generation</h4>
            <p className="text-sm text-muted-foreground">
              The system extracts the record ID from the payload, fetches data from SugarCRM, and creates the PandaDoc document using the configured template.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}