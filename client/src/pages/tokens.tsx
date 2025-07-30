import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Tokens() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState("Opportunities");
  const [recordId, setRecordId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: tokenData, refetch: refetchTokens } = useQuery({
    queryKey: ['/api/tokens', selectedTenant, selectedModule, recordId],
    queryFn: () => selectedTenant ? api.getTokens(selectedTenant, selectedModule, recordId || undefined) : null,
    enabled: !!selectedTenant,
  });

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast({
        title: "Success",
        description: "Token copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy token",
        variant: "destructive",
      });
    }
  };

  const previewTokens = () => {
    if (recordId) {
      refetchTokens();
      toast({
        title: "Success",
        description: "Token preview updated",
      });
    } else {
      toast({
        title: "Error",
        description: "Please enter a record ID",
        variant: "destructive",
      });
    }
  };

  const tokens = tokenData?.tokens || [];
  const previewValues = tokenData?.previewValues || {};
  
  const filteredTokens = tokens.filter((token: any) =>
    token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'string': return 'bg-blue-100 text-blue-700';
      case 'currency': return 'bg-green-100 text-green-700';
      case 'date': return 'bg-purple-100 text-purple-700';
      case 'email': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Token Explorer" 
        description="Browse and test available merge field tokens for your templates"
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
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Opportunities">Opportunities</SelectItem>
                <SelectItem value="Contacts">Contacts</SelectItem>
                <SelectItem value="Accounts">Accounts</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={refetchTokens} className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-sync mr-2"></i>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {!selectedTenant ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <i className="fas fa-tags text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">Select a tenant to explore tokens</p>
                <p className="text-sm text-gray-400">Choose a tenant from the dropdown above</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Available Tokens</CardTitle>
                  <Input
                    placeholder="Search tokens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredTokens.length === 0 ? (
                    <div className="text-center py-8">
                      <i className="fas fa-tags text-4xl text-gray-300 mb-4"></i>
                      <p className="text-gray-500">No tokens available</p>
                      <p className="text-sm text-gray-400">Connect to SugarCRM to view available fields</p>
                    </div>
                  ) : (
                    filteredTokens.map((token: any) => (
                      <div key={token.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-primary cursor-pointer transition-colors">
                        <div className="flex items-center">
                          <i className="fas fa-tag text-primary mr-3"></i>
                          <div>
                            <p className="font-medium text-gray-900 font-mono">{token.token}</p>
                            <p className="text-sm text-gray-500">{token.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={getTypeColor(token.type)}>
                            {token.type}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToken(token.token)}
                            className="text-gray-400 hover:text-primary"
                            title="Copy token"
                          >
                            <i className="fas fa-copy"></i>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Token Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="recordId">Test Record ID</Label>
                    <Input
                      id="recordId"
                      placeholder="Enter SugarCRM record ID"
                      value={recordId}
                      onChange={(e) => setRecordId(e.target.value)}
                    />
                  </div>
                  
                  <Button onClick={previewTokens} className="w-full bg-primary text-white hover:bg-blue-700">
                    <i className="fas fa-play mr-2"></i>
                    Preview Token Values
                  </Button>

                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Token Values</h4>
                    <div className="space-y-3">
                      {Object.keys(previewValues).length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <p className="text-sm">Enter a record ID and click "Preview Token Values" to see sample data</p>
                        </div>
                      ) : (
                        Object.entries(previewValues).slice(0, 10).map(([token, value]) => (
                          <div key={token} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-mono text-sm text-gray-900">{token}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-700">{String(value)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
