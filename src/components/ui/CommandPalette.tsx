import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Search,
  Server,
  Sparkles,
  ShieldAlert,
  Sliders,
  Terminal,
  Activity,
  DollarSign,
  ArrowRight,
  FileText,
  UserCheck,
} from 'lucide-react';
import { mockCloudResources, mockRecommendations, mockAnomalies } from '../../services/mockData';

interface CommandItem {
  id: string;
  category: 'Commands' | 'Resources' | 'Recommendations' | 'Anomalies' | 'Pages';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const { isCommandPaletteOpen, setCommandPaletteOpen } = useApp();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    setCommandPaletteOpen(false);
  };

  const executeAndClose = (fn: () => void) => {
    fn();
    handleClose();
  };

  const defaultCommands: CommandItem[] = [
    {
      id: 'cmd_show_idle',
      category: 'Commands',
      title: 'Show idle EC2 instances',
      subtitle: 'Filter resource explorer for idle compute nodes',
      icon: <Server className="w-4 h-4 text-blue-500" />,
      action: () => navigate('/resources?status=idle'),
    },
    {
      id: 'cmd_pending_approvals',
      category: 'Commands',
      title: 'Open pending governance approvals',
      subtitle: 'Review 3 pending remediation actions',
      icon: <UserCheck className="w-4 h-4 text-amber-500" />,
      action: () => navigate('/approvals'),
    },
    {
      id: 'cmd_dow_alerts',
      category: 'Commands',
      title: 'Show Denial-of-Wallet (DoW) alerts',
      subtitle: 'Open security & financial monitoring center',
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
      action: () => navigate('/anomalies'),
    },
    {
      id: 'cmd_forecast',
      category: 'Commands',
      title: 'Forecast next month cloud spend (Prophet)',
      subtitle: 'View financial intelligence model predictions',
      icon: <DollarSign className="w-4 h-4 text-emerald-500" />,
      action: () => navigate('/cost'),
    },
    {
      id: 'cmd_simulator',
      category: 'Commands',
      title: 'Launch What-If Cloud Optimization Simulator',
      subtitle: 'Test downsizing and auto-scaling policies',
      icon: <Sliders className="w-4 h-4 text-indigo-500" />,
      action: () => navigate('/simulator'),
    },
    {
      id: 'cmd_assistant',
      category: 'Commands',
      title: 'Ask CloudSense AI Assistant',
      subtitle: 'Open natural language FinOps copilot',
      icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
      action: () => navigate('/assistant'),
    },
    {
      id: 'cmd_audit',
      category: 'Commands',
      title: 'Open Audit Logs & Governance history',
      subtitle: 'Review immutable execution logs',
      icon: <Activity className="w-4 h-4 text-slate-400" />,
      action: () => navigate('/activity'),
    },
  ];

  // Map resources & recommendations into searchable command items
  const resourceItems: CommandItem[] = mockCloudResources.map((res) => ({
    id: `res_${res.id}`,
    category: 'Resources',
    title: res.name,
    subtitle: `${res.service} • ${res.region} • ${res.monthlyCost}/mo`,
    icon: <Server className="w-4 h-4 text-slate-400" />,
    action: () => navigate('/resources'),
  }));

  const recommendationItems: CommandItem[] = mockRecommendations.map((rec) => ({
    id: `rec_${rec.id}`,
    category: 'Recommendations',
    title: rec.title,
    subtitle: `Save $${rec.monthlySavings}/mo • Confidence ${Math.round(rec.aiConfidence * 100)}%`,
    icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
    action: () => navigate(`/recommendations/${rec.id}`),
  }));

  const allItems = [...defaultCommands, ...recommendationItems, ...resourceItems];

  const filteredItems = query.trim() === ''
    ? allItems
    : allItems.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase())) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isCommandPaletteOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeAndClose(filteredItems[selectedIndex].action);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, filteredItems, selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4 bg-black/40" onClick={handleClose}>
      <div
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--cs-surface)] border border-[var(--cs-line)] rounded-lg cs-shadow-md overflow-hidden flex flex-col max-h-[75vh]"
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search resources, recommendations, anomalies..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-slate-200/60 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Command Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No commands or resources matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeAndClose(item.action)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white dark:bg-blue-600'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={isSelected ? 'text-white' : ''}>{item.icon}</span>
                    <div className="truncate">
                      <p className={`font-medium ${isSelected ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className={`text-[11px] truncate ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="font-mono text-[10px] text-slate-500">CloudSense AI Command Center</span>
        </div>
      </div>
    </div>
  );
};
