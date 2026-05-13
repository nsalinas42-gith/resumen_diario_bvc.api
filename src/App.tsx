/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  LayoutDashboard, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity,
  FileText,
  Search,
  Filter,
  ArrowRightLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INITIAL_DATA, extractBVCData, extractBVCDataFromPdf } from './services/geminiService';
import { DashboardState, StockData } from './types';

export default function App() {
  const [data, setData] = useState<DashboardState>(INITIAL_DATA);
  const [view, setView] = useState<'dashboard' | 'spreadsheet'>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockData; direction: 'asc' | 'desc' } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showAdminPanel) {
      timer = setTimeout(() => {
        setShowAdminPanel(false);
      }, 60000); // 60 seconds
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showAdminPanel]);

  const handleVerifyPassword = () => {
    if (passwordInput === '009286') {
      setShowAdminPanel(true);
      setIsAuthenticating(false);
      setPasswordInput('');
    } else {
      alert('Contraseña incorrecta');
      setPasswordInput('');
    }
  };

  const isWidget = useMemo(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'widget';
  }, []);

  const syncWithBVC = async (customUrl?: string) => {
    setIsSyncing(true);
    setIsProcessing(true);
    try {
      const url = customUrl ? `/api/sync?url=${encodeURIComponent(customUrl)}` : '/api/sync';
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al sincronizar con el mercado');
      }
      const { pdfBase64, pdfUrl } = await response.json();
      
      const extracted = await extractBVCDataFromPdf(pdfBase64);
      setData(extracted);
      
      alert(`Reporte sincronizado con éxito desde: ${pdfUrl.split('/').pop()}`);
      setSyncUrl('');
    } catch (error: any) {
      console.error("Sync error:", error);
      alert(`No se pudo sincronizar automáticamente. ${error.message || ''}\n\nSugerencia: Puedes intentar copiar el link directo al PDF de Rendivalores o la BVC y pegarlo aquí.`);
    } finally {
      setIsSyncing(false);
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsProcessing(true);
    try {
      const base64Promises = Array.from(files).map((file: File) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(base64Promises);
      const extracted = await extractBVCData(base64Images);
      setData(extracted);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Hubo un error al procesar las imágenes. Asegúrate de que sean capturas claras del reporte de la BVC.");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportData = (format: 'csv' | 'json') => {
    let content = '';
    let fileName = `bvc_report_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      const headers = ['Ticker', 'Empresa', 'Cierre Bs', 'Var Bs', 'Cierre USD', 'Var USD'];
      const rows = data.stocks.map(s => [s.ticker, s.name, s.closeBs, s.changeBs, s.closeUsd, s.changeUsd].join(','));
      content = [headers.join(','), ...rows].join('\n');
      fileName += '.csv';
    } else {
      content = JSON.stringify(data, null, 2);
      fileName += '.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStocks = useMemo(() => {
    let stocks = data.stocks.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.ticker.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig) {
      stocks.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return stocks;
  }, [data.stocks, searchTerm, sortConfig]);

  const requestSort = (key: keyof StockData) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="min-h-screen bg-bg-deep text-text-main font-sans">
      {/* Top Navigation - Hidden in widget mode */}
      {!isWidget && (
        <nav className="fixed top-0 left-0 w-full h-16 bg-bg-center border-b border-grid-color z-50 px-4 md:px-8 flex items-center justify-between transition-all duration-300">
          <div className="flex items-center gap-4 md:gap-8 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-accent-blue rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-blue/20">
                <TrendingUp className="text-white w-4 h-4 md:w-6 md:h-6" />
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight whitespace-nowrap text-white">Resumen BVC</span>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${view === 'dashboard' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim hover:bg-white/5'}`}
              >
                <LayoutDashboard size={18} />
                <span className="font-medium text-sm hidden sm:block">Dashboard</span>
              </button>
              <button 
                onClick={() => setView('spreadsheet')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${view === 'spreadsheet' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim hover:bg-white/5'}`}
              >
                <FileSpreadsheet size={18} />
                <span className="font-medium text-sm hidden sm:block">Data Grid</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <AnimatePresence>
              {showAdminPanel ? (
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-12 bg-bg-center border border-grid-color p-4 rounded-xl shadow-2xl space-y-4 min-w-[260px]"
                >
                  <div className="bg-bg-deep p-3 rounded-lg border border-grid-color">
                    <p className="text-[10px] font-bold text-text-dim uppercase mb-2">SYNC Manual (PDF URL)</p>
                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        placeholder="https://..." 
                        className="flex-1 bg-bg-center border border-grid-color rounded p-1 text-[10px] text-text-main focus:outline-none focus:ring-1 focus:ring-accent-blue"
                        value={syncUrl}
                        onChange={(e) => setSyncUrl(e.target.value)}
                      />
                      <button 
                        onClick={() => syncWithBVC(syncUrl)}
                        disabled={!syncUrl || isSyncing}
                        className="bg-accent-blue text-white p-1 rounded disabled:opacity-50"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => syncWithBVC()}
                      disabled={isSyncing}
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-accent-blue text-white cursor-pointer hover:bg-accent-blue/90 transition-all disabled:opacity-50"
                    >
                      {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                      <span className="font-medium text-xs">Sincronizar Datos</span>
                    </button>

                    <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-accent-purple text-white cursor-pointer hover:bg-accent-purple/90 transition-all">
                      <Upload size={16} />
                      <span className="font-medium text-xs">Subir Captura</span>
                      <input type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*" />
                    </label>
                  </div>

                  <button 
                    onClick={() => setShowAdminPanel(false)}
                    className="w-full py-2 text-[10px] font-bold text-text-dim hover:text-text-main transition-colors uppercase border-t border-grid-color"
                  >
                    Cerrar Panel
                  </button>
                </motion.div>
              ) : isAuthenticating ? (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-12 bg-bg-center p-4 rounded-xl border border-grid-color shadow-2xl min-w-[200px]"
                >
                  <p className="text-[10px] font-bold text-text-dim uppercase mb-2">Clave Actualización</p>
                  <div className="flex gap-1">
                    <input 
                      type="password" 
                      placeholder="****" 
                      autoFocus
                      className="flex-1 bg-bg-deep border border-grid-color rounded p-2 text-xs text-text-main focus:outline-none focus:ring-1 focus:ring-accent-blue"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                    />
                    <button 
                      onClick={handleVerifyPassword}
                      className="bg-accent-blue text-white px-2 rounded"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsAuthenticating(false)}
                    className="w-full mt-2 text-[10px] text-text-dim hover:text-text-main font-bold uppercase transition-colors"
                  >
                    Cerrar
                  </button>
                </motion.div>
              ) : (
                <button 
                  onClick={() => setIsAuthenticating(true)}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-grid-color text-text-dim hover:border-accent-blue/50 hover:text-accent-blue transition-all"
                >
                  <FileText size={18} />
                  <span className="hidden sm:inline font-bold text-[10px] uppercase whitespace-nowrap">Actualización de Datos</span>
                </button>
              )}
            </AnimatePresence>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className={`${isWidget ? 'pl-0 bg-transparent pt-2' : 'pt-24'} transition-all duration-300`}>
        <div className={`${isWidget ? 'max-w-full px-2 pb-10' : 'max-w-7xl mx-auto px-4 md:px-8 pb-10'}`}>
          {/* Header */}
          <header className={`flex items-center justify-between ${isWidget ? 'mb-4' : 'mb-8'} gap-4`}>
            <div className="flex items-center gap-3">
              <div className={`${isWidget ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'} bg-accent-blue flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-blue/20`}>
                <TrendingUp className="text-white w-5 h-5" />
              </div>
              <div>
                <h1 className={`${isWidget ? 'text-lg' : 'text-3xl'} font-bold text-white leading-tight`}>
                  {isWidget ? 'Resumen de Mercado' : 'Mercado de Valores'}
                </h1>
                {!isWidget && <p className="text-text-dim font-medium text-sm">Bolsa de Valores de Caracas &bull; {data.summary?.date || 'Cargando...'}</p>}
              </div>
            </div>

            {isWidget && (
              <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                  {showAdminPanel ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-bg-center p-1 rounded-lg border border-grid-color flex items-center gap-2"
                    >
                      <button onClick={() => syncWithBVC()} className="p-1 text-accent-blue hover:bg-white/5 rounded-md" title="Sync">
                        <FileText size={14} />
                      </button>
                      <button onClick={() => setShowAdminPanel(false)} className="p-1 text-text-dim hover:text-white">
                        <ChevronRight size={14} className="rotate-90" />
                      </button>
                    </motion.div>
                  ) : (
                    <button 
                      onClick={() => setIsAuthenticating(true)}
                      className="p-1.5 rounded-lg border border-grid-color text-text-dim hover:text-accent-blue"
                    >
                      <FileText size={14} />
                    </button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </header>

          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent-blue text-white px-4 py-2 rounded-lg mb-4 flex items-center gap-3 text-xs"
            >
              <Loader2 className="animate-spin w-4 h-4" />
              <span>Actualizando datos...</span>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {view === 'dashboard' ? (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`${isWidget ? 'space-y-4' : 'space-y-8'}`}
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard 
                    label="Vol. Bs" 
                    value={data.summary?.totalVolumeBs.toLocaleString()} 
                    icon={<Activity className="text-accent-blue" />}
                    small={isWidget}
                  />
                  <StatCard 
                    label="Vol. USD" 
                    value={`$${data.summary?.totalVolumeUsd.toLocaleString()}`} 
                    icon={<DollarSign className="text-accent-green" />}
                    small={isWidget}
                  />
                  <StatCard 
                    label="Tasa SMC" 
                    value={data.summary?.dollarRate.toFixed(4)} 
                    icon={<ArrowRightLeft className="text-orange-400" />}
                    small={isWidget}
                  />
                  <StatCard 
                    label="IBC" 
                    value={data.indices.find(i => i.name === 'IBC')?.points.toLocaleString()} 
                    icon={<TrendingUp className="text-accent-purple" />}
                    trend={`${data.indices.find(i => i.name === 'IBC')?.change}%`}
                    positive={(data.indices.find(i => i.name === 'IBC')?.change || 0) > 0}
                    small={isWidget}
                  />
                </div>

                {/* Charts Area - 40/60 Responsive Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-[10px]">
                  {/* Indices de Mercado - Left Column (40%) */}
                  <div className={`lg:col-span-4 bg-bg-center ${isWidget ? 'p-4' : 'p-6'} rounded-2xl border border-grid-color shadow-sm text-text-main`}>
                    <h3 className={`font-bold ${isWidget ? 'text-[10px] uppercase tracking-wider mb-4' : 'text-lg mb-6'} text-white`}>Índices de Mercado</h3>
                    <div className={`${isWidget ? 'space-y-2' : 'space-y-4'}`}>
                      {data.indices.map((idx) => (
                        <div key={idx.name} className={`flex items-center justify-between ${isWidget ? 'p-2' : 'p-4'} rounded-xl bg-bg-deep border border-grid-color`}>
                          <div>
                            <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider">{idx.name}</p>
                            <p className={`${isWidget ? 'text-sm' : 'text-lg'} font-bold text-white`}>{idx.points.toLocaleString()}</p>
                          </div>
                          
                          {idx.history && (
                            <div className="hidden sm:block">
                              <Sparkline 
                                data={idx.history} 
                                color={idx.change >= 0 ? '#10b981' : '#f87171'} 
                              />
                            </div>
                          )}

                          <div className={`${isWidget ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-sm'} rounded-md flex items-center gap-1 font-bold ${idx.change >= 0 ? 'text-accent-green bg-accent-green/10' : 'text-red-400 bg-red-400/10'}`}>
                            {idx.change}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Volumen - Right Column (60%) */}
                  <div className={`lg:col-span-6 bg-bg-center ${isWidget ? 'p-4' : 'p-6'} rounded-2xl border border-grid-color shadow-sm`}>
                    <h3 className={`font-bold ${isWidget ? 'text-[10px] uppercase tracking-wider mb-4' : 'text-lg mb-6'} text-white`}>Top Volumen</h3>
                    <div className={`${isWidget ? 'h-[200px]' : 'h-[300px]'} w-full`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.summary?.topVolumeActions.slice(0, 5)}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#191e3a" />
                          <XAxis dataKey="ticker" axisLine={false} tickLine={false} tick={{fill: '#888ea8', fontSize: 10}} dy={5} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#888ea8', fontSize: 10}} />
                          <Tooltip 
                            cursor={{fill: '#191e3a'}} 
                            contentStyle={{backgroundColor: '#060818', borderRadius: '8px', border: '1px solid #191e3a', fontSize: '11px'}}
                          />
                          <Bar dataKey="volume" fill="#4361ee" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

              </motion.div>
            ) : (
              <motion.div 
                key="spreadsheet"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-bg-center rounded-2xl border border-grid-color shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-grid-color space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg text-white">Explorador de Mercado</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre o ticker..." 
                        className="pl-10 pr-4 py-2 bg-bg-deep rounded-lg border border-grid-color text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue transition-all w-full md:w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-bg-deep/30">
                      <tr>
                        <SortableHeader label="Ticker" sortKey="ticker" currentSort={sortConfig} onSort={requestSort} />
                        <SortableHeader label="Empresa" sortKey="name" currentSort={sortConfig} onSort={requestSort} />
                        <SortableHeader label="Cierre (Bs)" sortKey="closeBs" currentSort={sortConfig} onSort={requestSort} />
                        <SortableHeader label="Var % (Bs)" sortKey="changeBs" currentSort={sortConfig} onSort={requestSort} />
                        <SortableHeader label="Cierre ($)" sortKey="closeUsd" currentSort={sortConfig} onSort={requestSort} />
                        <SortableHeader label="Var % ($)" sortKey="changeUsd" currentSort={sortConfig} onSort={requestSort} />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grid-color/30">
                      {filteredStocks.map((stock) => (
                        <tr key={stock.ticker} className="hover:bg-accent-blue/5 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">{stock.ticker}</td>
                          <td className="px-6 py-4 text-text-main font-medium">{stock.name}</td>
                          <td className="px-6 py-4 font-mono font-medium">{stock.closeBs.toLocaleString()}</td>
                          <td className={`px-6 py-4 font-bold ${stock.changeBs > 0 ? 'text-accent-green' : stock.changeBs < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                            {stock.changeBs > 0 ? '+' : ''}{stock.changeBs}%
                          </td>
                          <td className="px-6 py-4 font-mono font-medium text-text-dim">${stock.closeUsd.toFixed(4)}</td>
                          <td className={`px-6 py-4 font-bold ${stock.changeUsd > 0 ? 'text-accent-green' : stock.changeUsd < 0 ? 'text-red-400' : 'text-text-dim'}`}>
                            {stock.changeUsd > 0 ? '+' : ''}{stock.changeUsd}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredStocks.length === 0 && (
                    <div className="p-12 text-center text-text-dim font-medium">
                      <Search size={48} className="mx-auto mb-4 opacity-10" />
                      No se encontraron resultados para "{searchTerm}"
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[], color: string }) {
  const chartData = data.map((val, i) => ({ value: val, index: i }));
  const id = React.useId().replace(/:/g, '');
  
  return (
    <div className="h-10 w-20 md:w-28 opacity-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#gradient-${id})`}
            dot={false} 
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ label, value, icon, trend, positive, sublabel, small }: { label: string, value?: string, icon?: React.ReactNode, trend?: string, positive?: boolean, sublabel?: string, small?: boolean }) {
  return (
    <div className={`bg-bg-center ${small ? 'p-3' : 'p-6'} rounded-2xl border border-grid-color shadow-sm hover:shadow-md transition-shadow`}>
      <div className={`flex items-center justify-between ${small ? 'mb-2' : 'mb-4'}`}>
        <div className={`${small ? 'p-1.5' : 'p-2.5'} bg-bg-deep rounded-xl`}>
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${positive ? 'text-accent-green bg-accent-green/10' : 'text-red-400 bg-red-400/10'}`}>
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider mb-1 truncate">{label}</p>
        <div className="flex items-baseline gap-1">
          <h4 className={`${small ? 'text-sm' : 'text-2xl'} font-bold text-white truncate`}>{value || '---'}</h4>
          {sublabel && !small && <span className="text-[10px] text-text-dim font-medium">{sublabel}</span>}
        </div>
      </div>
    </div>
  );
}

function SortableHeader({ label, sortKey, currentSort, onSort }: { label: string, sortKey: keyof StockData, currentSort: any, onSort: any }) {
  const isActive = currentSort?.key === sortKey;
  return (
    <th 
      onClick={() => onSort(sortKey)}
      className="px-6 py-4 text-xs font-bold text-text-dim uppercase cursor-pointer hover:text-accent-blue transition-colors group"
    >
      <div className="flex items-center gap-1">
        {label}
        <div className={`transition-all ${isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 group-hover:opacity-50'}`}>
          {currentSort?.direction === 'desc' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
        </div>
      </div>
    </th>
  );
}
