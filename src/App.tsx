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
  FileUp,
  FileText,
  Search,
  Filter,
  ArrowRightLeft,
  ChevronRight,
  Loader2,
  Menu,
  X,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INITIAL_DATA } from './initialData';
import { DashboardState, StockData } from './types';
import { extractBVCDataFromPdf } from './services/geminiService';
import { db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import MarketHeatMap from './components/MarketHeatMap';

export default function App() {
  const [data, setData] = useState<DashboardState>(INITIAL_DATA);
  const [view, setView] = useState<'dashboard' | 'spreadsheet' | 'heatmap'>('dashboard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPersistence, setIsLoadingPersistence] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof StockData; direction: 'asc' | 'desc' } | null>(null);

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);
  const [heatmapCurrency, setHeatmapCurrency] = useState<'bs' | 'usd'>('bs');

  useEffect(() => {
    // Listen for real-time updates from Firestore
    const unsub = onSnapshot(doc(db, 'app_data', 'current_state'), (docSnap) => {
      // Logic: Only update local state if we don't have local pending writes 
      // (this prevents the "revert" effect while saving)
      if (docSnap.exists() && !docSnap.metadata.hasPendingWrites) {
        setData(docSnap.data() as DashboardState);
      }
      setIsLoadingPersistence(false);
    }, (error) => {
      console.error("Firestore loading error:", error);
      setIsLoadingPersistence(false);
    });

    return () => unsub();
  }, []);

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
      await updateDashboardData(extracted);
      
      alert(`Reporte sincronizado con éxito desde: ${pdfUrl.split('/').pop()}`);
      setSyncUrl('');
    } catch (error: any) {
      console.error("Sync error:", error);
      alert(`No se pudo sincronizar automáticamente. ${error.message || ''}\n\nSugerencia: Puedes intentar copiar el link directo al PDF y pegarlo en el campo de SYNC Manual.`);
    } finally {
      setIsSyncing(false);
      setIsProcessing(false);
    }
  };

  const updateDashboardData = async (extracted: DashboardState) => {
    // Preserve history for indices if available in previous state
    const updatedIndices = extracted.indices.map((newIdx: any) => {
      const existing = data.indices.find(i => i.name === newIdx.name);
      return {
        ...newIdx,
        history: existing?.history ? [...existing.history, newIdx.points] : [newIdx.points]
      };
    });

    const newState: DashboardState = {
      ...extracted,
      indices: updatedIndices,
      summary: {
        ...extracted.summary,
        topOperationsCount: extracted.summary?.topOperationsCount || []
      },
      lastUpdated: new Date().toISOString()
    };

    // Update local state first for immediate UI response
    setData(newState);

    // Persist to Firebase
    try {
      // Usamos un alert temporal si falla para depuración
      await setDoc(doc(db, 'app_data', 'current_state'), newState);
      console.log("Data persisted to Firestore successfully");
    } catch (error: any) {
      console.error("Failed to persist data:", error);
      // Solo alertamos si no es un error cancelable comum
      if (error.code !== 'cancelled') {
        alert("Error de guardado en la nube: los datos se actualizaron solo en esta sesión. Verifica tu conexión.");
      }
    }
  };

  const isWidget = useMemo(() => {
    return new URLSearchParams(window.location.search).get('mode') === 'widget';
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Por favor, sube solo archivos PDF.');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Upload for storage
      const formData = new FormData();
      formData.append('pdf', file);
      fetch('/api/upload', { method: 'POST', body: formData }).catch(e => console.warn("Backup upload failed", e));

      // 2. Read locally for client-side processing
      const reader = new FileReader();
      const pdfBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]); // Remove prefix
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 3. Process with Gemini client-side
      const extracted = await extractBVCDataFromPdf(pdfBase64);
      await updateDashboardData(extracted);
      
      alert('Datos actualizados correctamente desde el PDF.');
    } catch (error: any) {
      console.error("Error processing file:", error);
      alert(`Hubo un error al procesar el PDF: ${error.message}`);
    } finally {
      setIsProcessing(false);
      event.target.value = '';
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
        <>
        <nav className="fixed top-0 left-0 w-full h-16 bg-bg-center border-b border-grid-color z-50 px-4 md:px-8 flex items-center justify-between transition-all duration-300">
          <div className="flex items-center gap-4 md:gap-8 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-accent-blue rounded-lg md:rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-blue/20">
                <TrendingUp className="text-white w-4 h-4 md:w-6 md:h-6" />
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight whitespace-nowrap text-white">Resumen BVC</span>
              
              {/* Desktop Status */}
              <div className="hidden lg:flex items-center gap-3">
                {isLoadingPersistence ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 text-accent-blue animate-spin" />
                    <span className="text-[10px] text-text-dim">Log de cambios...</span>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                      <span className="text-[10px] text-accent-blue font-medium uppercase tracking-wider text-xs">Nube Conectada</span>
                    </div>
                    {data.lastUpdated && (
                      <span className="text-[10px] text-text-dim leading-tight hidden sm:block">
                        Sinc: {new Date(data.lastUpdated).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1 md:gap-2">
              <button 
                onClick={() => setView('dashboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${view === 'dashboard' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim hover:bg-white/5'}`}
              >
                <LayoutDashboard size={18} />
                <span className="font-medium text-sm">Dashboard</span>
              </button>
              <button 
                onClick={() => setView('spreadsheet')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${view === 'spreadsheet' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim hover:bg-white/5'}`}
              >
                <FileSpreadsheet size={18} />
                <span className="font-medium text-sm">Explorador de Acciones</span>
              </button>
              <button 
                onClick={() => setView('heatmap')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${view === 'heatmap' ? 'bg-accent-blue/10 text-accent-blue' : 'text-text-dim hover:bg-white/5'}`}
              >
                <Layers size={18} />
                <span className="font-medium text-sm">Mapa de Calor</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Admin Panel */}
            <div className="hidden md:block relative">
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
                          {isSyncing ? <Loader2 className="animate-spin" size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => syncWithBVC()}
                        disabled={isSyncing}
                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-accent-blue text-white cursor-pointer hover:bg-accent-blue/90 transition-all disabled:opacity-50"
                      >
                        {isSyncing ? <Loader2 className="animate-spin" size={16} /> : <Activity size={16} />}
                        <span className="font-medium text-xs">Sincronizar BVC</span>
                      </button>

                      <label className="flex items-center justify-center gap-2 p-2.5 rounded-lg bg-accent-purple text-white cursor-pointer hover:bg-accent-purple/90 transition-all">
                        <Upload size={16} />
                        <span className="font-medium text-xs">Subir PDF BVC</span>
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,application/pdf" />
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
                    className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-accent-blue/30 text-accent-blue hover:bg-accent-blue/5 hover:border-accent-blue transition-all group"
                  >
                    <FileUp size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="hidden md:inline font-bold text-xs uppercase tracking-tight">Actualización Datos PDF</span>
                  </button>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Hamburger Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-text-dim hover:text-white transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 bg-bg-deep z-[60] flex flex-col p-6 md:hidden overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-accent-blue rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-white w-4 h-4" />
                  </div>
                  <span className="font-bold text-lg text-white">Menú Principal</span>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-text-dim hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Nube Conectada Status Section */}
                <div className="p-4 rounded-xl bg-bg-center border border-grid-color">
                  <p className="text-[10px] font-bold text-text-dim uppercase mb-3">Estado de Conexión</p>
                  {isLoadingPersistence ? (
                     <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-accent-blue animate-spin" />
                      <span className="text-sm text-text-main font-medium">Sincronizando con la nube...</span>
                     </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-blue animate-pulse" />
                        <span className="text-sm text-accent-blue font-bold tracking-wide">NUBE CONECTADA</span>
                      </div>
                      {data.lastUpdated && (
                        <p className="text-[11px] text-text-dim pl-4">
                          Última actualización: {new Date(data.lastUpdated).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Navigation Links */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-text-dim uppercase px-1 mb-1">Vistas</p>
                  <button 
                    onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-4 rounded-xl transition-all ${view === 'dashboard' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-bg-center border border-grid-color text-text-main'}`}
                  >
                    <LayoutDashboard size={20} />
                    <span className="font-bold">Dashboard de Resumen</span>
                  </button>
                  <button 
                    onClick={() => { setView('spreadsheet'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-4 rounded-xl transition-all ${view === 'spreadsheet' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-bg-center border border-grid-color text-text-main'}`}
                  >
                    <FileSpreadsheet size={20} />
                    <span className="font-bold">Explorador de Acciones</span>
                  </button>
                  <button 
                    onClick={() => { setView('heatmap'); setIsMobileMenuOpen(false); }}
                    className={`flex items-center gap-3 p-4 rounded-xl transition-all ${view === 'heatmap' ? 'bg-accent-blue/10 text-accent-blue' : 'bg-bg-center border border-grid-color text-text-main'}`}
                  >
                    <Layers size={20} />
                    <span className="font-bold">Mapa de Calor</span>
                  </button>
                </div>

                {/* Admin / Update Section */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-text-dim uppercase px-1 mb-1">Administración</p>
                  {!showAdminPanel ? (
                    <button 
                      onClick={() => {
                        setIsAuthenticating(true);
                      }}
                      className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-accent-blue/40 text-accent-blue bg-accent-blue/5 w-full"
                    >
                      <FileUp size={22} />
                      <span className="font-bold">Actualización Datos PDF</span>
                    </button>
                  ) : (
                    <div className="bg-bg-center border border-accent-blue/30 p-4 rounded-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-accent-blue uppercase">Panel de Control</span>
                        <button onClick={() => setShowAdminPanel(false)} className="text-[10px] font-bold text-text-dim">Cerrar</button>
                      </div>
                      
                      <button 
                        onClick={() => { syncWithBVC(); setIsMobileMenuOpen(false); }}
                        disabled={isSyncing}
                        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-accent-blue text-white shadow-xl shadow-accent-blue/20"
                      >
                        {isSyncing ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
                        <span className="font-bold">Sincronizar BVC</span>
                      </button>

                      <label className="flex items-center justify-center gap-3 p-4 rounded-xl bg-accent-purple text-white cursor-pointer shadow-xl shadow-accent-purple/20">
                        <Upload size={20} />
                        <span className="font-bold">Subir Reporte PDF</span>
                        <input type="file" className="hidden" onChange={(e) => { handleFileUpload(e); setIsMobileMenuOpen(false); }} accept=".pdf,application/pdf" />
                      </label>
                    </div>
                  )}

                  {isAuthenticating && !showAdminPanel && (
                    <div className="p-4 bg-bg-center border border-grid-color rounded-xl flex flex-col gap-3">
                      <p className="text-xs text-text-dim text-center">Ingresa la clave maestra en el teclado de abajo:</p>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          placeholder="Pin..."
                          className="flex-1 bg-bg-deep border border-grid-color rounded-lg p-3 text-center text-lg font-bold text-accent-blue focus:outline-none"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                           onKeyDown={(e) => e.key === 'Enter' && handleVerifyPassword()}
                        />
                        <button onClick={handleVerifyPassword} className="bg-accent-blue text-white px-4 rounded-lg"> OK </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </>
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
                        {isSyncing ? <Loader2 className="animate-spin" size={14} /> : <Activity size={14} />}
                      </button>
                      <label className="p-1 text-accent-purple hover:bg-white/5 rounded-md cursor-pointer" title="Subir PDF">
                        <Upload size={14} />
                        <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,application/pdf" />
                      </label>
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
            ) : view === 'spreadsheet' ? (
              <motion.div 
                key="spreadsheet"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-bg-center rounded-2xl border border-grid-color shadow-sm overflow-hidden"
              >
                <div className="p-6 border-b border-grid-color space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg text-white">Explorador de Mercado</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={18} />
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre o ticker..." 
                        className="pl-10 pr-4 py-2 bg-bg-deep rounded-lg border border-grid-color text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-accent-blue/20 focus:border-accent-blue transition-all w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[530px] overflow-y-auto scrollbar-thin scrollbar-thumb-accent-blue/20">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-bg-deep sticky top-0 z-10 shadow-sm transition-all duration-200">
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
                        <tr 
                          key={stock.ticker} 
                          onMouseEnter={() => setHoveredTicker(stock.ticker)}
                          onMouseLeave={() => setHoveredTicker(null)}
                          className={`hover:bg-accent-blue/5 transition-colors cursor-pointer ${hoveredTicker === stock.ticker ? 'bg-accent-blue/10' : ''}`}
                        >
                          <td className="px-6 py-4 font-bold text-white flex items-center gap-1.5">
                            {stock.ticker}
                            {hoveredTicker === stock.ticker && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent-blue ring-2 ring-accent-blue/20 animate-pulse" />
                            )}
                          </td>
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
            ) : (
              <motion.div
                key="heatmap"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="w-full"
              >
                <MarketHeatMap 
                  stocks={filteredStocks}
                  currency={heatmapCurrency}
                  setCurrency={setHeatmapCurrency}
                  hoveredTicker={hoveredTicker}
                  onHoverTicker={setHoveredTicker}
                />
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
