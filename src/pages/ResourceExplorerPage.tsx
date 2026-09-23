import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, RiskBadge } from '../components/ui/Badge';
import { Drawer } from '../components/ui/Drawer';
import { Skeleton } from '../components/ui/Skeleton';
import { apiService } from '../services/api';
import { CloudResource, ResourceService, ResourceStatus } from '../types';
import {
  Server,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Cpu,
  HardDrive,
  Database,
  Activity,
  Layers,
  Sparkles,
  AlertTriangle,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { useApp } from '../context/AppContext';

export const ResourceExplorerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { addToast } = useApp();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await apiService.getResources();
        setResources(res.data);
      } catch (err) {
        console.error('Failed to load resources:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredResources = resources.filter((res) => {
    const matchesSearch =
      res.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService = serviceFilter === 'ALL' || res.service === serviceFilter;
    const matchesStatus = statusFilter === 'ALL' || res.status === statusFilter;
    return matchesSearch && matchesService && matchesStatus;
  });

  const getServiceIcon = (service: ResourceService) => {
    switch (service) {
      case 'EC2': return <Server className="w-4 h-4 text-blue-500" />;
      case 'EBS': return <HardDrive className="w-4 h-4 text-amber-500" />;
      case 'RDS': return <Database className="w-4 h-4 text-emerald-500" />;
      case 'NATGateway': return <Activity className="w-4 h-4 text-rose-500" />;
      default: return <Cpu className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getStatusBadge = (status: ResourceStatus) => {
    switch (status) {
      case 'healthy': return <Badge variant="success">Healthy</Badge>;
      case 'underutilized': return <Badge variant="warning">Underutilized</Badge>;
      case 'oversized': return <Badge variant="warning">Oversized</Badge>;
      case 'idle': return <Badge variant="warning">Idle Node</Badge>;
      case 'critical': return <Badge variant="critical">Critical Egress</Badge>;
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-[22px] font-normal tracking-tight text-[var(--cs-ink)]">
            AWS Resource Explorer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Deep telemetry, CPU/Memory metrics history, dependency mapping & rightsizing opportunities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral">{filteredResources.length} Resources Matched</Badge>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resource name, ID, tags, or region..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Service Filter Dropdown */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All AWS Services</option>
              <option value="EC2">EC2 Instances</option>
              <option value="EBS">EBS Volumes</option>
              <option value="RDS">RDS Clusters</option>
              <option value="NATGateway">NAT Gateways</option>
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="healthy">Healthy</option>
              <option value="underutilized">Underutilized</option>
              <option value="oversized">Oversized</option>
              <option value="idle">Idle</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Main High-Density Resource Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-mono border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-3">Resource & ID</th>
                <th className="p-3">Service</th>
                <th className="p-3">Region & Env</th>
                <th className="p-3">Status</th>
                <th className="p-3">Avg CPU</th>
                <th className="p-3">Monthly Cost</th>
                <th className="p-3">Est. Savings</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredResources.map((res) => (
                <tr
                  key={res.id}
                  onClick={() => setSelectedResource(res)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {getServiceIcon(res.service)}
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{res.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">{res.resourceId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono font-medium">{res.service}</td>
                  <td className="p-3">
                    <p className="font-mono text-slate-700 dark:text-slate-300">{res.region}</p>
                    <span className="text-[10px] text-slate-400 capitalize">{res.environment}</span>
                  </td>
                  <td className="p-3">{getStatusBadge(res.status)}</td>
                  <td className="p-3 font-mono font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>{res.cpuUtilization}%</span>
                      <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.min(res.cpuUtilization, 100)}%` }}
                          className={`h-full ${res.cpuUtilization > 80 ? 'bg-rose-500' : res.cpuUtilization < 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                    ${res.monthlyCost}/mo
                  </td>
                  <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {res.estimatedSaving > 0 ? `+$${res.estimatedSaving}/mo` : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm">
                      Inspect <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Resource Details Side Drawer */}
      <Drawer
        isOpen={!!selectedResource}
        onClose={() => setSelectedResource(null)}
        title={selectedResource?.name || 'Resource Details'}
        subtitle={`${selectedResource?.service} • ${selectedResource?.resourceId} • ${selectedResource?.region}`}
      >
        {selectedResource && (
          <div className="space-y-6 text-xs">
            {/* Quick Status Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400">Resource Health Status</span>
                <div className="mt-1">{getStatusBadge(selectedResource.status)}</div>
              </div>
              <div>
                <span className="text-slate-400">Monthly Cost</span>
                <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">${selectedResource.monthlyCost}/mo</p>
              </div>
              <div>
                <span className="text-slate-400">Potential Savings</span>
                <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">+${selectedResource.estimatedSaving}/mo</p>
              </div>
            </div>

            {/* Metrics Telemetry Chart */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-500" />
                <span>24-Hour Telemetry Trace</span>
              </h4>
              <div className="h-44 w-full bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedResource.metricsHistory}>
                    <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} stroke="#64748b" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#64748b" unit="%" />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '6px', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="cpu" name="CPU Utilization %" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tags Table */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-900 dark:text-slate-100">AWS Resource Tags</h4>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1 font-mono">
                {Object.entries(selectedResource.tags).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">{k}:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => {
                  window.open(`https://console.aws.amazon.com/ec2/v2/home?region=${selectedResource.region}`, '_blank');
                }}
              >
                Open AWS Console
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedResource(null);
                  addToast({
                    type: 'info',
                    title: 'Simulation Dispatched',
                    message: `Pre-populating What-If simulator for ${selectedResource.name}.`,
                  });
                }}
              >
                Simulate Optimization
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
