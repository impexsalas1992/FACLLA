import React, { useState, useMemo } from 'react';
import { SaleItem, ExpenseItem, ActiveModule } from '../../types';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  ShoppingCart,
  Scale,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  PieChart as PieIcon,
  BarChart2,
  ChevronRight,
  Layers,
  Building2,
  Percent,
  Wallet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface DashboardModuleProps {
  salesData: SaleItem[];
  expensesData: ExpenseItem[];
  setActiveModule?: (module: ActiveModule) => void;
  onOpenSettings?: (tab?: 'drive' | 'sheets' | 'script') => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  salesData,
  expensesData,
  setActiveModule,
  onOpenSettings
}) => {
  // Current calendar state
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1 - 12
  const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Month selector (defaults to current month)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(currentMonthKey);
  const [chartRange, setChartRange] = useState<'6M' | '12M'>('6M');

  // Parse selected year and month
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const parts = selectedMonthKey.split('-');
    return [parseInt(parts[0], 10) || currentYear, parseInt(parts[1], 10) || currentMonth];
  }, [selectedMonthKey, currentYear, currentMonth]);

  // Previous month key for growth comparison
  const previousMonthKey = useMemo(() => {
    let prevY = selectedYear;
    let prevM = selectedMonthNum - 1;
    if (prevM < 1) {
      prevM = 12;
      prevY -= 1;
    }
    return `${prevY}-${String(prevM).padStart(2, '0')}`;
  }, [selectedYear, selectedMonthNum]);

  // Available months list derived from data
  const availableMonthKeys = useMemo(() => {
    const set = new Set<string>();
    // Always include current and previous month
    set.add(currentMonthKey);
    set.add(previousMonthKey);

    salesData.forEach(s => {
      if (s.date && s.date.length >= 7) {
        set.add(s.date.substring(0, 7));
      }
    });
    expensesData.forEach(e => {
      if (e.date && e.date.length >= 7) {
        set.add(e.date.substring(0, 7));
      }
    });

    return Array.from(set).sort().reverse();
  }, [salesData, expensesData, currentMonthKey, previousMonthKey]);

  // Selected Month Sales & Expenses
  const selectedSales = useMemo(() => {
    return salesData.filter(s => s.date && s.date.startsWith(selectedMonthKey));
  }, [salesData, selectedMonthKey]);

  const selectedExpenses = useMemo(() => {
    return expensesData.filter(e => e.date && e.date.startsWith(selectedMonthKey));
  }, [expensesData, selectedMonthKey]);

  // Previous Month Sales & Expenses
  const prevSales = useMemo(() => {
    return salesData.filter(s => s.date && s.date.startsWith(previousMonthKey));
  }, [salesData, previousMonthKey]);

  const prevExpenses = useMemo(() => {
    return expensesData.filter(e => e.date && e.date.startsWith(previousMonthKey));
  }, [expensesData, previousMonthKey]);

  // Metrics for Selected Month
  const metrics = useMemo(() => {
    // Current period
    const totalSales = selectedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const salesBase = selectedSales.reduce((acc, s) => acc + (Number(s.base) || 0), 0);
    const salesIgv = selectedSales.reduce((acc, s) => acc + (Number(s.igv) || 0), 0);
    const salesDetraction = selectedSales.reduce((acc, s) => acc + (Number(s.detractionAmount) || 0), 0);
    const salesCount = selectedSales.length;

    const totalExpenses = selectedExpenses.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    const expensesBase = selectedExpenses.reduce((acc, e) => acc + (Number(e.base) || 0), 0);
    const expensesIgv = selectedExpenses.reduce((acc, e) => acc + (Number(e.igv) || 0), 0);
    const expensesDetraction = selectedExpenses.reduce((acc, e) => acc + (Number(e.detractionAmount) || 0), 0);
    const expensesCount = selectedExpenses.length;

    const netProfit = totalSales - totalExpenses;
    const profitMargin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const igvBalance = salesIgv - expensesIgv; // > 0 SUNAT a pagar, < 0 Saldo a favor

    // Previous period for growth comparison
    const prevTotalSales = prevSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const prevTotalExpenses = prevExpenses.reduce((acc, e) => acc + (Number(e.total) || 0), 0);
    const prevNetProfit = prevTotalSales - prevTotalExpenses;
    const prevSalesCount = prevSales.length;
    const prevExpensesCount = prevExpenses.length;

    // Growth rates (% change)
    const salesGrowth = prevTotalSales > 0
      ? ((totalSales - prevTotalSales) / prevTotalSales) * 100
      : (totalSales > 0 ? 100 : 0);

    const expensesGrowth = prevTotalExpenses > 0
      ? ((totalExpenses - prevTotalExpenses) / prevTotalExpenses) * 100
      : (totalExpenses > 0 ? 100 : 0);

    const profitGrowth = prevNetProfit !== 0
      ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100
      : (netProfit > 0 ? 100 : 0);

    return {
      totalSales,
      salesBase,
      salesIgv,
      salesDetraction,
      salesCount,
      totalExpenses,
      expensesBase,
      expensesIgv,
      expensesDetraction,
      expensesCount,
      netProfit,
      profitMargin,
      igvBalance,
      prevTotalSales,
      prevTotalExpenses,
      prevNetProfit,
      prevSalesCount,
      prevExpensesCount,
      salesGrowth,
      expensesGrowth,
      profitGrowth
    };
  }, [selectedSales, selectedExpenses, prevSales, prevExpenses]);

  // Monthly Bar Chart Data (Last 6 or 12 months)
  const chartData = useMemo(() => {
    const numMonths = chartRange === '6M' ? 6 : 12;
    const result = [];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonthNum - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[m - 1].substring(0, 3)} ${y.toString().substring(2)}`;

      const mSales = salesData
        .filter(s => s.date && s.date.startsWith(key))
        .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

      const mExpenses = expensesData
        .filter(e => e.date && e.date.startsWith(key))
        .reduce((sum, e) => sum + (Number(e.total) || 0), 0);

      const mProfit = mSales - mExpenses;

      result.push({
        key,
        name: label,
        fullName: `${MONTH_NAMES[m - 1]} ${y}`,
        ventas: Number(mSales.toFixed(2)),
        gastos: Number(mExpenses.toFixed(2)),
        utilidad: Number(mProfit.toFixed(2)),
        isCurrent: key === selectedMonthKey
      });
    }

    return result;
  }, [salesData, expensesData, selectedYear, selectedMonthNum, chartRange, selectedMonthKey]);

  // Expenses by category for the selected month
  const categoryBreakdown = useMemo(() => {
    const map: { [cat: string]: number } = {};
    selectedExpenses.forEach(e => {
      const cat = e.expenseCategory || 'Otros Gastos';
      map[cat] = (map[cat] || 0) + (Number(e.total) || 0);
    });

    const total = metrics.totalExpenses;
    return Object.entries(map)
      .map(([cat, amount]) => ({
        category: cat,
        amount,
        percentage: total > 0 ? (amount / total) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [selectedExpenses, metrics.totalExpenses]);

  // Format currency helper
  const formatSoles = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Human readable label for selected month
  const selectedMonthLabel = `${MONTH_NAMES[selectedMonthNum - 1]} ${selectedYear}`;
  const prevMonthLabel = `${MONTH_NAMES[(selectedMonthNum === 1 ? 12 : selectedMonthNum - 1) - 1]} ${selectedMonthNum === 1 ? selectedYear - 1 : selectedYear}`;

  return (
    <div className="space-y-6" id="dashboard-module-container">
      {/* Header Banner & Period Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl shadow-inner">
                <BarChart2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Panel Ejecutivo & Métricas de Rendimiento
              </h2>
            </div>
            <p className="text-sm text-slate-400">
              Resumen integral de ingresos, egresos, rentabilidad y comparativas de crecimiento mensual
            </p>
          </div>

          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2.5 bg-slate-800/90 border border-slate-700 p-1.5 rounded-xl shadow-sm">
            <Calendar className="w-4 h-4 text-emerald-400 ml-2" />
            <label htmlFor="dashboard-month-select" className="text-xs text-slate-400 font-medium">
              Mes:
            </label>
            <select
              id="dashboard-month-select"
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
              className="bg-slate-900 text-white font-bold text-xs sm:text-sm border border-slate-600 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
            >
              {availableMonthKeys.map((key) => {
                const [y, m] = key.split('-');
                const mIdx = parseInt(m, 10) - 1;
                const isCurrent = key === currentMonthKey;
                return (
                  <option key={key} value={key}>
                    {MONTH_NAMES[mIdx]} {y} {isCurrent ? '⭐ (Mes Actual)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Ventas */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-emerald-500/50 hover:shadow-emerald-950/20 group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all group-hover:bg-emerald-500/20"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-400" />
              Ventas del Mes
            </span>
            {metrics.salesGrowth !== 0 ? (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                  metrics.salesGrowth > 0
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                }`}
                title={`Comparado con ${prevMonthLabel}`}
              >
                {metrics.salesGrowth > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {metrics.salesGrowth > 0 ? '+' : ''}
                {metrics.salesGrowth.toFixed(1)}%
              </span>
            ) : (
              <span className="text-xs text-slate-500">Sin datos prev.</span>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatSoles(metrics.totalSales)}
            </div>
            <p className="text-xs text-slate-400">
              {metrics.salesCount} {metrics.salesCount === 1 ? 'comprobante emitido' : 'comprobantes emitidos'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">Base Imponible</span>
              <span className="font-semibold text-slate-200">{formatSoles(metrics.salesBase)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">IGV Débito Fiscal</span>
              <span className="font-semibold text-emerald-400">{formatSoles(metrics.salesIgv)}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Gastos */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-sky-500/50 hover:shadow-sky-950/20 group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-sky-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all group-hover:bg-sky-500/20"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              Gastos del Mes
            </span>
            {metrics.expensesGrowth !== 0 ? (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                  metrics.expensesGrowth > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}
                title={`Comparado con ${prevMonthLabel}`}
              >
                {metrics.expensesGrowth > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {metrics.expensesGrowth > 0 ? '+' : ''}
                {metrics.expensesGrowth.toFixed(1)}%
              </span>
            ) : (
              <span className="text-xs text-slate-500">Sin datos prev.</span>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatSoles(metrics.totalExpenses)}
            </div>
            <p className="text-xs text-slate-400">
              {metrics.expensesCount} {metrics.expensesCount === 1 ? 'comprobante registrado' : 'comprobantes registrados'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">Base Imponible</span>
              <span className="font-semibold text-slate-200">{formatSoles(metrics.expensesBase)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">IGV Crédito Fiscal</span>
              <span className="font-semibold text-sky-400">{formatSoles(metrics.expensesIgv)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Utilidad Bruta / Margen */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-purple-950/20 group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-purple-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all group-hover:bg-purple-500/20"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-purple-400" />
              Margen / Utilidad
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                metrics.profitMargin >= 0
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}
            >
              <Percent className="w-3 h-3" />
              {metrics.profitMargin.toFixed(1)}% margen
            </span>
          </div>

          <div className="space-y-1">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSoles(metrics.netProfit)}
            </div>
            <p className="text-xs text-slate-400">
              {metrics.netProfit >= 0 ? 'Resultado Operativo Favorable' : 'Déficit / Gasto Mayor a Ingresos'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">Mes Anterior</span>
              <span className="font-semibold text-slate-300">{formatSoles(metrics.prevNetProfit)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Var. Utilidad</span>
              <span
                className={`font-semibold ${
                  metrics.profitGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {metrics.profitGrowth >= 0 ? '+' : ''}
                {metrics.profitGrowth.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Balance Tributario IGV */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all hover:border-amber-500/50 hover:shadow-amber-950/20 group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none transition-all group-hover:bg-amber-500/20"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-amber-400" />
              Balance IGV (SUNAT)
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${
                metrics.igvBalance > 0
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {metrics.igvBalance > 0 ? 'Por Pagar' : 'Saldo a Favor'}
            </span>
          </div>

          <div className="space-y-1">
            <div
              className={`text-2xl sm:text-3xl font-black tracking-tight ${
                metrics.igvBalance > 0 ? 'text-amber-300' : 'text-emerald-400'
              }`}
            >
              {formatSoles(Math.abs(metrics.igvBalance))}
            </div>
            <p className="text-xs text-slate-400">
              {metrics.igvBalance > 0
                ? 'IGV estimado a liquidar en SUNAT'
                : 'Crédito fiscal acumulado a favor'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400 block">Detracciones Vtas.</span>
              <span className="font-semibold text-slate-300">{formatSoles(metrics.salesDetraction)}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Detracciones Gtos.</span>
              <span className="font-semibold text-slate-300">{formatSoles(metrics.expensesDetraction)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Growth Comparisons Section */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-700/70">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Comparativa de Crecimiento: {selectedMonthLabel} vs {prevMonthLabel}
            </h3>
            <p className="text-xs text-slate-400">
              Evolución intermensual directa para la toma de decisiones financieras
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold self-start sm:self-auto">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Mes Anterior: {prevMonthLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Growth Card: Ventas */}
          <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                Crecimiento de Ventas
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  metrics.salesGrowth >= 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {metrics.salesGrowth >= 0 ? '+' : ''}
                {metrics.salesGrowth.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Actual</span>
                <span className="text-base font-bold text-white">{formatSoles(metrics.totalSales)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Anterior</span>
                <span className="text-sm font-semibold text-slate-400">{formatSoles(metrics.prevTotalSales)}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-2 flex items-center justify-between">
              <span>Diferencia Neta:</span>
              <span
                className={`font-bold ${
                  metrics.totalSales - metrics.prevTotalSales >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {metrics.totalSales - metrics.prevTotalSales >= 0 ? '+' : ''}
                {formatSoles(metrics.totalSales - metrics.prevTotalSales)}
              </span>
            </div>
          </div>

          {/* Growth Card: Gastos */}
          <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
                Variación de Gastos
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  metrics.expensesGrowth <= 0
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {metrics.expensesGrowth >= 0 ? '+' : ''}
                {metrics.expensesGrowth.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Actual</span>
                <span className="text-base font-bold text-white">{formatSoles(metrics.totalExpenses)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Anterior</span>
                <span className="text-sm font-semibold text-slate-400">{formatSoles(metrics.prevTotalExpenses)}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-2 flex items-center justify-between">
              <span>Diferencia Neta:</span>
              <span
                className={`font-bold ${
                  metrics.totalExpenses - metrics.prevTotalExpenses <= 0
                    ? 'text-emerald-400'
                    : 'text-amber-400'
                }`}
              >
                {metrics.totalExpenses - metrics.prevTotalExpenses >= 0 ? '+' : ''}
                {formatSoles(metrics.totalExpenses - metrics.prevTotalExpenses)}
              </span>
            </div>
          </div>

          {/* Growth Card: Utilidad Neta */}
          <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-purple-400" />
                Variación de Utilidad
              </span>
              <span
                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                  metrics.profitGrowth >= 0
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}
              >
                {metrics.profitGrowth >= 0 ? '+' : ''}
                {metrics.profitGrowth.toFixed(1)}%
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Actual</span>
                <span className="text-base font-bold text-white">{formatSoles(metrics.netProfit)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block font-bold">Mes Anterior</span>
                <span className="text-sm font-semibold text-slate-400">{formatSoles(metrics.prevNetProfit)}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-slate-800/60 rounded-lg p-2 flex items-center justify-between">
              <span>Diferencia Neta:</span>
              <span
                className={`font-bold ${
                  metrics.netProfit - metrics.prevNetProfit >= 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {metrics.netProfit - metrics.prevNetProfit >= 0 ? '+' : ''}
                {formatSoles(metrics.netProfit - metrics.prevNetProfit)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Bar Chart: Ingresos vs Egresos Mensuales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart (2 cols on large screens) */}
        <div className="lg:col-span-2 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/70">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-emerald-400" />
                Ingresos vs Egresos Mensuales
              </h3>
              <p className="text-xs text-slate-400">
                Comparativa cronológica de ventas y gastos en Soles (S/)
              </p>
            </div>

            {/* Range Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-1 self-start sm:self-auto">
              <button
                onClick={() => setChartRange('6M')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  chartRange === '6M'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Últimos 6 Meses
              </button>
              <button
                onClick={() => setChartRange('12M')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                  chartRange === '12M'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                12 Meses
              </button>
            </div>
          </div>

          {/* Recharts Bar Chart */}
          <div className="h-[320px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `S/ ${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[180px]">
                          <p className="font-bold text-slate-200 border-b border-slate-700 pb-1.5 flex items-center justify-between">
                            <span>{data.fullName}</span>
                            {data.isCurrent && (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-semibold">
                                Seleccionado
                              </span>
                            )}
                          </p>
                          <div className="flex items-center justify-between text-emerald-400 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
                              Ventas:
                            </span>
                            <span>{formatSoles(data.ventas)}</span>
                          </div>
                          <div className="flex items-center justify-between text-sky-400 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 inline-block"></span>
                              Gastos:
                            </span>
                            <span>{formatSoles(data.gastos)}</span>
                          </div>
                          <div className="flex items-center justify-between text-purple-300 font-bold pt-1 border-t border-slate-800">
                            <span>Utilidad Neta:</span>
                            <span className={data.utilidad >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatSoles(data.utilidad)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingBottom: 15, fontSize: 12 }}
                />
                <Bar
                  dataKey="ventas"
                  name="Ventas (Ingresos)"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey="gastos"
                  name="Gastos (Egresos)"
                  fill="#0ea5e9"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown & Quick Actions (1 col on large screens) */}
        <div className="space-y-6">
          {/* Expenses by Category */}
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700/70">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-sky-400" />
                Desglose de Gastos del Mes
              </h4>
              <span className="text-xs text-slate-400">{selectedMonthLabel}</span>
            </div>

            {categoryBreakdown.length > 0 ? (
              <div className="space-y-2.5 pt-1">
                {categoryBreakdown.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium truncate max-w-[160px]" title={item.category}>
                        {item.category}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-white">{formatSoles(item.amount)}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5">({item.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                        style={{ width: `${Math.min(100, Math.max(5, item.percentage))}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                No hay registros de gastos para el mes de {selectedMonthLabel}.
              </div>
            )}
          </div>

          {/* Quick Module Navigation Buttons */}
          {setActiveModule && (
            <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 shadow-xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Accesos Directos
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => setActiveModule('sales')}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-slate-200 transition group"
                >
                  <span className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    Ir a Módulo 1: Registro de Ventas
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition" />
                </button>

                <button
                  onClick={() => setActiveModule('expenses')}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 hover:border-sky-500/50 rounded-xl text-xs font-semibold text-slate-200 transition group"
                >
                  <span className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-sky-400" />
                    Ir a Módulo 2: Registro de Gastos
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-sky-400 transition" />
                </button>

                <button
                  onClick={() => setActiveModule('reports')}
                  className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-900 border border-slate-700 hover:border-purple-500/50 rounded-xl text-xs font-semibold text-slate-200 transition group"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-purple-400" />
                    Ir a Módulo 3: Reportes & Análisis IA
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
