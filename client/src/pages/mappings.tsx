import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default function Mappings() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [activeModule, setActiveModule] = useState("opportunities");

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: mappings = [] } = useQuery({
    queryKey: ['/api/field-mappings', selectedTenant, activeModule],
    queryFn: () => selectedTenant ? api.getFieldMappings(selectedTenant, activeModule) : [],
    enabled: !!selectedTenant,
  });

  const modules = ["opportunities", "contacts", "accounts"];

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
            <Button className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-plus mr-2"></i>
              Add Mapping
            </Button>
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
            {/* Module Tabs */}
            <div className="mb-6">
              <Tabs value={activeModule} onValueChange={setActiveModule}>
                <TabsList>
                  <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
                  <TabsTrigger value="contacts">Contacts</TabsTrigger>
                  <TabsTrigger value="accounts">Accounts</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Mapping Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>SugarCRM Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center text-gray-500 py-8">
                      <i className="fas fa-database text-4xl text-gray-300 mb-4"></i>
                      <p>Connect to SugarCRM to view available fields</p>
                      <p className="text-sm text-gray-400">Fields will appear here when tenant is properly configured</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PandaDoc Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 min-h-96 border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {mappings.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        <i className="fas fa-arrow-left text-2xl mb-2"></i>
                        <p className="text-sm">No field mappings configured</p>
                        <p className="text-xs text-gray-400">Drag SugarCRM fields here to create token mappings</p>
                      </div>
                    ) : (
                      mappings.map((mapping: any) => (
                        <div key={mapping.id} className="flex items-center justify-between p-3 bg-primary bg-opacity-10 border border-primary rounded-lg">
                          <div className="flex items-center">
                            <i className="fas fa-link text-primary mr-3"></i>
                            <div>
                              <p className="font-medium text-gray-900">{mapping.pandaDocToken}</p>
                              <p className="text-sm text-gray-500">← {mapping.sugarField}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <i className="fas fa-times"></i>
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
