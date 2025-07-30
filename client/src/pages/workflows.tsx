import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface WorkflowCondition {
  field: string;
  operator: string;
  value: string;
  logicalOperator?: 'AND' | 'OR';
}

interface WorkflowAction {
  type: string;
  module?: string;
  field?: string;
  value?: string;
  subject?: string;
  description?: string;
  recipients?: string[];
}

interface WorkflowRule {
  conditions: WorkflowCondition[];
  thenActions: WorkflowAction[];
  elseActions?: WorkflowAction[];
}

// Workflow Editor Component
function WorkflowEditor({ 
  configMode, 
  setConfigMode, 
  editingWorkflow, 
  onSave, 
  isLoading 
}: {
  configMode: 'point_click' | 'json';
  setConfigMode: (mode: 'point_click' | 'json') => void;
  editingWorkflow?: any;
  onSave: (data: any) => void;
  isLoading: boolean;
}) {
  const [workflowData, setWorkflowData] = useState({
    name: editingWorkflow?.name || '',
    description: editingWorkflow?.description || '',
    triggerEvent: editingWorkflow?.triggerEvent || 'document_signed',
    conditions: editingWorkflow?.conditions || [] as WorkflowCondition[],
    ifThenElseRules: editingWorkflow?.ifThenElseRules || { 
      if: [] as WorkflowCondition[], 
      then: [] as WorkflowAction[], 
      else: [] as WorkflowAction[] 
    },
    actions: editingWorkflow?.actions || [] as WorkflowAction[],
    elseActions: editingWorkflow?.elseActions || [] as WorkflowAction[],
    priority: editingWorkflow?.priority || 100,
    timeout: editingWorkflow?.timeout || 30,
    isActive: editingWorkflow?.isActive ?? true,
    configMode: configMode
  });

  const [jsonConfig, setJsonConfig] = useState(
    editingWorkflow && configMode === 'json' 
      ? JSON.stringify(editingWorkflow, null, 2) 
      : ''
  );

  const triggerEvents = [
    { value: 'document_signed', label: 'Document Signed' },
    { value: 'document_viewed', label: 'Document Viewed' },
    { value: 'document_created', label: 'Document Created' },
    { value: 'document_completed', label: 'Document Completed' },
    { value: 'document_declined', label: 'Document Declined' },
    { value: 'document_voided', label: 'Document Voided' }
  ];

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' }
  ];

  const actionTypes = [
    { value: 'update_sugarcrm', label: 'Update SugarCRM Field' },
    { value: 'create_note', label: 'Create Note/Activity' },
    { value: 'send_notification', label: 'Send Email Notification' },
    { value: 'attach_document', label: 'Attach Document' },
    { value: 'log_activity', label: 'Log Activity' },
    { value: 'webhook_call', label: 'Make Webhook Call' }
  ];

  const sugarModules = [
    { value: 'Opportunities', label: 'Opportunities' },
    { value: 'Contacts', label: 'Contacts' },
    { value: 'Accounts', label: 'Accounts' },
    { value: 'Leads', label: 'Leads' },
    { value: 'Cases', label: 'Cases' }
  ];

  const addCondition = () => {
    setWorkflowData(prev => ({
      ...prev,
      ifThenElseRules: {
        ...prev.ifThenElseRules,
        if: [...prev.ifThenElseRules.if, { field: '', operator: 'equals', value: '', logicalOperator: 'AND' }]
      }
    }));
  };

  const addAction = (actionType: 'then' | 'else') => {
    setWorkflowData(prev => ({
      ...prev,
      ifThenElseRules: {
        ...prev.ifThenElseRules,
        [actionType]: [...prev.ifThenElseRules[actionType], { type: 'update_sugarcrm', module: 'Opportunities', field: '', value: '' }]
      }
    }));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    setWorkflowData(prev => ({
      ...prev,
      ifThenElseRules: {
        ...prev.ifThenElseRules,
        if: prev.ifThenElseRules.if.map((condition, i) => 
          i === index ? { ...condition, [field]: value } : condition
        )
      }
    }));
  };

  const updateAction = (actionType: 'then' | 'else', index: number, field: string, value: any) => {
    setWorkflowData(prev => ({
      ...prev,
      ifThenElseRules: {
        ...prev.ifThenElseRules,
        [actionType]: prev.ifThenElseRules[actionType].map((action, i) => 
          i === index ? { ...action, [field]: value } : action
        )
      }
    }));
  };

  const handleSave = () => {
    if (configMode === 'json') {
      try {
        const parsedConfig = JSON.parse(jsonConfig);
        if (!parsedConfig.name || !parsedConfig.triggerEvent) {
          alert('Name and trigger event are required');
          return;
        }
        onSave(parsedConfig);
      } catch (error) {
        alert('Invalid JSON configuration');
        return;
      }
    } else {
      if (!workflowData.name || !workflowData.triggerEvent) {
        alert('Name and trigger event are required');
        return;
      }
      onSave(workflowData);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={configMode} onValueChange={(value) => setConfigMode(value as 'point_click' | 'json')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="point_click">Point & Click Builder</TabsTrigger>
          <TabsTrigger value="json">JSON Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="point_click" className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Workflow Name</Label>
              <Input
                id="name"
                value={workflowData.name}
                onChange={(e) => setWorkflowData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Document Signed Workflow"
              />
            </div>
            <div>
              <Label htmlFor="triggerEvent">Trigger Event</Label>
              <Select
                value={workflowData.triggerEvent}
                onValueChange={(value) => setWorkflowData(prev => ({ ...prev, triggerEvent: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggerEvents.map(event => (
                    <SelectItem key={event.value} value={event.value}>
                      {event.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={workflowData.description}
              onChange={(e) => setWorkflowData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this workflow does..."
            />
          </div>

          {/* IF Conditions */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">IF Conditions</h3>
              <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                <i className="fas fa-plus mr-2"></i>
                Add Condition
              </Button>
            </div>
            
            {workflowData.ifThenElseRules.if.map((condition, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <Input
                  placeholder="Field name"
                  value={condition.field}
                  onChange={(e) => updateCondition(index, 'field', e.target.value)}
                />
                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(index, 'operator', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Value"
                  value={condition.value}
                  onChange={(e) => updateCondition(index, 'value', e.target.value)}
                />
                <Select
                  value={condition.logicalOperator || 'AND'}
                  onValueChange={(value) => updateCondition(index, 'logicalOperator', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">AND</SelectItem>
                    <SelectItem value="OR">OR</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWorkflowData(prev => ({
                      ...prev,
                      ifThenElseRules: {
                        ...prev.ifThenElseRules,
                        if: prev.ifThenElseRules.if.filter((_, i) => i !== index)
                      }
                    }));
                  }}
                >
                  <i className="fas fa-trash"></i>
                </Button>
              </div>
            ))}
          </div>

          {/* THEN Actions */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">THEN Actions</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => addAction('then')}>
                <i className="fas fa-plus mr-2"></i>
                Add Action
              </Button>
            </div>
            
            {workflowData.ifThenElseRules.then.map((action, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <Select
                  value={action.type}
                  onValueChange={(value) => updateAction('then', index, 'type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {action.type === 'update_sugarcrm' && (
                  <>
                    <Select
                      value={action.module || ''}
                      onValueChange={(value) => updateAction('then', index, 'module', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Module" />
                      </SelectTrigger>
                      <SelectContent>
                        {sugarModules.map(module => (
                          <SelectItem key={module.value} value={module.value}>
                            {module.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Field name"
                      value={action.field || ''}
                      onChange={(e) => updateAction('then', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="New value"
                      value={action.value || ''}
                      onChange={(e) => updateAction('then', index, 'value', e.target.value)}
                    />
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWorkflowData(prev => ({
                      ...prev,
                      ifThenElseRules: {
                        ...prev.ifThenElseRules,
                        then: prev.ifThenElseRules.then.filter((_, i) => i !== index)
                      }
                    }));
                  }}
                >
                  <i className="fas fa-trash"></i>
                </Button>
              </div>
            ))}
          </div>

          {/* ELSE Actions */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">ELSE Actions (Optional)</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => addAction('else')}>
                <i className="fas fa-plus mr-2"></i>
                Add Action
              </Button>
            </div>
            
            {workflowData.ifThenElseRules.else.map((action, index) => (
              <div key={index} className="grid grid-cols-5 gap-2 mb-2">
                <Select
                  value={action.type}
                  onValueChange={(value) => updateAction('else', index, 'type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {action.type === 'update_sugarcrm' && (
                  <>
                    <Select
                      value={action.module || ''}
                      onValueChange={(value) => updateAction('else', index, 'module', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Module" />
                      </SelectTrigger>
                      <SelectContent>
                        {sugarModules.map(module => (
                          <SelectItem key={module.value} value={module.value}>
                            {module.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Field name"
                      value={action.field || ''}
                      onChange={(e) => updateAction('else', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="New value"
                      value={action.value || ''}
                      onChange={(e) => updateAction('else', index, 'value', e.target.value)}
                    />
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setWorkflowData(prev => ({
                      ...prev,
                      ifThenElseRules: {
                        ...prev.ifThenElseRules,
                        else: prev.ifThenElseRules.else.filter((_, i) => i !== index)
                      }
                    }));
                  }}
                >
                  <i className="fas fa-trash"></i>
                </Button>
              </div>
            ))}
          </div>

          {/* Additional Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="priority">Priority (1-1000)</Label>
              <Input
                id="priority"
                type="number"
                value={workflowData.priority}
                onChange={(e) => setWorkflowData(prev => ({ ...prev, priority: parseInt(e.target.value) || 100 }))}
              />
            </div>
            <div>
              <Label htmlFor="timeout">Timeout (seconds)</Label>
              <Input
                id="timeout"
                type="number"
                value={workflowData.timeout}
                onChange={(e) => setWorkflowData(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30 }))}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={workflowData.isActive}
              onCheckedChange={(checked) => setWorkflowData(prev => ({ ...prev, isActive: checked }))}
            />
            <Label>Active Workflow</Label>
          </div>
        </TabsContent>

        <TabsContent value="json" className="space-y-4">
          <Alert>
            <AlertDescription>
              Configure your workflow using JSON. This provides full control over advanced features like complex conditional logic, custom action parameters, and advanced workflow settings.
            </AlertDescription>
          </Alert>
          <div>
            <Label htmlFor="jsonConfig">JSON Configuration</Label>
            <Textarea
              id="jsonConfig"
              value={jsonConfig}
              onChange={(e) => setJsonConfig(e.target.value)}
              placeholder={JSON.stringify({
                name: "High Value Deal Notification",
                description: "Send notification for deals over $10,000",
                triggerEvent: "document_created",
                ifThenElseRules: {
                  if: [{ field: "amount", operator: "greater_than", value: "10000" }],
                  then: [
                    { type: "update_sugarcrm", module: "Opportunities", field: "sales_stage", value: "Negotiation" },
                    { type: "send_notification", recipients: ["manager@company.com"], subject: "High Value Deal Alert" }
                  ],
                  else: [
                    { type: "log_activity", subject: "Standard deal created" }
                  ]
                },
                priority: 200,
                timeout: 60,
                isActive: true,
                configMode: "json"
              }, null, 2)}
              className="h-96 font-mono text-sm"
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-2">Available trigger events:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>document_signed</code> - Document completed and signed</li>
              <li><code>document_viewed</code> - Document opened by recipient</li>
              <li><code>document_created</code> - New document created</li>
              <li><code>document_declined</code> - Document declined by recipient</li>
              <li><code>document_completed</code> - Document fully processed</li>
              <li><code>document_voided</code> - Document voided</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Workflow'}
        </Button>
      </div>
    </div>
  );
}

export default function Workflows() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [configMode, setConfigMode] = useState<'point_click' | 'json'>('point_click');
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
  const { toast } = useToast();

  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/tenants'],
    queryFn: () => api.getTenants(),
  });

  const { data: workflows = [] } = useQuery({
    queryKey: ['/api/workflows', selectedTenant],
    queryFn: () => selectedTenant ? api.getWorkflows(selectedTenant) : [],
    enabled: !!selectedTenant,
  });

  // Get webhook endpoint for selected tenant
  const webhookEndpoint = selectedTenant 
    ? `${window.location.origin}/webhook?tenantId=${selectedTenant}`
    : null;

  // Create workflow mutation
  const createWorkflow = useMutation({
    mutationFn: async (workflowData: any) => {
      return api.createWorkflow({ ...workflowData, tenantId: selectedTenant });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', selectedTenant] });
      setIsDialogOpen(false);
      setEditingWorkflow(null);
      toast({ title: "Success", description: "Workflow created successfully" });
    },
    onError: (error) => {
      console.error('Workflow creation error:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create workflow", 
        variant: "destructive" 
      });
    },
  });

  // Update workflow mutation
  const updateWorkflow = useMutation({
    mutationFn: async (workflowData: any) => {
      return api.updateWorkflow(editingWorkflow.id, workflowData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', selectedTenant] });
      setIsDialogOpen(false);
      setEditingWorkflow(null);
      toast({ title: "Success", description: "Workflow updated successfully" });
    },
    onError: (error) => {
      console.error('Workflow update error:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to update workflow", 
        variant: "destructive" 
      });
    },
  });

  // Delete workflow mutation
  const deleteWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      return api.deleteWorkflow(workflowId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', selectedTenant] });
      toast({ title: "Success", description: "Workflow deleted successfully" });
    },
    onError: (error) => {
      console.error('Workflow deletion error:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to delete workflow", 
        variant: "destructive" 
      });
    },
  });

  const handleEditWorkflow = (workflow: any) => {
    setEditingWorkflow(workflow);
    setConfigMode(workflow.configMode || 'point_click');
    setIsDialogOpen(true);
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    if (confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
      deleteWorkflow.mutate(workflowId);
    }
  };

  const handleSaveWorkflow = (workflowData: any) => {
    if (editingWorkflow) {
      updateWorkflow.mutate(workflowData);
    } else {
      createWorkflow.mutate(workflowData);
    }
  };

  const sampleWorkflows = [
    {
      id: '1',
      name: 'Document Signed Workflow',
      description: 'Triggered when document.signed event occurs',
      triggerEvent: 'document_signed',
      isActive: true,
      configMode: 'point_click',
      ifThenElseRules: {
        if: [{ field: 'document.status', operator: 'equals', value: 'completed' }],
        then: [
          { type: 'update_sugarcrm', module: 'Opportunities', field: 'sales_stage', value: 'Closed Won' },
          { type: 'attach_document', module: 'Opportunities', field: 'documents' }
        ],
        else: [
          { type: 'log_activity', module: 'Opportunities', subject: 'Document signature incomplete' }
        ]
      },
      actions: [
        { type: 'update_sugarcrm', module: 'Opportunities', field: 'sales_stage', value: 'Closed Won' },
        { type: 'attach_document', module: 'Opportunities', field: 'documents' }
      ]
    },
    {
      id: '2',
      name: 'High Value Deal Approval',
      description: 'Require approval for deals over $50,000',
      triggerEvent: 'document_created',
      isActive: true,
      configMode: 'point_click',
      ifThenElseRules: {
        if: [{ field: 'amount', operator: 'greater_than', value: '50000' }],
        then: [
          { type: 'update_sugarcrm', module: 'Opportunities', field: 'approval_required_c', value: 'Yes' },
          { type: 'send_notification', recipients: ['manager@company.com'], subject: 'High Value Deal Requires Approval' }
        ],
        else: [
          { type: 'update_sugarcrm', module: 'Opportunities', field: 'approval_required_c', value: 'No' }
        ]
      },
      actions: [
        { type: 'update_sugarcrm', module: 'Opportunities', field: 'approval_required_c', value: 'Yes' }
      ]
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
            <Button 
              onClick={() => {
                setEditingWorkflow(null);
                setIsDialogOpen(true);
              }}
              disabled={!selectedTenant}
              className="bg-primary text-white hover:bg-blue-700"
            >
              <i className="fas fa-plus mr-2"></i>
              Add Workflow
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
                  </DialogTitle>
                </DialogHeader>
                <WorkflowEditor 
                  configMode={configMode}
                  setConfigMode={setConfigMode}
                  editingWorkflow={editingWorkflow}
                  onSave={handleSaveWorkflow}
                  isLoading={createWorkflow.isPending || updateWorkflow.isPending}
                />
              </DialogContent>
            </Dialog>
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
        ) : (
          <div className="space-y-6">
            {/* Webhook Endpoint Information */}
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">PandaDoc Webhook Endpoint:</p>
                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded border">
                    <code className="text-sm font-mono">{webhookEndpoint}</code>
                  </div>
                  <p className="text-xs text-gray-600">
                    Configure this URL in your PandaDoc account to receive webhook events.
                    Make sure to set the webhook shared secret in your tenant configuration for security.
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {displayWorkflows.length === 0 ? (
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
              <div className="space-y-4">
                {displayWorkflows.map((workflow: any) => (
                  <Card key={workflow.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 ${workflow.isActive ? 'bg-green-600' : 'bg-blue-600'} rounded-lg flex items-center justify-center mr-3`}>
                            <i className={`fas ${workflow.triggerEvent.includes('signed') ? 'fa-check' : workflow.triggerEvent.includes('viewed') ? 'fa-eye' : 'fa-play'} text-white`}></i>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{workflow.name}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{workflow.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {workflow.triggerEvent.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </Badge>
                              {workflow.configMode && (
                                <Badge variant="secondary" className="text-xs">
                                  {workflow.configMode === 'point_click' ? 'Point & Click' : 'JSON Config'}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={workflow.isActive ? "default" : "secondary"}>
                            {workflow.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => handleEditWorkflow(workflow)}
                          >
                            <i className="fas fa-edit"></i>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                          >
                            <i className="fas fa-trash"></i>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Enhanced workflow display */}
                      {workflow.ifThenElseRules ? (
                        <div className="space-y-4">
                          {/* IF Conditions */}
                          {workflow.ifThenElseRules.if && workflow.ifThenElseRules.if.length > 0 && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                                IF Conditions:
                              </h4>
                              <div className="space-y-1">
                                {workflow.ifThenElseRules.if.map((condition: any, index: number) => (
                                  <div key={index} className="text-sm text-blue-700 dark:text-blue-300">
                                    <code>{condition.field} {condition.operator} "{condition.value}"</code>
                                    {index < workflow.ifThenElseRules.if.length - 1 && (
                                      <span className="ml-2 font-semibold">{condition.logicalOperator || 'AND'}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* THEN Actions */}
                          {workflow.ifThenElseRules.then && workflow.ifThenElseRules.then.length > 0 && (
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                              <h4 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
                                THEN Actions:
                              </h4>
                              <div className="space-y-1">
                                {workflow.ifThenElseRules.then.map((action: any, index: number) => (
                                  <div key={index} className="text-sm text-green-700 dark:text-green-300">
                                    <i className="fas fa-arrow-right mr-2"></i>
                                    {action.type === 'update_sugarcrm' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'send_notification' && (
                                      <span>Send notification: {action.subject}</span>
                                    )}
                                    {action.type === 'log_activity' && (
                                      <span>Log activity: {action.subject}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ELSE Actions */}
                          {workflow.ifThenElseRules.else && workflow.ifThenElseRules.else.length > 0 && (
                            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                              <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">
                                ELSE Actions:
                              </h4>
                              <div className="space-y-1">
                                {workflow.ifThenElseRules.else.map((action: any, index: number) => (
                                  <div key={index} className="text-sm text-orange-700 dark:text-orange-300">
                                    <i className="fas fa-arrow-right mr-2"></i>
                                    {action.type === 'update_sugarcrm' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'log_activity' && (
                                      <span>Log activity: {action.subject}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Legacy actions display */
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                          <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                            {JSON.stringify(workflow.actions, null, 2)}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
