import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

export default function Webhooks() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [eventFilter, setEventFilter] = useState("all");

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['/api/webhook-logs', selectedTenant],
    queryFn: () => api.getWebhookLogs(selectedTenant || undefined),
  });

  const filteredLogs = logs.filter((log: any) => {
    if (eventFilter === "all") return true;
    return log.eventType === eventFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'document.signed': return 'bg-green-100 text-green-800';
      case 'document.viewed': return 'bg-blue-100 text-blue-800';
      case 'document.updated': return 'bg-orange-100 text-orange-800';
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
                <SelectItem value="">All tenants</SelectItem>
                {tenants.map((tenant: any) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="document.signed">document.signed</SelectItem>
                <SelectItem value="document.viewed">document.viewed</SelectItem>
                <SelectItem value="document.updated">document.updated</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={refetchLogs} className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-sync mr-2"></i>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6">
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions Triggered</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge className={getEventColor(log.eventType)}>
                            {log.eventType}
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
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.actionsTriggered || 0} actions
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
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
