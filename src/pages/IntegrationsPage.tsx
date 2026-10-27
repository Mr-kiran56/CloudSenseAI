import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { Integration } from '../types';
import {
  Workflow,
  MessageSquare,
  Users,
  AlertTriangle,
  Webhook,
  Check,
  Plus,
  Settings,
  Send,
  Trash2,
  X,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Radio,
  Bell
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const IntegrationsPage: React.FC = () => {
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Edit/Configure Modal State
  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [notifyAnomalies, setNotifyAnomalies] = useState(true);
  const [notifyApprovals, setNotifyApprovals] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Add New Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<'slack' | 'teams' | 'discord' | 'pagerduty' | 'webhook'>('slack');
  const [newName, setNewName] = useState('');
  const [newChannel, setNewChannel] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newNotifyAnomalies, setNewNotifyAnomalies] = useState(true);
  const [newNotifyApprovals, setNewNotifyApprovals] = useState(true);
  const [addingInteg, setAddingInteg] = useState(false);

  // Test modal state
  const [modalTestResult, setModalTestResult] = useState<{
    success?: boolean;
    statusCode?: number;
    message?: string;
  } | null>(null);
  const [modalTesting, setModalTesting] = useState(false);

  const loadData = async () => {
    try {
      const res = await apiService.getIntegrations();
      if (res && res.data) {
        setIntegrations(res.data);
      }
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openEditModal = (item: Integration) => {
    setEditingIntegration(item);
    setWebhookUrlInput(item.webhookUrl || '');
    setChannelInput(item.channel || '');
    setNotifyAnomalies(item.autoNotifyAnomalies ?? true);
    setNotifyApprovals(item.autoNotifyApprovals ?? true);
    setModalTestResult(null);
  };

  const handleTestWebhookUrl = async (url: string, type: string) => {
    if (!url || !url.startsWith('http')) {
      addToast({
        type: 'warning',
        title: 'Missing Webhook URL',
        message: 'Please enter a valid HTTP/HTTPS webhook URL before testing.',
      });
      return;
    }

    setModalTesting(true);
    setModalTestResult(null);
    try {
      const res = await apiService.testWebhook({
        url: url.trim(),
        type,
        message: 'Live connection verification test from CloudSense AI console.',
      });
      setModalTestResult(res);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Live Webhook Delivered',
          message: res.message || 'Notification test payload successfully received.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Webhook Test Failed',
          message: res.message || 'Could not deliver test payload.',
        });
      }
    } catch (err: any) {
      setModalTestResult({ success: false, message: err.message || 'Connection error' });
    } finally {
      setModalTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIntegration) return;

    setSavingConfig(true);
    try {
      const res = await apiService.updateIntegration(editingIntegration.id, {
        webhookUrl: webhookUrlInput.trim(),
        channel: channelInput.trim(),
        autoNotifyAnomalies: notifyAnomalies,
        autoNotifyApprovals: notifyApprovals,
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Integration Updated',
          message: `Saved configuration for ${editingIntegration.name}.`,
        });
        setEditingIntegration(null);
        await loadData();
      } else {
        addToast({
          type: 'error',
          title: 'Update Error',
          message: res.error || 'Failed to update integration.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Error occurred while saving.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newChannel.trim()) {
      addToast({
        type: 'warning',
        title: 'Missing Fields',
        message: 'Name and Channel/Service are required.',
      });
      return;
    }

    setAddingInteg(true);
    try {
      const res = await apiService.addIntegration({
        name: newName.trim(),
        type: newType,
        channel: newChannel.trim(),
        webhookUrl: newWebhookUrl.trim(),
        autoNotifyAnomalies: newNotifyAnomalies,
        autoNotifyApprovals: newNotifyApprovals,
      });

      if (res.success) {
        addToast({
          type: 'success',
          title: 'Webhook Connector Added',
          message: `Successfully connected ${newName}.`,
        });
        setIsAddModalOpen(false);
        setNewName('');
        setNewChannel('');
        setNewWebhookUrl('');
        setModalTestResult(null);
        await loadData();
      } else {
        addToast({
          type: 'error',
          title: 'Add Failed',
          message: res.error || 'Could not add integration.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Failed',
        message: err.message || 'Error occurred while adding integration.',
      });
    } finally {
      setAddingInteg(false);
    }
  };

  const handleDeleteIntegration = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to disconnect ${name}?`)) return;

    try {
      const res = await apiService.deleteIntegration(id);
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Integration Removed',
          message: `Disconnected ${name}.`,
        });
        await loadData();
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Removal Error',
        message: 'Could not disconnect integration.',
      });
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'slack':
        return <MessageSquare className="w-5 h-5 text-emerald-500" />;
      case 'teams':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'discord':
        return <Radio className="w-5 h-5 text-indigo-500" />;
      case 'pagerduty':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Webhook className="w-5 h-5 text-amber-500" />;
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            Enterprise Integrations &amp; Webhooks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure live Slack, Microsoft Teams, PagerDuty, Discord and REST webhooks for real-time FinOps alerts
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => {
            setIsAddModalOpen(true);
            setModalTestResult(null);
          }}
        >
          Add Webhook Connector
        </Button>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {integrations.map((item) => {
          const hasUrl = Boolean(item.webhookUrl && item.webhookUrl.trim().length > 5);

          return (
            <Card key={item.id} className="space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                      {getIntegrationIcon(item.type)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">
                        {item.channel || 'Default Channel'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasUrl ? (
                      <Badge variant="success" icon className="text-[10px]">
                        Active URL
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-[10px]">
                        Pending URL
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Webhook Preview Box */}
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Target Webhook Endpoint:</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-mono truncate text-slate-700 dark:text-slate-300">
                    {hasUrl ? item.webhookUrl : 'No webhook URL configured (Click Configure below)'}
                  </p>
                </div>

                {/* Subscribed Events */}
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Subscribed events:</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    {item.autoNotifyAnomalies && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px]">
                        Anomalies
                      </span>
                    )}
                    {item.autoNotifyApprovals && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px]">
                        Approvals
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Settings className="w-3.5 h-3.5" />}
                  onClick={() => openEditModal(item)}
                >
                  Configure &amp; Set Webhook
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!hasUrl || testingId === item.id}
                    icon={<Send className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      setTestingId(item.id);
                      await handleTestWebhookUrl(item.webhookUrl || '', item.type);
                      setTestingId(null);
                    }}
                  >
                    {testingId === item.id ? 'Sending...' : 'Test Ping'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    onClick={() => handleDeleteIntegration(item.id, item.name)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Configure & Set Webhook Modal */}
      {editingIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--cs-bg-card)] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  {getIntegrationIcon(editingIntegration.type)}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--cs-ink)]">
                    Configure {editingIntegration.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Set your incoming webhook URL or integration routing key
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingIntegration(null)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Channel / Room Identifier
                </label>
                <input
                  type="text"
                  value={channelInput}
                  onChange={(e) => setChannelInput(e.target.value)}
                  placeholder="e.g. #finops-alerts or Cloud Squad"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Incoming Webhook URL / Endpoint Key
                  </label>
                  <span className="text-[10px] text-blue-500">
                    {editingIntegration.type === 'slack' && 'From Slack App Incoming Webhooks'}
                    {editingIntegration.type === 'teams' && 'From MS Teams Workflow Webhook'}
                    {editingIntegration.type === 'pagerduty' && 'Events API v2 Routing Key URL'}
                  </span>
                </div>
                <input
                  type="url"
                  required
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder={
                    editingIntegration.type === 'slack'
                      ? 'https://hooks.slack.com/services/T000/B000/XXXXX'
                      : editingIntegration.type === 'teams'
                      ? 'https://outlook.office.com/webhook/XXXXX'
                      : 'https://events.pagerduty.com/v2/enqueue'
                  }
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Notification Toggles */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl space-y-2 border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  Dispatch Triggers:
                </p>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyAnomalies}
                    onChange={(e) => setNotifyAnomalies(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Dispatch on Anomaly Incidents (DoW spikes &amp; budget overruns)</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyApprovals}
                    onChange={(e) => setNotifyApprovals(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Dispatch on Action Approvals Required (Downsize, Purge EBS)</span>
                </label>
              </div>

              {/* Live Test Feedback */}
              {modalTestResult && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    modalTestResult.success
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {modalTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {modalTestResult.success ? 'Webhook Delivered' : 'Delivery Failed'}
                    </p>
                    <p className="text-[11px]">{modalTestResult.message}</p>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={modalTesting || !webhookUrlInput}
                  onClick={() =>
                    handleTestWebhookUrl(webhookUrlInput, editingIntegration.type)
                  }
                >
                  {modalTesting ? 'Sending Ping...' : 'Test Webhook Ping'}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingIntegration(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={savingConfig}
                  >
                    {savingConfig ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Webhook Connector Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[var(--cs-bg-card)] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-[var(--cs-ink)]">
                    Add Webhook Connector
                  </h2>
                  <p className="text-xs text-slate-400">
                    Connect an outbound channel for automated FinOps incident notifications
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIntegration} className="p-5 space-y-4">
              {/* Type Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Connector Platform
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('slack')}
                    className={`py-2 px-2 text-xs rounded-lg flex items-center justify-center gap-1.5 border transition ${
                      newType === 'slack'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Slack
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('teams')}
                    className={`py-2 px-2 text-xs rounded-lg flex items-center justify-center gap-1.5 border transition ${
                      newType === 'teams'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    MS Teams
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('discord')}
                    className={`py-2 px-2 text-xs rounded-lg flex items-center justify-center gap-1.5 border transition ${
                      newType === 'discord'
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    Discord
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. FinOps Core Slack"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Channel / Room
                  </label>
                  <input
                    type="text"
                    required
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    placeholder="#cloud-finops-alerts"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Incoming Webhook URL
                </label>
                <input
                  type="url"
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newWebhookUrl || modalTesting}
                  onClick={() => handleTestWebhookUrl(newWebhookUrl, newType)}
                >
                  {modalTesting ? 'Testing...' : 'Test Webhook'}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={addingInteg}
                  >
                    {addingInteg ? 'Connecting...' : 'Add Connector'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
