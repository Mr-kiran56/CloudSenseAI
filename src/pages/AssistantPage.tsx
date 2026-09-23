import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AssistantMessage } from '../types';
import { mockAssistantInitialMessages, mockRecommendations } from '../services/mockData';
import {
  Send,
  User,
  ExternalLink,
  CheckSquare,
  Plus,
  Sparkles,
  Cloud,
  ShieldAlert,
  Gauge,
  Trash2,
  Mic,
  Paperclip,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatMarkdown } from '../components/chat/ChatMarkdown';

type Thread = {
  id: string;
  title: string;
  preview: string;
  messages: AssistantMessage[];
};

const suggestedPrompts = [
  { label: 'Why did spend rise?', prompt: 'Why did our cloud spend increase this week?', icon: Cloud, color: '#7eb6ff' },
  { label: 'Find savings', prompt: 'What are our largest optimization opportunities?', icon: Gauge, color: '#7dd3c7' },
  { label: 'Idle resources', prompt: 'Show resources with low utilization.', icon: Sparkles, color: '#c4b5fd' },
  { label: 'DoW check', prompt: 'Is there any suspicious cloud spending or DoW attacks?', icon: ShieldAlert, color: '#f9a8d4' },
];

function replyFor(query: string): Omit<AssistantMessage, 'id' | 'sender' | 'timestamp'> {
  const q = query.toLowerCase();
  if (q.includes('spend') || q.includes('increase')) {
    return {
      text: `Based on CloudSense AI's **Prophet forecasting and SHAP attribution models**, spend increased **+8.4%** this week ($24,680 MTD).

**Primary Drivers:**
1. **Amazon EC2 (+12.4%):** Unscaled \`c5.4xlarge\` instance \`i-094ab2910c83a71b\` operating at 6.2% average CPU load.
2. **EBS GP2 Volumes (+18.5%):** 42-day unattached disk \`vol-0941fca8291a104\` ($215/mo).
3. **NAT Gateway Cross-AZ Traffic:** Missing VPC Gateway Endpoint for S3.

I can open the forecast workspace or prepare a rightsizing approval.`,
      citations: [
        { label: 'Prophet Cost Workspace', link: '/cost' },
        { label: 'Resource Explorer', link: '/resources' },
      ],
      toolCalls: [
        { tool: 'prophet.forecast', args: 'window=7d', status: 'completed' },
        { tool: 'shap.explain', args: 'service=EC2', status: 'completed' },
      ],
    };
  }
  if (q.includes('opportunity') || q.includes('optimization')) {
    return {
      text: `CloudSense AI identified **4 actionable recommendations** totaling **$6,840/month** in potential savings:

| Resource | Service | Monthly Savings | Risk |
| :--- | :--- | :--- | :--- |
| \`payment-processing-worker-04\` | EC2 | **+$248 / mo** | Low |
| \`legacy-mongodb-data-disk\` | EBS | **+$215 / mo** | Low |
| \`analytics-warehouse-replica\` | RDS | **+$640 / mo** | Medium |
| \`vpc-ap-south-1a-nat-gateway\` | NAT Gateway | **+$480 / mo** | High |

Would you like me to prepare an approval ticket for the EC2 rightsizing action?`,
      citations: [{ label: 'Recommendations Center', link: '/recommendations' }],
      approvalTrigger: mockRecommendations[0],
      toolCalls: [{ tool: 'reco.rank', args: 'horizon=30d', status: 'completed' }],
    };
  }
  if (q.includes('suspicious') || q.includes('dow')) {
    return {
      text: `⚠️ **Potential Denial-of-Wallet (DoW) Detected!**
The **Isolation Forest Engine** flagged extreme cost velocity on Lambda route \`/auth/token\` (+1,420% request rate spike, cost velocity +$185/hr).

I recommend applying automated WAF rate-limiting via the Security Monitoring panel.`,
      citations: [{ label: 'DoW Incident Center', link: '/anomalies' }],
      toolCalls: [{ tool: 'iforest.score', args: 'service=Lambda', status: 'completed' }],
    };
  }
  if (q.includes('utilization') || q.includes('idle') || q.includes('low')) {
    return {
      text: `I scanned CloudWatch CPU, network, and attachment signals.

- **EC2** \`payment-processing-worker-04\` — 6.2% CPU, candidate for downsize
- **EBS** \`vol-0941fca8291a104\` — unattached 42 days
- **RDS** replica \`analytics-warehouse-replica\` — <8% connections

Open Resource Explorer to filter by idle score.`,
      citations: [{ label: 'Resource Explorer', link: '/resources' }],
    };
  }
  if (q.includes('resize') || q.includes('worker-04') || q.includes('what happens')) {
    return {
      text: `If we resize \`payment-processing-worker-04\` from \`c5.4xlarge\` to \`c5.xlarge\`:

- **Est. savings:** **$248 / month**
- **Risk:** Low — CPU p95 remains under 45% in the last 14 days
- **Rollback:** previous instance type stored on the approval record

I can send this to governance review — nothing will change in AWS until someone approves.`,
      citations: [{ label: 'What-if simulator', link: '/simulator' }],
      approvalTrigger: mockRecommendations[0],
    };
  }
  return {
    text: `I evaluated your request against current CloudWatch telemetry and AWS account state.

Everything is operating within expected bounds. You can review full telemetry in the **Resource Explorer**, or ask me about spend, idle resources, or Denial-of-Wallet risk.`,
    citations: [{ label: 'Resource Explorer', link: '/resources' }],
  };
}

export const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useApp();
  const [threads, setThreads] = useState<Thread[]>([
    {
      id: 't1',
      title: 'Cloud cost & DoW audit',
      preview: 'Hello — here is your environment snapshot',
      messages: mockAssistantInitialMessages,
    },
    {
      id: 't2',
      title: 'EC2 rightsizing analysis',
      preview: 'c5.4xlarge at 6.2% CPU',
      messages: mockAssistantInitialMessages,
    },
    {
      id: 't3',
      title: 'Unit cost forecast Q4',
      preview: 'Prophet interval vs budget',
      messages: mockAssistantInitialMessages,
    },
  ]);
  const [activeId, setActiveId] = useState('t1');
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const active = useMemo(() => threads.find((t) => t.id === activeId)!, [threads, activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active.messages, isGenerating, thinkingSteps]);

  const updateActive = (messages: AssistantMessage[], title?: string) => {
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeId
          ? {
              ...t,
              messages,
              title: title || t.title,
              preview:
                messages[messages.length - 1]?.text.replace(/\*\*|`/g, '').slice(0, 48) || t.preview,
            }
          : t
      )
    );
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isGenerating) return;

    const userMsg: AssistantMessage = {
      id: `msg_${Math.random().toString(36).slice(2, 7)}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const next = [...active.messages, userMsg];
    updateActive(next, active.messages.length < 2 ? query.slice(0, 36) : undefined);
    setInputQuery('');
    setIsGenerating(true);
    setThinkingSteps(['Reading AWS telemetry', 'Running models', 'Drafting an explained answer']);

    window.setTimeout(() => setThinkingSteps((s) => s.slice(1)), 280);
    window.setTimeout(() => setThinkingSteps((s) => s.slice(1)), 520);

    window.setTimeout(() => {
      const payload = replyFor(query);
      const aiMsg: AssistantMessage = {
        id: `msg_${Math.random().toString(36).slice(2, 7)}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...payload,
      };
      updateActive([...next, aiMsg]);
      setIsGenerating(false);
      setThinkingSteps([]);
    }, 900);
  };

  const newChat = () => {
    const id = `t_${Date.now()}`;
    setThreads((prev) => [
      {
        id,
        title: 'New conversation',
        preview: 'Ask about spend, idle cloud, or DoW',
        messages: mockAssistantInitialMessages,
      },
      ...prev,
    ]);
    setActiveId(id);
    addToast({ type: 'info', title: 'New conversation', message: 'Assistant reset to a fresh workspace brief.' });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="-mx-4 -my-5 md:-mx-6 md:-my-6 h-[calc(100vh-56px)] flex overflow-hidden bg-transparent">
      <aside className="hidden lg:flex w-[280px] flex-col border-r border-[var(--cs-line)] bg-white/70 backdrop-blur-md">
        <div className="p-3">
          <Button variant="primary" size="sm" className="w-full justify-center rounded-full" icon={<Plus className="w-4 h-4" />} onClick={newChat}>
            New chat
          </Button>
        </div>
        <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--cs-ink-3)]">Recent</p>
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveId(t.id)}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition-colors ${
                t.id === activeId
                  ? 'bg-[#e8f0fe] text-[#174ea6]'
                  : 'hover:bg-white text-[var(--cs-ink-2)]'
              }`}
            >
              <p className="text-[13px] font-medium truncate">{t.title}</p>
              <p className="text-[11px] text-[var(--cs-ink-3)] truncate">{t.preview}</p>
            </button>
          ))}
        </div>
        <button
          className="m-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] text-[var(--cs-ink-3)] hover:bg-white"
          onClick={() => {
            setThreads((prev) => prev.filter((t) => t.id === activeId));
            addToast({ type: 'info', title: 'History cleared', message: 'Older threads were removed from this session.' });
          }}
        >
          <Trash2 className="w-3.5 h-3.5" /> Clear others
        </button>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        <header className="px-4 md:px-6 py-3 border-b border-[var(--cs-line)] bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="cs-avatar-ring p-[2px] rounded-full">
              <div className="h-9 w-9 rounded-full bg-white grid place-items-center">
                <Cloud className="w-4 h-4 text-[#4285F4]" />
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold truncate">CloudSense copilot</h2>
              <p className="text-[11px] text-[var(--cs-ink-3)]">FinOps answers with citations — never silent AWS changes</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--cs-ink-3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34A853]" />
            Models online
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-3 md:px-5 py-4">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            {active.messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex gap-2.5 w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  {isUser ? (
                    <div className="h-8 w-8 rounded-full bg-[#1a73e8] text-white grid place-items-center shrink-0 mt-5">
                      <User className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="cs-avatar-ring p-[2px] rounded-full h-8 w-8 shrink-0 mt-5">
                      <div className="h-full w-full rounded-full bg-white grid place-items-center">
                        <Sparkles className="w-3.5 h-3.5 text-[#EA4335]" />
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col min-w-0 ${isUser ? 'items-end max-w-[min(100%,72%)]' : 'items-stretch flex-1'}`}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-[var(--cs-ink-3)]">
                      <span className="font-medium text-[var(--cs-ink-2)]">{isUser ? 'You' : 'CloudSense AI'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {msg.toolCalls.map((tool) => (
                          <span
                            key={tool.tool}
                            className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--cs-line)] px-2 py-0.5 font-mono text-[10px] text-[var(--cs-ink-3)]"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[#34A853]" />
                            {tool.tool}
                          </span>
                        ))}
                      </div>
                    )}

                    <div
                      className={
                        isUser
                          ? 'rounded-2xl rounded-tr-md bg-[#1a73e8] text-white px-3.5 py-2.5 shadow-[0_8px_20px_rgba(26,115,232,0.25)]'
                          : 'w-full rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 border border-white shadow-[0_8px_28px_rgba(60,64,67,0.08)]'
                      }
                    >
                      {isUser ? (
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      ) : (
                        <ChatMarkdown text={msg.text} />
                      )}
                    </div>

                    {msg.citations && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.citations.map((c) => (
                          <button
                            key={c.link}
                            onClick={() => navigate(c.link)}
                            className="inline-flex items-center gap-1 rounded-full bg-white border border-[var(--cs-line)] px-2.5 py-1 text-[11px] text-[#174ea6] hover:bg-[#e8f0fe]"
                          >
                            {c.label}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.approvalTrigger && (
                      <div className="mt-3 rounded-2xl border border-[#fde293] bg-[#fef7e0] p-3">
                        <div className="flex items-center gap-2 text-[#b06000] text-[12px] font-semibold">
                          <CheckSquare className="w-4 h-4" />
                          Prepared for human approval
                        </div>
                        <p className="mt-1 text-[13px] text-[var(--cs-ink-2)]">
                          {msg.approvalTrigger.title} · +${msg.approvalTrigger.monthlySavings}/mo
                        </p>
                        <Button
                          variant="success"
                          size="sm"
                          className="mt-2 rounded-full"
                          onClick={() => navigate(`/recommendations/${msg.approvalTrigger!.id}`)}
                        >
                          Open governance review
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isGenerating && (
              <div className="flex gap-3">
                <div className="cs-avatar-ring p-[2px] rounded-full h-9 w-9 shrink-0">
                  <div className="h-full w-full rounded-full bg-white grid place-items-center">
                    <Sparkles className="w-4 h-4 text-[#4285F4]" />
                  </div>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 shadow-sm border border-white">
                  <div className="cs-typing" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  {thinkingSteps[0] && (
                    <p className="mt-2 text-[12px] text-[var(--cs-ink-3)]">{thinkingSteps[0]}…</p>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="px-3 md:px-5 pb-4">
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {suggestedPrompts.map((p) => (
                <button
                  key={p.label}
                  onClick={() => handleSendMessage(p.prompt)}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-white border border-[var(--cs-line)] px-3 py-1.5 text-[12px] text-[var(--cs-ink-2)] hover:shadow-md"
                >
                  <p.icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rounded-3xl bg-white border border-[var(--cs-line)] shadow-[0_12px_40px_rgba(60,64,67,0.12)] p-2 pl-4 flex items-end gap-2">
              <button type="button" className="mb-2 text-[var(--cs-ink-3)]" aria-label="Attach context" disabled>
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask about spend, idle resources, or Denial-of-Wallet risk…"
                className="flex-1 max-h-32 resize-none bg-transparent py-2.5 text-[14px] outline-none placeholder:text-[var(--cs-ink-3)]"
              />
              <button type="button" className="mb-2 text-[var(--cs-ink-3)]" aria-label="Voice input unavailable" disabled>
                <Mic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isGenerating || !inputQuery.trim()}
                className="mb-0.5 h-10 w-10 rounded-full bg-[var(--cs-brand)] text-white grid place-items-center disabled:opacity-40 shadow-[0_6px_16px_rgba(26,115,232,0.35)]"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--cs-ink-3)]">
              Answers cite console pages. Approvals are required before any AWS change.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
