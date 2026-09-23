import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { AssistantMessage } from '../types';
import { mockAssistantInitialMessages, mockRecommendations } from '../services/mockData';
import {
  Sparkles,
  Send,
  User,
  Bot,
  ExternalLink,
  CheckSquare,
  Terminal,
  Search,
  MessageSquare,
  Plus,
  Trash2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useApp();
  const [messages, setMessages] = useState<AssistantMessage[]>(mockAssistantInitialMessages);
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'Why did our cloud spend increase this week?',
    'What are our largest optimization opportunities?',
    'Show resources with low utilization.',
    'Is there any suspicious cloud spending or DoW attacks?',
    'What happens if I resize EC2 payment-processing-worker-04?',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isGenerating) return;

    const userMsg: AssistantMessage = {
      id: `msg_${Math.random().toString(36).substring(2, 7)}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsGenerating(true);

    // Simulate streaming AI reasoning & response dispatch
    setTimeout(() => {
      let aiText = `I have analyzed your query: **"${query}"**.`;
      let citations: { label: string; link: string }[] | undefined;
      let approvalTrigger = undefined;

      if (query.toLowerCase().includes('spend') || query.toLowerCase().includes('increase')) {
        aiText = `Based on CloudSense AI's **Prophet forecasting and SHAP attribution models**, spend increased **+8.4%** this week ($24,680 MTD).

**Primary Drivers:**
1. **Amazon EC2 (+12.4%):** Unscaled \`c5.4xlarge\` instance \`i-094ab2910c83a71b\` operating at 6.2% average CPU load.
2. **EBS GP2 Volumes (+18.5%):** 42-day unattached disk \`vol-0941fca8291a104\` ($215/mo).
3. **NAT Gateway Cross-AZ Traffic:** Missing VPC Gateway Endpoint for S3.`;
        citations = [
          { label: 'Prophet Cost Workspace', link: '/cost' },
          { label: 'Resource Explorer', link: '/resources' },
        ];
      } else if (query.toLowerCase().includes('opportunity') || query.toLowerCase().includes('optimization')) {
        aiText = `CloudSense AI identified **4 actionable recommendations** totaling **$6,840/month** in potential savings:

| Resource | Service | Monthly Savings | Risk |
| :--- | :--- | :--- | :--- |
| \`payment-processing-worker-04\` | EC2 | **+$248 / mo** | Low |
| \`legacy-mongodb-data-disk\` | EBS | **+$215 / mo** | Low |
| \`analytics-warehouse-replica\` | RDS | **+$640 / mo** | Medium |
| \`vpc-ap-south-1a-nat-gateway\` | NAT Gateway | **+$480 / mo** | High |

Would you like me to prepare an approval ticket for the EC2 rightsizing action?`;
        citations = [{ label: 'Recommendations Center', link: '/recommendations' }];
        approvalTrigger = mockRecommendations[0];
      } else if (query.toLowerCase().includes('suspicious') || query.toLowerCase().includes('dow')) {
        aiText = `⚠️ **Potential Denial-of-Wallet (DoW) Detected!**
The **Isolation Forest Engine** flagged extreme cost velocity on Lambda route \`/auth/token\` (+1,420% request rate spike, cost velocity +$185/hr).

I recommend applying automated WAF rate-limiting via the Security Monitoring panel.`;
        citations = [{ label: 'DoW Incident Center', link: '/anomalies' }];
      } else {
        aiText = `I have evaluated your request against current CloudWatch telemetry and AWS account state. Everything is operating normally. You can review full telemetry in the **Resource Explorer**.`;
        citations = [{ label: 'Resource Explorer', link: '/resources' }];
      }

      const aiMsg: AssistantMessage = {
        id: `msg_${Math.random().toString(36).substring(2, 7)}`,
        sender: 'assistant',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations,
        approvalTrigger,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsGenerating(false);
    }, 800);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6 overflow-hidden">
      {/* Sidebar: Conversation History (Desktop) */}
      <Card className="hidden lg:flex flex-col w-64 p-3 shrink-0">
        <Button
          variant="primary"
          size="sm"
          className="w-full justify-start"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setMessages(mockAssistantInitialMessages);
            addToast({ type: 'info', title: 'New Conversation', message: 'Chat history reset.' });
          }}
        >
          New Chat
        </Button>

        <div className="flex items-center px-2 pt-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Recent Conversations
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pt-2 text-xs">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold rounded-md border border-blue-200 dark:border-blue-900/40 flex items-center justify-between">
            <span className="truncate">Cloud Cost & DoW Audit</span>
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          </div>
          <div className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md truncate cursor-pointer">
            EC2 Rightsizing Analysis
          </div>
          <div className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md truncate cursor-pointer">
            Unit Cost Forecast Q4
          </div>
        </div>
      </Card>

      {/* Main Chat Interface */}
      <Card className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">CloudSense AI Assistant</h2>
              <p className="text-[10px] text-slate-400 font-mono">FinOps & SecOps Natural Language Copilot</p>
            </div>
          </div>
          <Badge variant="ai" icon>Model Context Protocol (MCP)</Badge>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className={`flex gap-3 text-xs ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-indigo-600 text-white shadow-sm'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`space-y-2 max-w-2xl ${isUser ? 'items-end text-right' : 'items-start'}`}>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {isUser ? 'You' : 'CloudSense AI'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-4 rounded-xl leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-blue-600 text-white font-medium shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Evidence Citations */}
                  {msg.citations && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-[10px] font-semibold text-slate-400">Evidence Citations:</span>
                      {msg.citations.map((c, idx) => (
                        <button
                          key={idx}
                          onClick={() => navigate(c.link)}
                          className="inline-flex items-center text-[10px] font-mono text-indigo-600 dark:text-indigo-400 hover:underline gap-1 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded"
                        >
                          <span>{c.label}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Approval Trigger Component */}
                  {msg.approvalTrigger && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-2 text-left">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                        <CheckSquare className="w-4 h-4" />
                        <span>Action Prepared for Human Approval</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        {msg.approvalTrigger.title} (+${msg.approvalTrigger.monthlySavings}/mo savings)
                      </p>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => navigate(`/recommendations/${msg.approvalTrigger!.id}`)}
                      >
                        Open Governance Review
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isGenerating && (
            <div className="flex items-center gap-3 text-xs text-slate-400 animate-pulse">
              <Bot className="w-4 h-4 text-indigo-500" />
              <span>CloudSense AI is analyzing AWS telemetry and running model inference...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Chips */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-slate-400 shrink-0 font-semibold">Suggested:</span>
          {suggestedPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask CloudSense AI about spend, DoW threats, EC2 rightsizing..."
            className="flex-1 p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button
            variant="primary"
            size="md"
            icon={<Send className="w-3.5 h-3.5" />}
            onClick={() => handleSendMessage()}
            isLoading={isGenerating}
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
};
