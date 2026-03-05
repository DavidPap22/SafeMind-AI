import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  ShieldCheck, 
  Settings, 
  Users, 
  Activity, 
  Clock, 
  MessageSquare,
  Brain,
  Zap,
  ChevronRight,
  Menu,
  X,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  RadialLinearScale,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar, Radar, Doughnut } from 'react-chartjs-2';
import { Aggregate, Alert, AuditLog, Team } from './types';
import { KPI_CONFIGS } from './constants';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// --- COMPONENTS ---

const GlassCard = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={`bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl ${className}`} {...props}>
    {children}
  </div>
);

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<{ aggregates: Aggregate[], alerts: Alert[], teams: Team[] } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [dashRes, auditRes, topicRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/audit'),
        fetch('/api/topics')
      ]);
      setData(await dashRes.json());
      setAuditLogs(await auditRes.json());
      setTopics(await topicRes.json());
      setLoading(false);
    } catch (e) {
      console.error("Fetch error", e);
    }
  };

  const filteredAggregates = useMemo(() => {
    if (!data) return [];
    return selectedTeam === 'all' 
      ? data.aggregates 
      : data.aggregates.filter(a => a.teamId === selectedTeam);
  }, [data, selectedTeam]);

  const currentAggregates = useMemo(() => {
    if (!data) return [];
    if (selectedTeam === 'all') {
      const latest: Record<string, Aggregate> = {};
      data.aggregates.forEach(a => {
        if (!latest[a.teamId] || new Date(a.date) > new Date(latest[a.teamId].date)) {
          latest[a.teamId] = a;
        }
      });
      return Object.values(latest);
    } else {
      const teamData = data.aggregates.filter(a => a.teamId === selectedTeam);
      if (teamData.length === 0) return [];
      return [teamData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]];
    }
  }, [data, selectedTeam]);

  const avgKPIs = useMemo(() => {
    if (currentAggregates.length === 0) return KPI_CONFIGS.map(() => 0);
    return KPI_CONFIGS.map(kpi => {
      const sum = currentAggregates.reduce((acc, curr) => acc + (curr[kpi.key as keyof Aggregate] as number), 0);
      return sum / currentAggregates.length;
    });
  }, [currentAggregates]);

  // --- CHARTS ---

  const radarData = {
    labels: KPI_CONFIGS.map(k => k.label),
    datasets: [{
      label: selectedTeam === 'all' ? 'Media Aziendale' : `Media ${selectedTeam.replace('Team_', '')}`,
      data: avgKPIs,
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: 'rgba(99, 102, 241, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(99, 102, 241, 1)',
    }]
  };

  const trendData = {
    labels: [...new Set(filteredAggregates.map(a => a.date))].sort().slice(-7),
    datasets: KPI_CONFIGS.slice(0, 3).map(kpi => ({
      label: kpi.label,
      data: [...new Set(filteredAggregates.map(a => a.date))].sort().slice(-7).map(date => {
        const dayData = filteredAggregates.filter(a => a.date === date);
        return dayData.reduce((acc, curr) => acc + (curr[kpi.key as keyof Aggregate] as number), 0) / (dayData.length || 1);
      }),
      borderColor: kpi.color,
      backgroundColor: kpi.color + '20',
      fill: true,
      tension: 0.4
    }))
  };

  const moodDistribution = {
    labels: ['Sereno', 'Teso', 'Critico'],
    datasets: [{
      data: [
        currentAggregates.filter(a => a.moodState === 'Sereno').length,
        currentAggregates.filter(a => a.moodState === 'Teso').length,
        currentAggregates.filter(a => a.moodState === 'Critico').length,
      ],
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderWidth: 0,
    }]
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-indigo-300 font-medium animate-pulse">Caricamento SafeMind AI...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#1e293b]/50 backdrop-blur-xl border-r border-white/5 p-6 z-50 hidden lg:block">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">SafeMind AI</h1>
        </div>

        <nav className="space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Domini AI</div>
          <SidebarItem icon={Activity} label="Stress & Urgenza" active={activeTab === 'stress'} onClick={() => setActiveTab('stress')} />
          <SidebarItem icon={AlertTriangle} label="Aggressività" active={activeTab === 'hostility'} onClick={() => setActiveTab('hostility')} />
          <SidebarItem icon={Clock} label="Disconnessione" active={activeTab === 'disconnection'} onClick={() => setActiveTab('disconnection')} />
          <SidebarItem icon={Brain} label="Mood Tracker" active={activeTab === 'mood'} onClick={() => setActiveTab('mood')} />
          <SidebarItem icon={Zap} label="Carico Cognitivo" active={activeTab === 'cognitive'} onClick={() => setActiveTab('cognitive')} />
          
          <div className="pt-4 pb-2 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sistema</div>
          <SidebarItem icon={MessageSquare} label="Topic / Progetti" active={activeTab === 'topics'} onClick={() => setActiveTab('topics')} />
          <SidebarItem icon={AlertTriangle} label="Alert Center" active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')} />
          <SidebarItem icon={ShieldCheck} label="Privacy & Audit" active={activeTab === 'privacy'} onClick={() => setActiveTab('privacy')} />
          <SidebarItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {activeTab === 'dashboard' ? 'Overview Aziendale' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('_', ' ')}
            </h2>
            <p className="text-slate-400 mt-1">Monitoraggio benessere e clima organizzativo in tempo reale.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex">
              <button 
                onClick={() => setSelectedTeam('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTeam === 'all' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                Tutti i Team
              </button>
              {data?.teams.map(t => (
                <button 
                  key={t.id}
                  onClick={() => setSelectedTeam(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedTeam === t.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Top Row: KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {KPI_CONFIGS.map((kpi, idx) => {
                  const val = avgKPIs[idx];
                  const isCritical = val > kpi.threshold;
                  return (
                    <GlassCard 
                      key={kpi.id} 
                      onClick={() => setActiveTab(kpi.id)}
                      className="p-4 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 rounded-lg bg-white/5 text-slate-300 group-hover:text-indigo-400 transition-colors`}>
                          {idx === 0 && <Activity size={18} />}
                          {idx === 1 && <AlertTriangle size={18} />}
                          {idx === 2 && <Clock size={18} />}
                          {idx === 3 && <Brain size={18} />}
                          {idx === 4 && <Zap size={18} />}
                          {idx === 5 && <MessageSquare size={18} />}
                        </div>
                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {isCritical ? 'CRITICAL' : 'STABLE'}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{kpi.label}</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{(val * 100).toFixed(0)}%</h3>
                      </div>
                      <div className="w-full bg-white/5 h-1 rounded-full mt-4 overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ width: `${val * 100}%`, backgroundColor: kpi.color }}
                        />
                      </div>
                    </GlassCard>
                  );
                })}
              </div>

              {/* Middle Row: Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <GlassCard className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Trend Settimanale</h3>
                    <div className="flex gap-4 text-xs">
                      {KPI_CONFIGS.slice(0, 3).map(k => (
                        <div key={k.id} className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                          <span className="text-slate-400">{k.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-[300px]">
                    <Line 
                      data={trendData} 
                      options={{ 
                        responsive: true, 
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                          x: { grid: { display: false }, ticks: { color: '#64748b' } }
                        }
                      }} 
                    />
                  </div>
                </GlassCard>

                <GlassCard>
                  <h3 className="text-lg font-bold text-white mb-6">Risk Radar</h3>
                  <div className="h-[300px]">
                    <Radar 
                      data={radarData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                          r: {
                            grid: { color: 'rgba(255,255,255,0.1)' },
                            angleLines: { color: 'rgba(255,255,255,0.1)' },
                            pointLabels: { color: '#94a3b8', font: { size: 10 } },
                            ticks: { display: false },
                            suggestedMin: 0,
                            suggestedMax: 1
                          }
                        }
                      }}
                    />
                  </div>
                </GlassCard>
              </div>

              {/* Bottom Row: Mood & Alerts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <GlassCard>
                  <h3 className="text-lg font-bold text-white mb-6">Clima Organizzativo</h3>
                  <div className="h-[200px] flex items-center justify-center relative">
                    <div className="w-full h-full max-w-[200px] max-h-[200px]">
                      <Doughnut 
                        data={moodDistribution}
                        options={{
                          cutout: '75%',
                          plugins: { legend: { display: false } },
                          maintainAspectRatio: true,
                        }}
                      />
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-3xl font-bold text-white">
                        {currentAggregates.length > 0 ? ((currentAggregates.filter(a => a.moodState === 'Sereno').length / currentAggregates.length) * 100).toFixed(0) : 0}%
                      </p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">Serenità</p>
                    </div>
                  </div>
                  <div className="mt-6 space-y-3">
                    {['Sereno', 'Teso', 'Critico'].map((state, i) => (
                      <div key={state} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: moodDistribution.datasets[0].backgroundColor[i] }} />
                          <span className="text-slate-400">{state}</span>
                        </div>
                        <span className="text-white font-medium">{currentAggregates.filter(a => a.moodState === state).length} Team</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white">Alert Recenti</h3>
                    <button onClick={() => setActiveTab('alerts')} className="text-indigo-400 text-sm hover:underline">Vedi tutti</button>
                  </div>
                  <div className="space-y-4">
                    {(selectedTeam === 'all' ? data?.alerts : data?.alerts.filter(a => a.teamId === selectedTeam))?.slice(0, 4).map(alert => (
                      <div key={alert.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${alert.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            <AlertTriangle size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{alert.kpi}</p>
                            <p className="text-xs text-slate-400">{alert.message}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500 font-mono">{new Date(alert.timestamp).toLocaleString()}</p>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{alert.teamId.replace('Team_', '')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'topics' && (
            <motion.div 
              key="topics"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <GlassCard>
                <h3 className="text-xl font-bold text-white mb-6">Analisi Topic & Progetti</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <p className="text-slate-400 mb-6">Frequenza topic estratti via Gemini AI (Zero-Storage).</p>
                    <div className="space-y-4">
                      {topics.map((t, i) => (
                        <div key={t.topic} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className={`font-medium ${t.topic === 'Progetto Alpha' ? 'text-indigo-400' : 'text-slate-300'}`}>
                              {t.topic} {t.topic === 'Progetto Alpha' && '🔥'}
                            </span>
                            <span className="text-slate-500">{t.total} messaggi</span>
                          </div>
                          <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${t.topic === 'Progetto Alpha' ? 'bg-indigo-500' : 'bg-slate-600'}`} 
                              style={{ width: `${(t.total / topics[0].total) * 100}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10">
                    <h4 className="font-bold text-indigo-300 mb-4 flex items-center gap-2">
                      <Zap size={18} /> AI Insight: Progetto Alpha
                    </h4>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Il topic <span className="text-white font-bold">"Progetto Alpha"</span> è correlato al <span className="text-white font-bold">82%</span> dei picchi di stress nel team Marketing. 
                      Si osserva una tendenza alla comunicazione fuori orario (+45% vs baseline) quando questo topic è dominante.
                    </p>
                    <div className="mt-6 p-4 bg-black/20 rounded-xl border border-white/5">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Correlazione KPI</p>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xl font-bold text-red-400">+32%</p>
                          <p className="text-[9px] text-slate-500">Stress</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-xl font-bold text-amber-400">+18%</p>
                          <p className="text-[9px] text-slate-500">Hostility</p>
                        </div>
                        <div className="w-px h-8 bg-white/10" />
                        <div className="text-center">
                          <p className="text-xl font-bold text-indigo-400">+55%</p>
                          <p className="text-[9px] text-slate-500">Off-Hours</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'privacy' && (
            <motion.div 
              key="privacy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="border-emerald-500/20 bg-emerald-500/5">
                  <ShieldCheck className="text-emerald-400 mb-4" size={32} />
                  <h4 className="text-lg font-bold text-white mb-2">Zero-Storage</h4>
                  <p className="text-sm text-slate-400">Il testo originale dei messaggi non viene mai salvato nel database. Viene elaborato in RAM e immediatamente scartato.</p>
                </GlassCard>
                <GlassCard className="border-indigo-500/20 bg-indigo-500/5">
                  <Users className="text-indigo-400 mb-4" size={32} />
                  <h4 className="text-lg font-bold text-white mb-2">Pseudonimizzazione</h4>
                  <p className="text-sm text-slate-400">Tutti gli ID utente vengono trasformati in hash SHA-256 irreversibili prima di qualsiasi aggregazione.</p>
                </GlassCard>
                <GlassCard className="border-amber-500/20 bg-amber-500/5">
                  <Brain className="text-amber-400 mb-4" size={32} />
                  <h4 className="text-lg font-bold text-white mb-2">NER Masking</h4>
                  <p className="text-sm text-slate-400">Nomi, email e numeri di telefono vengono mascherati tramite AI prima dell'analisi semantica.</p>
                </GlassCard>
              </div>

              <GlassCard>
                <h3 className="text-xl font-bold text-white mb-6">Audit Logs (DPO View)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-500 text-xs uppercase tracking-widest">
                        <th className="pb-4 font-semibold">Timestamp</th>
                        <th className="pb-4 font-semibold">Azione</th>
                        <th className="pb-4 font-semibold">Dettagli Tecnici</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {auditLogs.map(log => (
                        <tr key={log.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="py-4 font-mono text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="py-4 font-bold text-indigo-400">{log.action}</td>
                          <td className="py-4 text-slate-500">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* KPI Detail Pages */}
          {KPI_CONFIGS.some(k => k.id === activeTab) && (
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {(() => {
                const kpi = KPI_CONFIGS.find(k => k.id === activeTab)!;
                const val = avgKPIs[KPI_CONFIGS.indexOf(kpi)];
                const isCritical = val > kpi.threshold;
                
                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <GlassCard className="md:col-span-2">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-white">Trend {kpi.label}</h3>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${isCritical ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {isCritical ? 'Soglia Superata' : 'Sotto Controllo'}
                          </div>
                        </div>
                        <div className="h-[300px]">
                          <Line 
                            data={{
                              labels: [...new Set(filteredAggregates.map(a => a.date))].sort().slice(-14),
                              datasets: [{
                                label: kpi.label,
                                data: [...new Set(filteredAggregates.map(a => a.date))].sort().slice(-14).map(date => {
                                  const dayData = filteredAggregates.filter(a => a.date === date);
                                  return dayData.reduce((acc, curr) => acc + (curr[kpi.key as keyof Aggregate] as number), 0) / (dayData.length || 1);
                                }),
                                borderColor: kpi.color,
                                backgroundColor: kpi.color + '20',
                                fill: true,
                                tension: 0.4
                              }]
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              plugins: { legend: { display: false } },
                              scales: {
                                y: { min: 0, max: 1, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
                                x: { grid: { display: false }, ticks: { color: '#64748b' } }
                              }
                            }}
                          />
                        </div>
                      </GlassCard>

                      <div className="space-y-6">
                        <GlassCard>
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Score Attuale</p>
                          <h3 className="text-5xl font-bold text-white">{(val * 100).toFixed(0)}%</h3>
                          <p className="text-sm text-slate-500 mt-4">
                            Soglia di alert impostata a <span className="text-white">{(kpi.threshold * 100).toFixed(0)}%</span>.
                          </p>
                          <div className="w-full bg-white/5 h-2 rounded-full mt-6 overflow-hidden">
                            <div className="h-full" style={{ width: `${val * 100}%`, backgroundColor: kpi.color }} />
                          </div>
                        </GlassCard>

                        <GlassCard>
                          <h4 className="font-bold text-white mb-4">Insights AI</h4>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            {val > kpi.threshold 
                              ? `Rilevata un'anomalia persistente nel dominio ${kpi.label}. Si consiglia un intervento preventivo.`
                              : `I parametri di ${kpi.label} rientrano nella norma aziendale per il periodo selezionato.`}
                          </p>
                        </GlassCard>
                      </div>
                    </div>

                    {activeTab === 'disconnection' && (
                      <GlassCard>
                        <h3 className="text-lg font-bold text-white mb-6">Heatmap Disconnessione (Simulata)</h3>
                        <div className="grid grid-cols-7 gap-2">
                          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                            <div key={day} className="text-center text-[10px] text-slate-500 font-bold uppercase">{day}</div>
                          ))}
                          {Array.from({ length: 28 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`aspect-square rounded-md ${i % 7 >= 5 || i < 7 ? 'bg-indigo-500/40' : 'bg-white/5'} border border-white/5`}
                              title="Attività fuori orario rilevata"
                            />
                          ))}
                        </div>
                        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-slate-500">
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-white/5" /> Normale</div>
                          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-indigo-500/40" /> Violazione</div>
                        </div>
                      </GlassCard>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div 
              key="alerts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <GlassCard>
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-white">Alert Center</h3>
                  <div className="flex gap-2">
                    <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none">
                      <option>Tutti i Team</option>
                      {data?.teams.map(t => <option key={t.id}>{t.name}</option>)}
                    </select>
                    <select className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none">
                      <option>Tutte le Severità</option>
                      <option>HIGH</option>
                      <option>MED</option>
                      <option>LOW</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  {(selectedTeam === 'all' ? data?.alerts : data?.alerts.filter(a => a.teamId === selectedTeam))?.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                      <div className="flex items-center gap-6">
                        <div className={`p-3 rounded-xl ${alert.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                          <AlertTriangle size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold text-white">{alert.kpi}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400">{alert.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-xs text-white font-medium">{alert.teamId.replace('Team_', '')}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-1">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                        <button className="p-2 rounded-lg bg-white/5 text-slate-400 hover:bg-indigo-600 hover:text-white transition-all">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <GlassCard>
                <h3 className="text-xl font-bold text-white mb-8">Configurazione Soglie KPI</h3>
                <div className="space-y-6">
                  {KPI_CONFIGS.map(kpi => (
                    <div key={kpi.id} className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                      <div className="md:col-span-1">
                        <label className="text-sm font-medium text-slate-300">{kpi.label}</label>
                      </div>
                      <div className="md:col-span-2">
                        <input 
                          type="range" 
                          min="0" 
                          max="100" 
                          defaultValue={kpi.threshold * 100}
                          className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="md:col-span-1 text-right">
                        <span className="text-sm font-mono text-indigo-400">{(kpi.threshold * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-10 pt-8 border-t border-white/5 flex justify-end">
                  <button className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                    Salva Configurazioni
                  </button>
                </div>
              </GlassCard>

              <GlassCard>
                <h3 className="text-xl font-bold text-white mb-8">Fascia Disconnessione</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">Inizio Protezione</label>
                    <input type="time" defaultValue="20:00" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">Fine Protezione</label>
                    <input type="time" defaultValue="08:00" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="md:col-span-2 flex items-center gap-4 p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                    <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-white/10 bg-white/5 text-indigo-600 focus:ring-indigo-500" />
                    <label className="text-sm text-slate-300">Attiva protezione automatica nei weekend (Sabato e Domenica)</label>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
