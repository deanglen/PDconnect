import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Play, AlertTriangle, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Webhooks() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['/api/webhook-logs', selectedTenant, statusFilter, eventFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedTenant !== "all") params.append('tenantId', selectedTenant);
      if (statusFilter !== "all") params.append('status', statusFilter);
      if (eventFilter !== "all") params.append('eventType', eventFilter);
      
      return await apiRequest(`/api/webhook-logs?${params.toString()}`);
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: stats = {} } = useQuery({
    queryKey: ['/api/webhook-stats', selectedTenant],
    queryFn: async () => {
      const params = selectedTenant !== "all" ? `?tenantId=${selectedTenant}` : '';
      return await apiRequest(`/api/webhook-stats${params}`);
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: failedLogs = [] } = useQuery({
    queryKey: ['/api/webhook-logs/failed', selectedTenant],
    queryFn: async () => {
      const params = selectedTenant !== "all" ? `?tenantId=${selectedTenant}` : '';
      return await apiRequest(`/api/webhook-logs/failed${params}`);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      return await apiRequest(`/api/webhook-logs/${webhookId}/retry`, { method: 'POST' });
    },
    onSuccess: (_, webhookId) => {
      toast({
        title: "Retry Initiated",
        description: `Webhook ${webhookId} has been queued for retry processing.`,
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/webhook-logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/webhook-stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/webhook-logs/failed'] });
    },
    onError: (error: any) => {
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to initiate webhook retry",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'permanently_failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'permanently_failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'processing': return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const retryWebhook = async (webhookId: string) => {
    await retryMutation.mutateAsync(webhookId);
  };

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Webhook Management" 
        description="Monitor SugarCRM document creation requests and PandaDoc webhook events with persistent storage and retry capabilities"
        actions={
          <div className="flex items-center space-x-3">
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {Array.isArray(tenants) && tenants.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => {
                refetchLogs();
                queryClient.invalidateQueries({ queryKey: ['/api/webhook-stats'] });
                queryClient.invalidateQueries({ queryKey: ['/api/webhook-logs/failed'] });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Processing Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-600">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.processing || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-600">Success</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.success || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-600">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-800">Permanent Failures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-800">{stats.permanentlyFailed || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All Webhooks</TabsTrigger>
            <TabsTrigger value="failed">Failed & Retry ({Array.isArray(failedLogs) ? failedLogs.length : 0})</TabsTrigger>
            <TabsTrigger value="endpoint">Endpoint Configuration</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="permanently_failed">Permanently Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="All events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="sugarcrm.document_creation_requested">SugarCRM - Document Creation</SelectItem>
                  <SelectItem value="document_signed">PandaDoc - Document Signed</SelectItem>
                  <SelectItem value="document_viewed">PandaDoc - Document Viewed</SelectItem>
                  <SelectItem value="document_created">PandaDoc - Document Created</SelectItem>
                  <SelectItem value="document_declined">PandaDoc - Document Declined</SelectItem>
                  <SelectItem value="document_updated">PandaDoc - Document Updated</SelectItem>
                  <SelectItem value="document_completed">PandaDoc - Document Completed</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                {!Array.isArray(logs) || logs.length === 0 ? (
                  <div className="text-center py-8">
                    <RefreshCw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No webhook events found</p>
                    <p className="text-sm text-gray-400">Webhook events will appear here when documents are interacted with</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Retries</TableHead>
                        <TableHead>Response</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log: any) => {
                        const tenant = Array.isArray(tenants) ? tenants.find((t: any) => t.id === log.tenantId) : null;
                        return (
                          <TableRow key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(log.status)}
                                <Badge className={getStatusColor(log.status)}>
                                  {log.status}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                {log.eventType?.startsWith('sugarcrm.') ? (
                                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                    SugarCRM
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                    PandaDoc
                                  </Badge>
                                )}
                                <span className="text-sm">{log.eventType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{log.documentName || 'N/A'}</div>
                                {log.documentId && (
                                  <div className="text-xs text-gray-500">{log.documentId}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{tenant ? tenant.name : 'Unknown'}</TableCell>
                            <TableCell className="text-sm">
                              {formatTimestamp(log.receivedAt || log.createdAt)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.processedAt ? (
                                <div>
                                  {formatTimestamp(log.processedAt)}
                                  {log.processingTimeMs && (
                                    <div className="text-xs text-gray-500">{log.processingTimeMs}ms</div>
                                  )}
                                </div>
                              ) : (
                                'Not processed'
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {log.retryCount || 0} / {log.maxRetries || 3}
                                {log.nextRetryAt && (
                                  <div className="text-xs text-gray-500">
                                    Next: {formatTimestamp(log.nextRetryAt)}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {log.response ? (
                                <div className="text-sm">
                                  <Badge variant="outline" className={
                                    log.response.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                                    log.response.status === 'error' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-gray-50 text-gray-700 border-gray-200'
                                  }>
                                    {log.response.status}
                                  </Badge>
                                  {log.response.message && (
                                    <div className="text-xs text-gray-500 mt-1 truncate max-w-32">
                                      {log.response.message}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">No response</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => setSelectedWebhook(log)}
                                    >
                                      View
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle>Webhook Details - {log.eventType}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <p className="font-semibold">Status</p>
                                          <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                                        </div>
                                        <div>
                                          <p className="font-semibold">Event ID</p>
                                          <p className="text-sm font-mono">{log.eventId || 'N/A'}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold">Received At</p>
                                          <p className="text-sm">{formatTimestamp(log.receivedAt || log.createdAt)}</p>
                                        </div>
                                        <div>
                                          <p className="font-semibold">Actions Triggered</p>
                                          <p className="text-sm">{log.actionsTriggered || 0}</p>
                                        </div>
                                      </div>
                                      {log.errorMessage && (
                                        <Alert>
                                          <AlertTriangle className="h-4 w-4" />
                                          <AlertDescription>{log.errorMessage}</AlertDescription>
                                        </Alert>
                                      )}
                                      <div>
                                        <p className="font-semibold mb-2">Payload</p>
                                        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-xs overflow-auto max-h-64">
                                          {JSON.stringify(log.payload, null, 2)}
                                        </pre>
                                      </div>
                                      {log.response && (
                                        <div>
                                          <p className="font-semibold mb-2">Response</p>
                                          <pre className="bg-blue-50 dark:bg-blue-900 p-4 rounded text-xs overflow-auto max-h-64">
                                            {JSON.stringify(log.response, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                {(log.status === 'failed' || log.status === 'permanently_failed') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => retryWebhook(log.id)}
                                    disabled={retryMutation.isPending}
                                  >
                                    <Play className="w-3 h-3 mr-1" />
                                    Retry
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="failed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <span>Failed Webhooks - Manual Retry Interface</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!Array.isArray(failedLogs) || failedLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                    <p className="text-gray-500">No failed webhooks</p>
                    <p className="text-sm text-gray-400">All webhook events processed successfully</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Document</TableHead>
                        <TableHead>Failed At</TableHead>
                        <TableHead>Retry Count</TableHead>
                        <TableHead>Error</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.eventType}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.documentName || 'N/A'}</div>
                              {log.documentId && (
                                <div className="text-xs text-gray-500">{log.documentId}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTimestamp(log.updatedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-red-600">
                              {log.retryCount} / {log.maxRetries}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="text-sm text-red-600 truncate" title={log.errorMessage}>
                              {log.errorMessage || 'Unknown error'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryWebhook(log.id)}
                              disabled={retryMutation.isPending}
                            >
                              <Play className="w-3 h-3 mr-1" />
                              Manual Retry
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoint" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Endpoint Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold">PandaDoc Webhook Endpoint:</p>
                      <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded border font-mono text-sm">
                        {window.location.origin}/api/webhook/pandadoc
                      </div>
                      <p className="text-xs text-gray-600">
                        Configure this URL in your PandaDoc account to receive webhook events.
                        Ensure webhook shared secrets are configured in tenant settings for security.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-semibold">Webhook Features:</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Immediate persistence before processing</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Asynchronous background processing</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Exponential backoff retry with configurable limits</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ HMAC-SHA256 signature verification</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Event deduplication using event_id</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Manual retry capability for failed events</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Comprehensive audit trail and filtering</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>✅ Multi-tenant isolation and processing</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}