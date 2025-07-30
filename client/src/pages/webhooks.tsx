import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default function Webhooks() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState("all");

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['/api/webhook-logs', selectedTenant],
    queryFn: () => api.getWebhookLogs(selectedTenant === "all" ? undefined : selectedTenant),
  });

  const filteredLogs = logs.filter((log: any) => {
    if (eventFilter === "all") return true;
    return log.eventType === eventFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'document_signed': return 'bg-green-100 text-green-800';
      case 'document_viewed': return 'bg-blue-100 text-blue-800';
      case 'document_created': return 'bg-purple-100 text-purple-800';
      case 'document_declined': return 'bg-red-100 text-red-800';
      case 'document_updated': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Webhook Logs" 
        description="Monitor incoming PandaDoc webhook events and processing status"
        actions={
          <div className="flex items-center space-x-3">
            <Select value={selectedTenant} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tenants</SelectItem>
                {tenants.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="document_signed">Document Signed</SelectItem>
                <SelectItem value="document_viewed">Document Viewed</SelectItem>
                <SelectItem value="document_created">Document Created</SelectItem>
                <SelectItem value="document_declined">Document Declined</SelectItem>
                <SelectItem value="document_updated">Document Updated</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => refetchLogs()} className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-sync mr-2"></i>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Events</p>
                  <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-exchange-alt text-blue-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Successful</p>
                  <p className="text-2xl font-bold text-green-600">
                    {logs.filter((log: any) => log.status === 'success').length}
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
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {logs.filter((log: any) => log.status === 'failed').length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-exclamation-triangle text-red-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Actions Triggered</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {logs.reduce((sum: number, log: any) => sum + (log.actionsTriggered || 0), 0)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <i className="fas fa-bolt text-purple-600"></i>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-exchange-alt text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No webhook events found</p>
                <p className="text-sm text-gray-400">Webhook events will appear here when documents are interacted with</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log: any) => {
                      const tenant = tenants.find((t: any) => t.id === log.tenantId);
                      return (
                        <tr key={log.id} className={log.status === 'failed' ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold mr-2">
                                {tenant?.name?.substring(0, 2).toUpperCase() || 'UN'}
                              </div>
                              <span className="text-sm text-gray-900">{tenant?.name || 'Unknown Tenant'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge className={getEventColor(log.eventType)}>
                              {log.eventType.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {log.documentName || 'Unknown Document'}
                              </p>
                              <p className="text-sm text-gray-500 font-mono">
                                {log.documentId || 'No ID'}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <Badge className={getStatusColor(log.status)}>
                                {log.status}
                              </Badge>
                              {log.errorMessage && (
                                <p className="text-xs text-red-600 max-w-32 truncate" title={log.errorMessage}>
                                  {log.errorMessage}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex flex-col gap-1">
                              <span>{log.actionsTriggered || 0} actions</span>
                              {log.processingTimeMs && (
                                <span className="text-xs text-gray-500">{log.processingTimeMs}ms</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
                              <i className="fas fa-eye mr-1"></i>
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
