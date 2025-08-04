import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2, TestTube, Database, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function LiveTesting() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [sugarTestResult, setSugarTestResult] = useState<any>(null);
  const [pandaTestResult, setPandaTestResult] = useState<any>(null);
  const [sugarRecordsResult, setSugarRecordsResult] = useState<any>(null);
  const [isTestingSugar, setIsTestingSugar] = useState(false);
  const [isTestingPanda, setIsTestingPanda] = useState(false);
  const [isTestingRecords, setIsTestingRecords] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
  });

  const tenantsArray = Array.isArray(tenants) ? tenants : [];

  const testSugarCRMConnection = async () => {
    if (!selectedTenant) return;
    
    setIsTestingSugar(true);
    try {
      const result = await apiRequest(`/api/tenants/${selectedTenant}/test/sugarcrm`, "GET");
      setSugarTestResult(result);
    } catch (error: any) {
      setSugarTestResult({
        status: "error",
        message: error.message || "Connection test failed"
      });
    } finally {
      setIsTestingSugar(false);
    }
  };

  const testPandaDocConnection = async () => {
    if (!selectedTenant) return;
    
    setIsTestingPanda(true);
    try {
      const result = await apiRequest(`/api/tenants/${selectedTenant}/test/pandadoc`, "GET");
      setPandaTestResult(result);
    } catch (error: any) {
      setPandaTestResult({
        status: "error",
        message: error.message || "Connection test failed"
      });
    } finally {
      setIsTestingPanda(false);
    }
  };

  const testSugarCRMRecords = async (module: string) => {
    if (!selectedTenant) return;
    
    setIsTestingRecords(true);
    try {
      const result = await apiRequest(`/api/tenants/${selectedTenant}/test/sugarcrm/records/${module}?limit=3`, "GET");
      setSugarRecordsResult(result);
    } catch (error: any) {
      setSugarRecordsResult({
        status: "error",
        message: error.message || "Failed to fetch records"
      });
    } finally {
      setIsTestingRecords(false);
    }
  };

  const renderTestResult = (result: any, title: string) => {
    if (!result) return null;

    const isSuccess = result.status === "success";
    const Icon = isSuccess ? CheckCircle : XCircle;
    const variant = isSuccess ? "default" : "destructive";

    return (
      <Alert className={`mt-4 ${isSuccess ? 'border-green-200 bg-green-50' : ''}`}>
        <Icon className={`h-4 w-4 ${isSuccess ? 'text-green-600' : 'text-red-600'}`} />
        <AlertDescription>
          <div className="font-medium">{title}</div>
          <div className="mt-1">{result.message}</div>
          {result.details && (
            <div className="mt-2 text-sm text-gray-600">
              <pre className="whitespace-pre-wrap">{JSON.stringify(result.details, null, 2)}</pre>
            </div>
          )}
          {result.timestamp && (
            <div className="mt-2 text-xs text-gray-500">
              Tested at: {new Date(result.timestamp).toLocaleString()}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Live Environment Testing</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Test your SugarCRM and PandaDoc connections with real API credentials
          </p>
        </div>

        <div className="grid gap-6">
          {/* Tenant Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Select Tenant for Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a tenant to test..." />
                </SelectTrigger>
                <SelectContent>
                  {tenantsArray.map((tenant: any) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} - {tenant.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedTenant && (
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Selected tenant ready for testing. Use the test buttons below to verify your live API connections.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* SugarCRM Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                SugarCRM Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button 
                  onClick={testSugarCRMConnection}
                  disabled={!selectedTenant || isTestingSugar}
                  className="w-full"
                >
                  {isTestingSugar ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing SugarCRM Connection...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Test SugarCRM Connection
                    </>
                  )}
                </Button>

                {renderTestResult(sugarTestResult, "SugarCRM Connection Test")}

                {sugarTestResult?.status === "success" && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                    {["Opportunities", "Accounts", "Contacts", "Leads"].map((module) => (
                      <Button
                        key={module}
                        onClick={() => testSugarCRMRecords(module)}
                        disabled={isTestingRecords}
                        variant="outline"
                        size="sm"
                      >
                        Test {module}
                      </Button>
                    ))}
                  </div>
                )}

                {sugarRecordsResult && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="font-medium mb-2">Sample Records from {sugarRecordsResult.module}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Found {sugarRecordsResult.recordCount} records
                    </p>
                    <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded border overflow-auto max-h-40">
                      {JSON.stringify(sugarRecordsResult.sampleRecords?.slice(0, 2) || [], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* PandaDoc Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                PandaDoc Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testPandaDocConnection}
                disabled={!selectedTenant || isTestingPanda}
                className="w-full"
              >
                {isTestingPanda ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing PandaDoc Connection...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Test PandaDoc Connection
                  </>
                )}
              </Button>

              {renderTestResult(pandaTestResult, "PandaDoc Connection Test")}
            </CardContent>
          </Card>

          {/* Next Steps */}
          {sugarTestResult?.status === "success" && pandaTestResult?.status === "success" && (
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardHeader>
                <CardTitle className="text-green-700 dark:text-green-300">✅ Ready for Integration Testing!</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-green-600 dark:text-green-400 mb-4">
                  Both connections are working! You can now:
                </p>
                <div className="space-y-2 text-sm">
                  <div>• Set up field mappings between SugarCRM and PandaDoc</div>
                  <div>• Create workflows for document automation</div>
                  <div>• Test document creation with real data</div>
                  <div>• Configure webhooks for status updates</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}