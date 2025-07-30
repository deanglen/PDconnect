import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export default function Workflows() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['/api/workflows', selectedTenant],
    queryFn: () => selectedTenant ? api.getWorkflows(selectedTenant) : [],
    enabled: !!selectedTenant,
  });

  const sampleWorkflows = [
    {
      id: '1',
      name: 'Document Signed Workflow',
      description: 'Triggered when document.signed event occurs',
      triggerEvent: 'document.signed',
      isActive: true,
      actions: {
        trigger: { event: 'document.signed' },
        conditions: [
          { field: 'document.status', operator: 'equals', value: 'completed' }
        ],
        actions: [
          { type: 'update_sugarcrm', module: 'Opportunities', field: 'sales_stage', value: 'Closed Won' },
          { type: 'attach_document', module: 'Opportunities', field: 'documents' },
          { type: 'send_notification', recipients: ['{{assigned_user_email}}'], subject: 'Deal Closed: {{opportunity_name}}' }
        ]
      }
    },
    {
      id: '2',
      name: 'Document Viewed Workflow',
      description: 'Triggered when document.viewed event occurs',
      triggerEvent: 'document.viewed',
      isActive: false,
      actions: {
        trigger: { event: 'document.viewed' },
        conditions: [],
        actions: [
          { type: 'update_sugarcrm', module: 'Opportunities', field: 'sales_stage', value: 'Proposal/Quote' },
          { type: 'log_activity', module: 'Opportunities', subject: 'Document viewed by prospect' }
        ]
      }
    }
  ];

  const displayWorkflows = workflows.length > 0 ? workflows : (selectedTenant ? sampleWorkflows : []);

  return (
    <div className="flex-1 overflow-auto">
      <Topbar 
        title="Workflow Configuration" 
        description="Define automated actions for PandaDoc webhook events"
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
              Add Workflow
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {!selectedTenant ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <i className="fas fa-project-diagram text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">Select a tenant to view workflows</p>
                <p className="text-sm text-gray-400">Choose a tenant from the dropdown above</p>
              </div>
            </CardContent>
          </Card>
        ) : displayWorkflows.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <i className="fas fa-project-diagram text-4xl text-gray-300 mb-4"></i>
                <p className="text-gray-500">No workflows configured</p>
                <p className="text-sm text-gray-400">Create your first workflow to automate document events</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {displayWorkflows.map((workflow: any) => (
              <Card key={workflow.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`w-10 h-10 ${workflow.isActive ? 'bg-green-600' : 'bg-blue-600'} rounded-lg flex items-center justify-center mr-3`}>
                        <i className={`fas ${workflow.triggerEvent.includes('signed') ? 'fa-check' : 'fa-eye'} text-white`}></i>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                        <p className="text-sm text-gray-500">{workflow.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={workflow.isActive ? "default" : "secondary"}>
                        {workflow.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                        <i className="fas fa-edit"></i>
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                        <i className="fas fa-trash"></i>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-green-400 whitespace-pre-wrap">
                      {JSON.stringify(workflow.actions, null, 2)}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
