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
    triggerEvent: editingWorkflow?.triggerEvent || 'document_state_changed',
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

  // Official PandaDoc webhook events from their documentation
  const triggerEvents = [
    { value: 'recipient_completed', label: 'Recipient Completed', description: 'When a recipient completes their part of the document' },
    { value: 'document_updated', label: 'Document Updated', description: 'When a document is updated or modified' },
    { value: 'document_deleted', label: 'Document Deleted', description: 'When a document is deleted' },
    { value: 'document_state_changed', label: 'Document Status Changed', description: 'When the document status changes (draft, sent, completed, etc.)' },
    { value: 'document_creation_failed', label: 'Document Creation Failed', description: 'When document creation fails' },
    { value: 'document_completed_pdf_ready', label: 'Document Completed & PDF Ready', description: 'When document is completed and PDF is ready for download' },
    { value: 'document_section_added', label: 'Document Section Added', description: 'When a section is added to a document' },
    { value: 'quote_updated', label: 'Quote Updated', description: 'When a quote in the document is updated' },
    { value: 'template_created', label: 'Template Created', description: 'When a new template is created' },
    { value: 'template_updated', label: 'Template Updated', description: 'When a template is updated' },
    { value: 'template_deleted', label: 'Template Deleted', description: 'When a template is deleted' },
    { value: 'content_library_item_created', label: 'Content Library Item Created', description: 'When a content library item is created' },
    { value: 'content_library_item_creation_failed', label: 'Content Library Item Creation Failed', description: 'When content library item creation fails' }
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
    { value: 'update_record', label: 'Update SugarCRM Record', description: 'Update fields in an existing SugarCRM record using PUT /{module}/{id}' },
    { value: 'create_note', label: 'Create Note', description: 'Create a new note record using POST /Notes' },
    { value: 'create_task', label: 'Create Task', description: 'Create a new task record using POST /Tasks' },
    { value: 'create_call', label: 'Create Call Activity', description: 'Create a call activity record using POST /Calls' },
    { value: 'create_meeting', label: 'Create Meeting', description: 'Create a meeting record using POST /Meetings' },
    { value: 'attach_file', label: 'Attach File to Record', description: 'Attach PandaDoc document using POST /{module}/{id}/file/{field}' },
    { value: 'create_relationship', label: 'Create Record Relationship', description: 'Link records together using POST /{module}/{id}/link/{link_name}' },
    { value: 'send_email', label: 'Send Email', description: 'Create and send email using POST /Emails' }
  ];

  const sugarModules = [
    { value: 'Opportunities', label: 'Opportunities', description: 'Sales opportunities and deals' },
    { value: 'Contacts', label: 'Contacts', description: 'Individual contacts and people' },
    { value: 'Accounts', label: 'Accounts', description: 'Companies and organizations' },
    { value: 'Leads', label: 'Leads', description: 'Potential customers and prospects' },
    { value: 'Cases', label: 'Cases', description: 'Customer support cases' },
    { value: 'Notes', label: 'Notes', description: 'Notes and attachments' },
    { value: 'Tasks', label: 'Tasks', description: 'Task and to-do items' },
    { value: 'Calls', label: 'Calls', description: 'Call activities and phone logs' },
    { value: 'Meetings', label: 'Meetings', description: 'Meeting activities and appointments' },
    { value: 'Emails', label: 'Emails', description: 'Email communications' },
    { value: 'Documents', label: 'Documents', description: 'Document storage and management' }
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

  // Sync data when switching tabs
  const handleTabChange = (value: string) => {
    if (value === 'json' && configMode === 'point_click') {
      // Switching from point & click to JSON - update JSON with current workflow data
      setJsonConfig(JSON.stringify(workflowData, null, 2));
    } else if (value === 'point_click' && configMode === 'json') {
      // Switching from JSON to point & click - try to parse JSON into workflow data
      try {
        const parsed = JSON.parse(jsonConfig);
        setWorkflowData({
          name: parsed.name || '',
          description: parsed.description || '',
          triggerEvent: parsed.triggerEvent || 'document_state_changed',
          conditions: parsed.conditions || [],
          ifThenElseRules: parsed.ifThenElseRules || { if: [], then: [], else: [] },
          actions: parsed.actions || [],
          elseActions: parsed.elseActions || [],
          priority: parsed.priority || 100,
          timeout: parsed.timeout || 30,
          isActive: parsed.isActive ?? true,
          configMode: 'point_click'
        });
      } catch (error) {
        // If JSON is invalid, don't switch tabs and show error
        alert('Invalid JSON configuration. Please fix the JSON before switching to Point & Click mode.');
        return;
      }
    }
    setConfigMode(value as 'point_click' | 'json');
  };

  return (
    <div className="space-y-6">
      <Tabs value={configMode} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="point_click">Point & Click Builder</TabsTrigger>
          <TabsTrigger value="json">JSON Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="point_click" className="space-y-6">
          {/* Helper Information */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <h4 className="font-medium">Creating Your Workflow</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li><strong>Choose a PandaDoc webhook event</strong> - This determines when your workflow triggers</li>
                  <li><strong>Add conditions (optional)</strong> - Control when the workflow should run based on document data</li>
                  <li><strong>Define actions</strong> - Specify what should happen in your SugarCRM when the event occurs</li>
                </ol>
                <p className="text-xs text-gray-600 mt-2">
                  <strong>Note:</strong> Make sure to configure the webhook URL in your PandaDoc account settings to receive events.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium">
                Workflow Name *
              </Label>
              <p className="text-xs text-gray-600 mb-2">
                Give your workflow a descriptive name
              </p>
              <Input
                id="name"
                value={workflowData.name}
                onChange={(e) => setWorkflowData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Update Opportunity When Document Signed"
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="triggerEvent" className="text-sm font-medium">
                PandaDoc Webhook Event *
              </Label>
              <p className="text-xs text-gray-600 mb-2">
                Choose which PandaDoc event will trigger this workflow
              </p>
              <Select
                value={workflowData.triggerEvent}
                onValueChange={(value) => setWorkflowData(prev => ({ ...prev, triggerEvent: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a PandaDoc webhook event" />
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {triggerEvents.map(event => (
                    <SelectItem key={event.value} value={event.value}>
                      <div className="flex flex-col">
                        <div className="font-medium">{event.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{event.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <p className="text-xs text-gray-600 mb-2">
              Explain what this workflow will do when triggered
            </p>
            <Textarea
              id="description"
              value={workflowData.description}
              onChange={(e) => setWorkflowData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="e.g., Automatically update the opportunity sales stage to 'Closed Won' and attach the signed document when a PandaDoc document is completed..."
              className="min-h-20"
            />
          </div>

          {/* IF Conditions */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">IF Conditions (Optional)</h3>
                <p className="text-sm text-gray-600">Add conditions to control when this workflow runs</p>
              </div>
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
              <div>
                <h3 className="text-lg font-semibold">THEN Actions</h3>
                <p className="text-sm text-gray-600">What should happen when conditions are met?</p>
              </div>
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
                {/* Update Record Action */}
                {action.type === 'update_record' && (
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
                      placeholder="Field name (e.g., sales_stage)"
                      value={action.field || ''}
                      onChange={(e) => updateAction('then', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="New value (e.g., Closed Won)"
                      value={action.value || ''}
                      onChange={(e) => updateAction('then', index, 'value', e.target.value)}
                    />
                  </>
                )}
                
                {/* Create Note Action */}
                {(action.type === 'create_note' || action.type === 'create_task' || action.type === 'create_call' || action.type === 'create_meeting') && (
                  <>
                    <Input
                      placeholder="Name/Subject"
                      value={action.name || ''}
                      onChange={(e) => updateAction('then', index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={action.description || ''}
                      onChange={(e) => updateAction('then', index, 'description', e.target.value)}
                    />
                    <Input
                      placeholder="Related Module (optional)"
                      value={action.parent_type || ''}
                      onChange={(e) => updateAction('then', index, 'parent_type', e.target.value)}
                    />
                  </>
                )}
                
                {/* Attach File Action */}
                {action.type === 'attach_file' && (
                  <>
                    <Select
                      value={action.module || ''}
                      onValueChange={(value) => updateAction('then', index, 'module', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Target Module" />
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
                      placeholder="Field name (e.g., filename)"
                      value={action.field || ''}
                      onChange={(e) => updateAction('then', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="File source (PandaDoc document)"
                      value={action.source || 'pandadoc_document'}
                      onChange={(e) => updateAction('then', index, 'source', e.target.value)}
                    />
                  </>
                )}
                
                {/* Send Email Action */}
                {action.type === 'send_email' && (
                  <>
                    <Input
                      placeholder="To email address"
                      value={action.to_email || ''}
                      onChange={(e) => updateAction('then', index, 'to_email', e.target.value)}
                    />
                    <Input
                      placeholder="Subject"
                      value={action.subject || ''}
                      onChange={(e) => updateAction('then', index, 'subject', e.target.value)}
                    />
                    <Input
                      placeholder="Message body"
                      value={action.body || ''}
                      onChange={(e) => updateAction('then', index, 'body', e.target.value)}
                    />
                  </>
                )}
                
                {/* Create Relationship Action */}
                {action.type === 'create_relationship' && (
                  <>
                    <Select
                      value={action.source_module || ''}
                      onValueChange={(value) => updateAction('then', index, 'source_module', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Source Module" />
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
                      placeholder="Link name (e.g., accounts)"
                      value={action.link_name || ''}
                      onChange={(e) => updateAction('then', index, 'link_name', e.target.value)}
                    />
                    <Input
                      placeholder="Target record ID"
                      value={action.target_id || ''}
                      onChange={(e) => updateAction('then', index, 'target_id', e.target.value)}
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
                {/* Update Record Action */}
                {action.type === 'update_record' && (
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
                      placeholder="Field name (e.g., sales_stage)"
                      value={action.field || ''}
                      onChange={(e) => updateAction('else', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="New value (e.g., Closed Lost)"
                      value={action.value || ''}
                      onChange={(e) => updateAction('else', index, 'value', e.target.value)}
                    />
                  </>
                )}
                
                {/* Create Activity Actions */}
                {(action.type === 'create_note' || action.type === 'create_task' || action.type === 'create_call' || action.type === 'create_meeting') && (
                  <>
                    <Input
                      placeholder="Name/Subject"
                      value={action.name || ''}
                      onChange={(e) => updateAction('else', index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Description"
                      value={action.description || ''}
                      onChange={(e) => updateAction('else', index, 'description', e.target.value)}
                    />
                    <Input
                      placeholder="Related Module (optional)"
                      value={action.parent_type || ''}
                      onChange={(e) => updateAction('else', index, 'parent_type', e.target.value)}
                    />
                  </>
                )}
                
                {/* Other action types with similar patterns... */}
                {action.type === 'attach_file' && (
                  <>
                    <Select
                      value={action.module || ''}
                      onValueChange={(value) => updateAction('else', index, 'module', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Target Module" />
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
                      placeholder="Field name (e.g., filename)"
                      value={action.field || ''}
                      onChange={(e) => updateAction('else', index, 'field', e.target.value)}
                    />
                    <Input
                      placeholder="File source"
                      value={action.source || 'pandadoc_document'}
                      onChange={(e) => updateAction('else', index, 'source', e.target.value)}
                    />
                  </>
                )}
                
                {action.type === 'send_email' && (
                  <>
                    <Input
                      placeholder="To email address"
                      value={action.to_email || ''}
                      onChange={(e) => updateAction('else', index, 'to_email', e.target.value)}
                    />
                    <Input
                      placeholder="Subject"
                      value={action.subject || ''}
                      onChange={(e) => updateAction('else', index, 'subject', e.target.value)}
                    />
                    <Input
                      placeholder="Message body"
                      value={action.body || ''}
                      onChange={(e) => updateAction('else', index, 'body', e.target.value)}
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
              <div className="space-y-2">
                <h4 className="font-medium">JSON Configuration</h4>
                <p className="text-sm">
                  Edit the workflow configuration directly in JSON format. Any changes made in the Point & Click builder will be automatically reflected here.
                </p>
                <p className="text-xs text-gray-600">
                  <strong>Tip:</strong> Switch back to Point & Click mode to see your JSON changes reflected in the visual interface.
                </p>
              </div>
            </AlertDescription>
          </Alert>
          <div>
            <Label htmlFor="jsonConfig" className="text-sm font-medium">
              Workflow JSON Configuration
            </Label>
            <Textarea
              id="jsonConfig"
              value={jsonConfig}
              onChange={(e) => setJsonConfig(e.target.value)}
              placeholder={JSON.stringify({
                name: "Document Completion Workflow",
                description: "Update opportunity when document is completed",
                triggerEvent: "document_state_changed",
                ifThenElseRules: {
                  if: [{ field: "document.status", operator: "equals", value: "completed" }],
                  then: [
                    { type: "update_record", module: "Opportunities", field: "sales_stage", value: "Closed Won" },
                    { type: "attach_file", module: "Opportunities", field: "filename", source: "pandadoc_document" }
                  ],
                  else: [
                    { type: "create_note", name: "Document Status Change", description: "Document status changed but not completed" }
                  ]
                },
                priority: 100,
                timeout: 30,
                isActive: true,
                configMode: "json"
              }, null, 2)}
              className="h-96 font-mono text-sm mt-2"
            />
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-semibold mb-2">Official PandaDoc Webhook Events:</p>
            <div className="grid grid-cols-2 gap-4">
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><code>recipient_completed</code> - Recipient completed their part</li>
                <li><code>document_updated</code> - Document was updated</li>
                <li><code>document_deleted</code> - Document was deleted</li>
                <li><code>document_state_changed</code> - Document status changed</li>
                <li><code>document_creation_failed</code> - Document creation failed</li>
                <li><code>document_completed_pdf_ready</code> - Document completed & PDF ready</li>
                <li><code>document_section_added</code> - Section added to document</li>
              </ul>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><code>quote_updated</code> - Quote was updated</li>
                <li><code>template_created</code> - Template was created</li>
                <li><code>template_updated</code> - Template was updated</li>
                <li><code>template_deleted</code> - Template was deleted</li>
                <li><code>content_library_item_created</code> - Content library item created</li>
                <li><code>content_library_item_creation_failed</code> - Content library creation failed</li>
              </ul>
            </div>
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
                                {workflow.triggerEvent.split('_').map((word: string) => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
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
                            variant="outline" 
                            size="sm" 
                            className="text-blue-600 hover:text-blue-700 border-blue-200"
                            onClick={() => handleEditWorkflow(workflow)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700 border-red-200"
                            onClick={() => handleDeleteWorkflow(workflow.id)}
                          >
                            Delete
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
                                    {action.type === 'update_record' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'update_sugarcrm' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'create_note' && (
                                      <span>Create note: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_task' && (
                                      <span>Create task: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_call' && (
                                      <span>Create call activity: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_meeting' && (
                                      <span>Create meeting: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'attach_file' && (
                                      <span>Attach file to {action.module}</span>
                                    )}
                                    {action.type === 'send_email' && (
                                      <span>Send email: {action.subject}</span>
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
                                    {action.type === 'update_record' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'update_sugarcrm' && (
                                      <span>Update {action.module}.{action.field} to "{action.value}"</span>
                                    )}
                                    {action.type === 'create_note' && (
                                      <span>Create note: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_task' && (
                                      <span>Create task: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_call' && (
                                      <span>Create call activity: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'create_meeting' && (
                                      <span>Create meeting: {action.name || action.subject}</span>
                                    )}
                                    {action.type === 'attach_file' && (
                                      <span>Attach file to {action.module}</span>
                                    )}
                                    {action.type === 'send_email' && (
                                      <span>Send email: {action.subject}</span>
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
