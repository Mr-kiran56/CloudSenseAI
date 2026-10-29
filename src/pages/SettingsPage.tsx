import React, { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PageHeader, SegmentedControl } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { User, Shield, Bell, Cpu, Key, Sun, Workflow, Cloud, Sparkles, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const sections = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'ai', label: 'AI & forecasting', icon: Cpu },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'access', label: 'Access control', icon: Key },
  { id: 'integrations', label: 'Integrations', icon: Workflow },
  { id: 'accounts', label: 'Cloud accounts', icon: Cloud },
];

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme, addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [density, setDensity] = useState<'Comfortable' | 'Compact'>('Comfortable');
  
  // LLM Configuration State
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openai' | 'groq' | 'bedrock'>('gemini');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [llmConfigured, setLlmConfigured] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingLlm, setSavingLlm] = useState(false);

  useEffect(() => {
    async function fetchLLM() {
      try {
        const res = await apiService.getLLMConfig();
        if (res) {
          setLlmProvider((res.provider as any) || 'gemini');
          setLlmModel(res.model || 'gemini-2.5-flash');
          setLlmBaseUrl(res.base_url || '');
          setLlmConfigured(res.is_configured || false);
          if (res.api_key_masked) {
            setLlmApiKey(res.api_key_masked);
          }
        }
      } catch (e) {
        console.warn('Could not load LLM config:', e);
      }
    }
    fetchLLM();
  }, []);

  const handleSaveLLM = async () => {
    setSavingLlm(true);
    try {
      const res = await apiService.saveLLMConfig({
        provider: llmProvider,
        api_key: llmApiKey.includes('...') ? '' : llmApiKey,
        model: llmModel,
        base_url: llmBaseUrl,
      });
      if (res.success) {
        setLlmConfigured(res.is_configured || false);
        addToast({
          type: 'success',
          title: 'LLM Agent Configured',
          message: res.message || 'LLM provider settings updated successfully.',
        });
      } else {
        addToast({
          type: 'error',
          title: 'Failed to Save LLM',
          message: res.message || 'Could not save LLM settings.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error Saving LLM',
        message: err.message || 'Network error.',
      });
    } finally {
      setSavingLlm(false);
    }
  };

  const pathSection = location.pathname.split('/')[2];
  const active = sections.some((s) => s.id === pathSection) ? pathSection : 'profile';

  const visible = useMemo(
    () => sections.filter((s) => s.label.toLowerCase().includes(query.toLowerCase())),
    [query]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="Profile, appearance, notification routing, model thresholds, and access. Preferences persist through the API layer when connected."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        <Card className="p-2 h-fit">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings"
            className="w-full h-8 mb-2 px-2.5 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)]"
          />
          {visible.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/settings/${s.id}`)}
              className={`w-full text-left px-2.5 h-9 text-[13px] rounded-[4px] flex items-center gap-2 ${
                active === s.id
                  ? 'bg-[var(--cs-brand-soft)] text-[var(--cs-brand)] font-medium'
                  : 'text-[var(--cs-ink-2)] hover:bg-[var(--cs-muted)]'
              }`}
            >
              <s.icon className="w-4 h-4" /> {s.label}
            </button>
          ))}
        </Card>

        <div className="space-y-4">
          {active === 'profile' && (
            <Card>
              <CardHeader title="Profile" subtitle="Shown in audit events and approvals" />
              <dl className="grid sm:grid-cols-2 gap-4 text-[13px]">
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Name</dt>
                  <dd className="mt-0.5 font-medium">{user.name}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Email</dt>
                  <dd className="mt-0.5 font-medium">{user.email}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Role</dt>
                  <dd className="mt-0.5 font-medium capitalize">{user.role.replace('_', ' ')}</dd>
                </div>
                <div>
                  <dt className="text-[var(--cs-ink-3)]">Title</dt>
                  <dd className="mt-0.5 font-medium">{user.title}</dd>
                </div>
              </dl>
            </Card>
          )}

          {(active === 'appearance' || active === 'profile') && (
            <Card>
              <CardHeader title="Appearance" />
              <div className="space-y-4 text-[13px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Theme</p>
                    <p className="text-[12px] text-[var(--cs-ink-3)]">Light is the default console surface.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={theme === 'light' ? 'primary' : 'outline'} size="sm" onClick={() => setTheme('light')}>
                      Light
                    </Button>
                    <Button variant={theme === 'dark' ? 'primary' : 'outline'} size="sm" onClick={() => setTheme('dark')}>
                      Dark
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--cs-line)] pt-4">
                  <div>
                    <p className="font-medium">Density</p>
                    <p className="text-[12px] text-[var(--cs-ink-3)]">Compact tightens tables for operations work.</p>
                  </div>
                  <SegmentedControl
                    options={['Comfortable', 'Compact']}
                    value={density}
                    onChange={(v) => setDensity(v as 'Comfortable' | 'Compact')}
                  />
                </div>
              </div>
            </Card>
          )}

          {active === 'ai' && (
            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Conversational AI & LLM Copilot"
                  subtitle="Configure the real Large Language Model engine that powers the FinOps Assistant"
                />
                <div className="space-y-4 text-[13px]">
                  <div className="flex items-center justify-between p-3 rounded-[6px] bg-[var(--cs-surface)] border border-[var(--cs-line)]">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-4 h-4 text-[var(--cs-brand)]" />
                      <div>
                        <p className="font-medium text-[var(--cs-ink)]">
                          Active Model Engine: <span className="text-[var(--cs-brand)] capitalize">{llmProvider}</span> ({llmModel})
                        </p>
                        <p className="text-[12px] text-[var(--cs-ink-3)]">
                          {llmConfigured
                            ? 'Real LLM API connected with live AWS telemetry & ML RAG context.'
                            : 'No API key entered. Running in local FinOps RAG fallback mode.'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${
                        llmConfigured
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {llmConfigured ? 'Live LLM Active' : 'API Key Required'}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--cs-ink-2)] mb-1">
                        LLM Provider
                      </label>
                      <select
                        value={llmProvider}
                        onChange={(e) => {
                          const p = e.target.value as any;
                          setLlmProvider(p);
                          if (p === 'gemini') setLlmModel('gemini-2.5-flash');
                          else if (p === 'groq') setLlmModel('llama-3.3-70b-versatile');
                          else if (p === 'bedrock') setLlmModel('anthropic.claude-3-sonnet-20240229-v1:0');
                          else setLlmModel('gpt-4o');
                        }}
                        className="w-full h-9 px-3 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)] text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)]"
                      >
                        <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro)</option>
                        <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                        <option value="groq">Groq / Llama 3 (Fast Cloud)</option>
                        <option value="bedrock">AWS Bedrock (Claude 3 on AWS)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[var(--cs-ink-2)] mb-1">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        placeholder="e.g. gemini-2.5-flash or gpt-4o"
                        className="w-full h-9 px-3 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)] text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[var(--cs-ink-2)] mb-1">
                      API Key
                    </label>
                    <div className="relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder={
                          llmProvider === 'gemini'
                            ? 'Enter Google Gemini API Key'
                            : llmProvider === 'groq'
                            ? 'Enter Groq API Key (gsk_...)'
                            : llmProvider === 'bedrock'
                            ? 'Uses connected AWS account IAM credentials'
                            : 'Enter OpenAI API Key (sk-...)'
                        }
                        className="w-full h-9 pl-3 pr-10 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)] text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)] font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2.5 top-2.5 text-[var(--cs-ink-3)] hover:text-[var(--cs-ink)]"
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--cs-ink-3)] mt-1">
                      Your key is securely transmitted to the CloudSense backend and never exposed in browser logs.
                    </p>
                  </div>

                  {llmProvider !== 'gemini' && llmProvider !== 'bedrock' && (
                    <div>
                      <label className="block text-[12px] font-medium text-[var(--cs-ink-2)] mb-1">
                        Custom Base URL (Optional for Ollama / Local / DeepSeek)
                      </label>
                      <input
                        type="text"
                        value={llmBaseUrl}
                        onChange={(e) => setLlmBaseUrl(e.target.value)}
                        placeholder="e.g. http://localhost:11434/v1 or https://api.groq.com/openai/v1"
                        className="w-full h-9 px-3 text-[13px] rounded-[4px] border border-[var(--cs-line)] bg-[var(--cs-bg)] text-[var(--cs-ink)] focus:outline-none focus:border-[var(--cs-brand)] font-mono"
                      />
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={handleSaveLLM} disabled={savingLlm}>
                      {savingLlm ? 'Connecting...' : 'Save & Test LLM Connection'}
                    </Button>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Anomaly Detection Sensitivity"
                  subtitle="Adjust Isolation Forest sensitivity threshold for Denial-of-Wallet (DoW) scoring."
                />
                <label className="block text-[13px]">
                  Isolation Forest sensitivity
                  <input type="range" min={0.5} max={0.99} step={0.01} defaultValue={0.85} className="w-full mt-2 accent-[var(--cs-brand)]" />
                  <span className="text-[12px] text-[var(--cs-ink-3)]">Higher values reduce false positives.</span>
                </label>
              </Card>
            </div>
          )}

          {active === 'security' && (
            <Card>
              <CardHeader title="Security" />
              <p className="text-[13px] leading-6 text-[var(--cs-ink-2)]">
                AWS access keys, webhook secrets, and session tokens are never stored in localStorage. Account IDs are
                masked in the console. State-changing actions require confirmation and backend authorization.
              </p>
            </Card>
          )}

          {active === 'notifications' && (
            <Card>
              <CardHeader title="Notification channels" />
              <p className="text-[13px] text-[var(--cs-ink-2)]">
                Route cost, DoW, approval, and remediation events in the Integrations workspace. Email is the default
                for this demo.
              </p>
            </Card>
          )}

          {['access', 'integrations', 'accounts'].includes(active) && (
            <Card>
              <CardHeader title={sections.find((s) => s.id === active)?.label || ''} />
              <p className="text-[13px] text-[var(--cs-ink-2)]">
                Managed in the matching console area. This settings search exists so operators can find the control
                without hunting the sidebar.
              </p>
              <Button
                className="mt-3"
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(active === 'accounts' ? '/cloud-accounts' : active === 'integrations' ? '/integrations' : '/approvals')
                }
              >
                Open related workspace
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
