import React from 'react';
import { motion } from 'motion/react';
import { StockData } from '../types';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Layers } from 'lucide-react';

interface MarketHeatMapProps {
  stocks: StockData[];
  currency: 'bs' | 'usd';
  setCurrency: (currency: 'bs' | 'usd') => void;
  hoveredTicker: string | null;
  onHoverTicker: (ticker: string | null) => void;
}

export default function MarketHeatMap({
  stocks,
  currency,
  setCurrency,
  hoveredTicker,
  onHoverTicker,
}: MarketHeatMapProps) {
  const [sortBy, setSortBy] = React.useState<'ticker' | 'change' | 'price'>('change');
  const [sizeBy, setSizeBy] = React.useState<'uniform' | 'price'>('uniform');

  // Helpers to calculate colors based on stock change percentage
  const getColorClasses = (change: number) => {
    if (change > 5) {
      return {
        bg: 'bg-emerald-600 hover:bg-emerald-500',
        text: 'text-white',
        border: 'border-emerald-400',
        label: 'bg-emerald-800/60',
        rawColor: '#059669',
      };
    } else if (change > 1.5) {
      return {
        bg: 'bg-emerald-700 hover:bg-emerald-600',
        text: 'text-white',
        border: 'border-emerald-500',
        label: 'bg-emerald-900/40',
        rawColor: '#047857',
      };
    } else if (change > 0.1) {
      return {
        bg: 'bg-emerald-900/60 hover:bg-emerald-900/80',
        text: 'text-emerald-200',
        border: 'border-emerald-800/60',
        label: 'bg-emerald-950/40',
        rawColor: '#064e3b',
      };
    } else if (change < -5) {
      return {
        bg: 'bg-rose-600 hover:bg-rose-500',
        text: 'text-white',
        border: 'border-rose-400',
        label: 'bg-rose-800/60',
        rawColor: '#e11d48',
      };
    } else if (change < -1.5) {
      return {
        bg: 'bg-rose-700 hover:bg-rose-600',
        text: 'text-white',
        border: 'border-rose-500',
        label: 'bg-rose-900/40',
        rawColor: '#be123c',
      };
    } else if (change < -0.1) {
      return {
        bg: 'bg-rose-950/70 hover:bg-rose-950/90',
        text: 'text-rose-200',
        border: 'border-rose-900/50',
        label: 'bg-rose-950/50',
        rawColor: '#4c0519',
      };
    } else {
      return {
        bg: 'bg-slate-800 hover:bg-slate-700',
        text: 'text-slate-300',
        border: 'border-slate-700',
        label: 'bg-slate-900/50',
        rawColor: '#1e293b',
      };
    }
  };

  const getStockChange = (stock: StockData) => {
    return currency === 'bs' ? stock.changeBs : stock.changeUsd;
  };

  const getStockPrice = (stock: StockData) => {
    return currency === 'bs' ? stock.closeBs : stock.closeUsd;
  };

  // Sort and process stock data
  const processedStocks = React.useMemo(() => {
    const dataCopy = [...stocks];
    if (sortBy === 'ticker') {
      dataCopy.sort((a, b) => a.ticker.localeCompare(b.ticker));
    } else if (sortBy === 'change') {
      dataCopy.sort((a, b) => getStockChange(b) - getStockChange(a));
    } else if (sortBy === 'price') {
      dataCopy.sort((a, b) => getStockPrice(b) - getStockPrice(a));
    }
    return dataCopy;
  }, [stocks, sortBy, currency]);

  // Compute stats
  const stats = React.useMemo(() => {
    let advances = 0;
    let declines = 0;
    let unchanged = 0;

    stocks.forEach((s) => {
      const change = getStockChange(s);
      if (change > 0.05) advances++;
      else if (change < -0.05) declines++;
      else unchanged++;
    });

    return { advances, declines, unchanged };
  }, [stocks, currency]);

  return (
    <div className="bg-bg-center rounded-2xl border border-grid-color p-5 flex flex-col h-full text-text-main" id="market-heatmap-container">
      {/* Heatmap header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-grid-color/50 pb-4">
        <div>
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            <Layers className="text-accent-blue w-5 h-5" />
            Mapa de Calor de Acciones
          </h3>
          <p className="text-text-dim text-xs mt-0.5">Distribución visual del rendimiento diario</p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Currency Toggle */}
          <div className="flex bg-bg-deep rounded-lg p-0.5 border border-grid-color">
            <button
              onClick={() => setCurrency('bs')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                currency === 'bs'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-dim hover:text-text-main hover:bg-white/5'
              }`}
            >
              Bs
            </button>
            <button
              onClick={() => setCurrency('usd')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                currency === 'usd'
                  ? 'bg-accent-blue text-white shadow-sm'
                  : 'text-text-dim hover:text-text-main hover:bg-white/5'
              }`}
            >
              USD
            </button>
          </div>

          {/* Sort Selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-bg-deep border border-grid-color rounded-lg px-2.5 py-1 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
          >
            <option value="change">Ordenar por Var%</option>
            <option value="ticker">Ordenar por Nombre</option>
            <option value="price">Ordenar por Precio</option>
          </select>

          {/* Size By Selection */}
          <select
            value={sizeBy}
            onChange={(e) => setSizeBy(e.target.value as any)}
            className="bg-bg-deep border border-grid-color rounded-lg px-2.5 py-1 text-xs font-bold text-text-main focus:outline-none focus:ring-1 focus:ring-accent-blue focus:border-accent-blue"
          >
            <option value="uniform">Tamaño Fijo</option>
            <option value="price">Tamaño por Precio</option>
          </select>
        </div>
      </div>

      {/* Mini Bar summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-lg p-2 flex flex-col items-center">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Suben</span>
          <span className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
            <TrendingUp size={14} />
            {stats.advances}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex flex-col items-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sin Var.</span>
          <span className="text-sm font-bold text-slate-300 mt-0.5">
            {stats.unchanged}
          </span>
        </div>
        <div className="bg-rose-950/20 border border-rose-900/30 rounded-lg p-2 flex flex-col items-center">
          <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Bajan</span>
          <span className="text-sm font-bold text-rose-400 mt-0.5 flex items-center gap-1">
            <TrendingDown size={14} />
            {stats.declines}
          </span>
        </div>
      </div>

      {/* Grid container */}
      <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto p-[15px] scrollbar-thin scrollbar-thumb-accent-blue/20">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {processedStocks.map((stock) => {
            const change = getStockChange(stock);
            const price = getStockPrice(stock);
            const priceFormatted = currency === 'bs' 
              ? `Bs. ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
              : `$ ${price.toFixed(4)}`;
            
            const changeColor = getColorClasses(change);
            const isHovered = hoveredTicker === stock.ticker;

            // Compute variable spans if sized by price
            let colSpan = 'col-span-1';
            let rowSpan = 'row-span-1';
            let minHeight = 'min-h-[74px]';

            if (sizeBy === 'price') {
              // Higher priced stocks get larger tiles to indicate market premium
              if (price > 1500) {
                colSpan = 'col-span-2';
                minHeight = 'min-h-[94px]';
              } else if (price > 700) {
                colSpan = 'col-span-1';
                minHeight = 'min-h-[94px]';
              }
            }

            return (
              <motion.div
                key={stock.ticker}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: 1,
                  boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)' : 'none'
                }}
                whileHover={{ scale: 1.02, y: -1 }}
                onMouseEnter={() => onHoverTicker(stock.ticker)}
                onMouseLeave={() => onHoverTicker(null)}
                className={`relative rounded-xl border p-2.5 flex flex-col justify-between transition-colors duration-150 cursor-pointer ${colSpan} ${rowSpan} ${minHeight} ${changeColor.bg} ${isHovered ? `border-accent-blue scale-[1.02] z-10 brightness-110` : 'border-grid-color'}`}
                id={`heatmap-tile-${stock.ticker}`}
              >
                {/* Visual indicator of hovered state shared with grid */}
                {isHovered && (
                  <motion.div 
                    layoutId="outlineHover"
                    className="absolute -inset-[2px] rounded-xl border-2 border-accent-blue pointer-events-none"
                    transition={{ duration: 0.15 }}
                  />
                )}

                {/* Top: Ticker & Plus/Minus arrow */}
                <div className="flex items-start justify-between gap-1 w-full">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-sm tracking-tight text-white">{stock.ticker}</span>
                    <span className="text-[10px] text-text-main font-medium opacity-80 truncate max-w-[110px]" title={stock.name}>
                      {stock.name}
                    </span>
                  </div>
                  <div className={`p-1 rounded-lg ${changeColor.label} text-[10px]`}>
                    {change > 0 ? (
                      <TrendingUp size={12} className="text-emerald-100" />
                    ) : change < 0 ? (
                      <TrendingDown size={12} className="text-rose-100" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </div>
                </div>

                {/* Bottom: Price and change metric */}
                <div className="mt-2 pt-2 border-t border-white/5 flex items-end justify-between w-full">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/55 font-bold uppercase tracking-wider">Cierre</span>
                    <span className="text-[11px] font-mono text-white leading-tight truncate">{priceFormatted}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-black tracking-tight ${changeColor.text}`}>
                      {change > 0 ? '+' : ''}
                      {change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {processedStocks.length === 0 && (
          <div className="text-center text-text-dim py-12">
            No hay información de mercado disponible para heatmap.
          </div>
        )}
      </div>

      {/* Heatmap intensity color legend */}
      <div className="mt-5 border-t border-grid-color/50 pt-4 flex flex-col gap-2.5">
        <span className="text-[10px] text-text-dim font-bold uppercase tracking-wider text-center">Espectro de Variación</span>
        <div className="flex items-center justify-between gap-1 text-[10px] text-text-dim">
          <span>&lt; -5%</span>
          <div className="flex-1 h-3.5 rounded-md overflow-hidden flex mx-2 border border-grid-color">
            <div className="flex-1 bg-rose-600" title="&lt; -5%" />
            <div className="flex-1 bg-rose-700" title="-1.5% a -5%" />
            <div className="flex-1 bg-rose-950/70" title="-0.1% a -1.5%" />
            <div className="flex-1 bg-slate-800" title="0%" />
            <div className="flex-1 bg-emerald-900/60" title="0.1% a 1.5%" />
            <div className="flex-1 bg-emerald-700" title="1.5% a 5%" />
            <div className="flex-1 bg-emerald-600" title="&gt; 5%" />
          </div>
          <span>&gt; +5%</span>
        </div>
      </div>
    </div>
  );
}
