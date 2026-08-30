import React, { useState } from 'react';
import { SaleItem, ExpenseItem } from '../../types';
import { generateFinancialReportAI, ExecutiveAiReport } from '../../utils/aiService';
import { getGoogleDriveFolderUrl, getCompanyName, getCompanyShortName } from '../../utils/googleSheetsSync';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  FileSpreadsheet,
  Printer,
  Sparkles,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Scale,
  Percent,
  FolderOpen,
  ExternalLink,
  FileText,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Settings2,
  Code2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Copy,
  Check,
  Building2,
  Target,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Calendar
} from 'lucide-react';

interface ReportsModuleProps {
  salesData: SaleItem[];
  expensesData: ExpenseItem[];
  apiKey: string;
  selectedModel: string;
  onOpenSettings?: (tab?: 'drive' | 'sheets' | 'script') => void;
}

export type PeriodPreset = 'CURRENT_MONTH' | 'LAST_3_MONTHS' | 'YTD' | 'PREVIOUS_MONTH' | 'ALL_TIME' | 'CUSTOM';

export const ReportsModule: React.FC<ReportsModuleProps> = ({
  salesData,
  expensesData,
  apiKey,
  selectedModel,
  onOpenSettings
}) => {
  // Period Preset & Filters
  const now = new Date();
  const currentYearStr = now.getFullYear().toString();
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthStr = currentMonthNum < 10 ? `0${currentMonthNum}` : `${currentMonthNum}`;

  const [activePreset, setActivePreset] = useState<PeriodPreset>('CURRENT_MONTH');
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // AI Insights State
  const [aiReport, setAiReport] = useState<ExecutiveAiReport | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [reportViewMode, setReportViewMode] = useState<'cards' | 'raw'>('cards');
  const [showDetailedTable, setShowDetailedTable] = useState(true);
  const [tableTab, setTableTab] = useState<'all' | 'sales' | 'expenses'>('all');

  // Month names helper
  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  // Apply quick-action preset chips
  const applyPreset = (preset: PeriodPreset) => {
    setActivePreset(preset);
    const currentDate = new Date();
    const currYear = currentDate.getFullYear();
    const currMonth = currentDate.getMonth() + 1; // 1-12

    if (preset === 'CURRENT_MONTH') {
      setSelectedYear(currYear.toString());
      setSelectedMonth(currMonth < 10 ? `0${currMonth}` : `${currMonth}`);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'PREVIOUS_MONTH') {
      const prevMonth = currMonth === 1 ? 12 : currMonth - 1;
      const prevYear = currMonth === 1 ? currYear - 1 : currYear;
      setSelectedYear(prevYear.toString());
      setSelectedMonth(prevMonth < 10 ? `0${prevMonth}` : `${prevMonth}`);
      setStartDate('');
      setEndDate('');
    } else if (preset === 'LAST_3_MONTHS') {
      // Calculate 90 days range
      const endD = new Date(currYear, currMonth, 0); // last day of current month
      const startD = new Date(currYear, currMonth - 3, 1); // 3 months ago first day
      
      const formatIso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      setSelectedYear('ALL');
      setSelectedMonth('ALL');
      setStartDate(formatIso(startD));
      setEndDate(formatIso(endD));
    } else if (preset === 'YTD') {
      // Year to date: Jan 1st of current year to today
      const startD = `${currYear}-01-01`;
      const formatIso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      
      setSelectedYear(currYear.toString());
      setSelectedMonth('ALL');
      setStartDate(startD);
      setEndDate(formatIso(currentDate));
    } else if (preset === 'ALL_TIME') {
      setSelectedYear('ALL');
      setSelectedMonth('ALL');
      setStartDate('');
      setEndDate('');
    }
  };

  // Helper label for active period focus
  const getPeriodLabel = () => {
    if (activePreset === 'CURRENT_MONTH') {
      const mIdx = parseInt(selectedMonth, 10) - 1;
      return `${MONTH_NAMES[mIdx] || ''} ${selectedYear}`;
    }
    if (activePreset === 'PREVIOUS_MONTH') {
      const mIdx = parseInt(selectedMonth, 10) - 1;
      return `Mes Anterior (${MONTH_NAMES[mIdx] || ''} ${selectedYear})`;
    }
    if (activePreset === 'LAST_3_MONTHS') {
      return `Últimos 3 Meses (${startDate} a ${endDate})`;
    }
    if (activePreset === 'YTD') {
      return `Acumulado del Año ${selectedYear} (YTD)`;
    }
    if (activePreset === 'ALL_TIME') {
      return 'Histórico Completo (Todos los años)';
    }
    if (startDate && endDate) {
      return `Rango Personalizado: ${startDate} al ${endDate}`;
    }
    if (selectedMonth !== 'ALL') {
      const mIdx = parseInt(selectedMonth, 10) - 1;
      return `${MONTH_NAMES[mIdx] || ''} ${selectedYear}`;
    }
    return `Año ${selectedYear}`;
  };

  // Filtering Logic
  const filterSales = (items: SaleItem[]) => {
    return items.filter(item => {
      if (!item.date) return false;
      const itemYear = item.date.substring(0, 4);
      const itemMonth = item.date.substring(5, 7);

      if (selectedYear !== 'ALL' && itemYear !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && itemMonth !== selectedMonth) return false;

      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      return true;
    });
  };

  const filterExpenses = (items: ExpenseItem[]) => {
    return items.filter(item => {
      if (!item.date) return false;
      const itemYear = item.date.substring(0, 4);
      const itemMonth = item.date.substring(5, 7);

      if (selectedYear !== 'ALL' && itemYear !== selectedYear) return false;
      if (selectedMonth !== 'ALL' && itemMonth !== selectedMonth) return false;

      if (startDate && item.date < startDate) return false;
      if (endDate && item.date > endDate) return false;

      return true;
    });
  };

  const filteredSales = filterSales(salesData);
  const filteredExpenses = filterExpenses(expensesData);

  // Totals & Metrics
  const totalVentasBrutas = filteredSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalBaseVentas = filteredSales.reduce((acc, curr) => acc + (curr.base || 0), 0);
  const totalIgvVentas = filteredSales.reduce((acc, curr) => acc + (curr.igv || 0), 0);
  const totalCostosVenta = filteredSales.reduce((acc, curr) => acc + (curr.cost || 0), 0);
  const totalDetracionesVentas = filteredSales.reduce((acc, curr) => acc + (curr.detractionAmount || 0), 0);

  const totalGastosBrutos = filteredExpenses.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalBaseGastos = filteredExpenses.reduce((acc, curr) => acc + (curr.base || 0), 0);
  const totalIgvGastos = filteredExpenses.reduce((acc, curr) => acc + (curr.igv || 0), 0);
  const totalRetention4th = filteredExpenses.reduce((acc, curr) => acc + (curr.retention4th || 0), 0);
  const totalDetraccionesGastos = filteredExpenses.reduce((acc, curr) => acc + (curr.detractionAmount || 0), 0);

  // Financial Outcomes
  const utilidadBruta = totalVentasBrutas - totalGastosBrutos - totalCostosVenta;
  const margenUtilidadPercent = totalVentasBrutas > 0 ? (utilidadBruta / totalVentasBrutas) * 100 : 0;

  // IGV Tax Balance
  const igvBalance = totalIgvVentas - totalIgvGastos; // > 0: Pay to SUNAT, < 0: Credit in favor

  // Monthly breakdown dataset for Recharts
  const monthlyMap: Record<string, { monthKey: string; monthName: string; Ventas: number; Gastos: number; Utilidad: number }> = {};

  // Populate last 12 months or selected year months
  for (let m = 1; m <= 12; m++) {
    const monthStr = m < 10 ? `0${m}` : `${m}`;
    const key = selectedYear !== 'ALL' ? `${selectedYear}-${monthStr}` : monthStr;
    const name = MONTH_NAMES[m - 1];
    monthlyMap[key] = { monthKey: key, monthName: name, Ventas: 0, Gastos: 0, Utilidad: 0 };
  }

  filteredSales.forEach(s => {
    if (!s.date) return;
    const itemYear = s.date.substring(0, 4);
    const itemMonth = s.date.substring(5, 7);
    const key = selectedYear !== 'ALL' ? `${itemYear}-${itemMonth}` : itemMonth;
    if (monthlyMap[key]) {
      monthlyMap[key].Ventas += s.total || 0;
    }
  });

  filteredExpenses.forEach(e => {
    if (!e.date) return;
    const itemYear = e.date.substring(0, 4);
    const itemMonth = e.date.substring(5, 7);
    const key = selectedYear !== 'ALL' ? `${itemYear}-${itemMonth}` : itemMonth;
    if (monthlyMap[key]) {
      monthlyMap[key].Gastos += e.total || 0;
    }
  });

  const chartMonthlyData = Object.values(monthlyMap).map(d => ({
    ...d,
    Utilidad: d.Ventas - d.Gastos,
    Ventas: Number(d.Ventas.toFixed(2)),
    Gastos: Number(d.Gastos.toFixed(2))
  }));

  // Expense Categories Pie Chart Data
  const categoryMap: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    const cat = e.expenseCategory || 'Otros Gastos';
    categoryMap[cat] = (categoryMap[cat] || 0) + (e.total || 0);
  });

  const pieColors = ['#38bdf8', '#10b981', '#fbbf24', '#a855f7', '#ec4899', '#64748b'];
  const pieCategoryData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value: Number(value.toFixed(2))
  }));

  // Top Clients
  const topClientsMap: Record<string, number> = {};
  filteredSales.forEach(s => {
    const name = s.clientName || 'CLIENTE VARIOS';
    topClientsMap[name] = (topClientsMap[name] || 0) + (s.total || 0);
  });
  const topClients = Object.entries(topClientsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Top Suppliers
  const topSuppliersMap: Record<string, number> = {};
  filteredExpenses.forEach(e => {
    const name = e.supplierName || 'PROVEEDOR VARIOS';
    topSuppliersMap[name] = (topSuppliersMap[name] || 0) + (e.total || 0);
  });
  const topSuppliers = Object.entries(topSuppliersMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Generate AI Executive Report
  const handleGenerateAiReport = async () => {
    setIsGeneratingAi(true);
    setAiReport(null);

    const dataSummary = {
      empresa: getCompanyName(),
      periodo: {
        enfoque: getPeriodLabel(),
        preset: activePreset,
        year: selectedYear,
        month: selectedMonth === 'ALL' ? 'Todos los meses' : MONTH_NAMES[parseInt(selectedMonth) - 1],
        rangoFechas: startDate && endDate ? `${startDate} al ${endDate}` : 'N/A'
      },
      ventas: {
        totalBruto: totalVentasBrutas,
        baseImponible: totalBaseVentas,
        igvDebito: totalIgvVentas,
        costoVentas: totalCostosVenta,
        detraccionesTotal: totalDetracionesVentas,
        comprobantesCount: filteredSales.length
      },
      gastos: {
        totalBruto: totalGastosBrutos,
        baseImponible: totalBaseGastos,
        igvCreditoFiscal: totalIgvGastos,
        retencion4ta: totalRetention4th,
        detraccionesTotal: totalDetraccionesGastos,
        comprobantesCount: filteredExpenses.length,
        distribucionCategorias: categoryMap
      },
      resultados: {
        utilidadBrutaEstadistica: utilidadBruta,
        margenPorcentaje: margenUtilidadPercent.toFixed(2) + '%',
        balanceIgvSunat: igvBalance > 0 ? `S/ ${igvBalance.toFixed(2)} por pagar a SUNAT` : `S/ ${Math.abs(igvBalance).toFixed(2)} Crédito Fiscal a Favor`
      },
      topClientes: topClients,
      topProveedores: topSuppliers
    };

    try {
      const report = await generateFinancialReportAI(dataSummary, apiKey, selectedModel);
      setAiReport(report);
    } catch (err: any) {
      console.error('Error generando informe IA:', err);
      // Fallback local report
      const fallbackReport = await generateFinancialReportAI(dataSummary, '', selectedModel);
      setAiReport(fallbackReport);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleCopySummary = () => {
    if (!aiReport) return;
    const company = getCompanyName();
    const periodStr = selectedMonth === 'ALL' ? `Año ${selectedYear}` : `${MONTH_NAMES[parseInt(selectedMonth) - 1]} ${selectedYear}`;
    
    const textToCopy = `📌 *INFORME EJECUTIVO FINANCIERO - ${company}*
📅 *Período:* ${periodStr}

🎯 *Diagnóstico:* ${aiReport.headline}
📊 *Salud Financiera:* ${aiReport.healthStatus} (${aiReport.healthScore}/100)

💰 *Resultados Clave:*
• Ventas: S/ ${totalVentasBrutas.toFixed(2)} (${filteredSales.length} comprobantes)
• Gastos: S/ ${totalGastosBrutos.toFixed(2)} (${filteredExpenses.length} comprobantes)
• Utilidad Estimada: S/ ${utilidadBruta.toFixed(2)} (Margen: ${margenUtilidadPercent.toFixed(1)}%)
• Situación SUNAT: ${aiReport.taxInsight.status} (${aiReport.taxInsight.amountText})

🚀 *Plan de Acción Rápido:*
${aiReport.keyActions.map((a, i) => `${i + 1}. [${a.priority}] *${a.title}:* ${a.description}`).join('\n')}

_Generado automáticamente por el Sistema Contable de ${getCompanyShortName()}_`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Export Consolidated CSV
  const handleExportConsolidatedCsv = () => {
    const headers = "Modulo|Enlace Comprobante Drive|Fecha|Tipo Documento|Serie|Número|RUC DNI|Persona / Empresa|Concepto|Base Imponible|IGV|Total|Detraccion|Neto|Forma Pago";
    
    const salesRows = filteredSales.map(s => [
      'VENTA',
      s.fileUrl || '',
      s.date || '',
      s.type || '',
      s.series || '',
      s.number || '',
      s.clientDocNumber || '',
      `"${(s.clientName || '').replace(/"/g, '""')}"`,
      `"${(s.concept || '').replace(/"/g, '""')}"`,
      (s.base || 0).toFixed(2),
      (s.igv || 0).toFixed(2),
      (s.total || 0).toFixed(2),
      (s.detractionAmount || 0).toFixed(2),
      (s.netPay || s.total || 0).toFixed(2),
      s.paymentMethod || ''
    ].join('|'));

    const expenseRows = filteredExpenses.map(e => [
      `GASTO (${e.expenseCategory || ''})`,
      e.fileUrl || '',
      e.date || '',
      e.type || '',
      e.series || '',
      e.number || '',
      e.supplierDocNumber || '',
      `"${(e.supplierName || '').replace(/"/g, '""')}"`,
      `"${(e.concept || '').replace(/"/g, '""')}"`,
      (e.base || 0).toFixed(2),
      (e.igv || 0).toFixed(2),
      (e.total || 0).toFixed(2),
      (e.detractionAmount || 0).toFixed(2),
      (e.netPay || e.total || 0).toFixed(2),
      e.paymentMethod || ''
    ].join('|'));

    const csv = [headers, ...salesRows, ...expenseRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const compTag = getCompanyShortName().replace(/\s+/g, '_');
    a.download = `Resumen_Consolidado_Ventas_Gastos_${compTag}_${selectedYear}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Quick-Action Preset Chips & Period Control Header */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 sm:p-5 shadow-md space-y-4">
        {/* Top row: Quick Action Preset Chips */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-700/80">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Enfoque Rápido del Informe:
            </span>
            <span className="hidden sm:inline text-xs text-purple-300 font-semibold bg-purple-950/60 border border-purple-800/60 px-2.5 py-0.5 rounded-full">
              {getPeriodLabel()}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => applyPreset('CURRENT_MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activePreset === 'CURRENT_MONTH'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Mes Actual</span>
            </button>

            <button
              onClick={() => applyPreset('PREVIOUS_MONTH')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activePreset === 'PREVIOUS_MONTH'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>Mes Anterior</span>
            </button>

            <button
              onClick={() => applyPreset('LAST_3_MONTHS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activePreset === 'LAST_3_MONTHS'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Últimos 3 Meses</span>
            </button>

            <button
              onClick={() => applyPreset('YTD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activePreset === 'YTD'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <Target className="w-3 h-3 text-sky-400" />
              <span>Acumulado del Año (YTD)</span>
            </button>

            <button
              onClick={() => applyPreset('ALL_TIME')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activePreset === 'ALL_TIME'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                  : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
              }`}
            >
              <span>Histórico Completo</span>
            </button>
          </div>
        </div>

        {/* Bottom row: Detailed Granular Selectors & Action Buttons */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Año:</span>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-semibold"
              >
                <option value="ALL">Todos los Años</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Mes:</span>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500"
              >
                <option value="ALL">Todos los Meses</option>
                {MONTH_NAMES.map((mName, idx) => {
                  const val = (idx + 1) < 10 ? `0${idx + 1}` : `${idx + 1}`;
                  return <option key={val} value={val}>{mName}</option>;
                })}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Desde:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-medium">Hasta:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setActivePreset('CUSTOM');
                }}
                className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Export Buttons & Config */}
          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">

            <button
              onClick={handleExportConsolidatedCsv}
              className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-purple-600 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-purple-300" /> Exportar CSV
            </button>
            <button
              onClick={() => window.print()}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-slate-600 transition"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Ventas */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ventas Totales</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">S/ {totalVentasBrutas.toFixed(2)}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Base: S/ {totalBaseVentas.toFixed(2)} | {filteredSales.length} comprobantes
          </div>
        </div>

        {/* Total Gastos */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gastos Totales</span>
            <ShoppingCart className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 mt-1">S/ {totalGastosBrutos.toFixed(2)}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            Base: S/ {totalBaseGastos.toFixed(2)} | {filteredExpenses.length} comprobantes
          </div>
        </div>

        {/* Utilidad Bruta */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Utilidad Est. / Margen</span>
            <TrendingUp className={`w-4 h-4 ${utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`} />
          </div>
          <div className={`text-2xl font-bold mt-1 ${utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            S/ {utilidadBruta.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Percent className="w-3 h-3 text-purple-400" /> Margen Neto Est: <span className="font-semibold text-white">{margenUtilidadPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Balance IGV SUNAT */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Balance IGV SUNAT</span>
            <Scale className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-bold mt-1 ${igvBalance > 0 ? 'text-amber-400' : 'text-blue-400'}`}>
            S/ {Math.abs(igvBalance).toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {igvBalance > 0 ? (
              <span className="text-amber-400 font-semibold">⚡ IGV a Pagar SUNAT</span>
            ) : (
              <span className="text-blue-400 font-semibold">🛡️ Crédito Fiscal a Favor</span>
            )}
            <span className="text-slate-500 block text-[10px]">Débito (Ventas S/ {totalIgvVentas.toFixed(0)}) - Crédito (Gastos S/ {totalIgvGastos.toFixed(0)})</span>
          </div>
        </div>
      </div>

      {/* Recharts Visual Data Analytics */}
      <div className="space-y-6">
        {/* Monthly Sales Trend Line Chart */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3 shadow-xl">
          <div className="flex flex-wrap justify-between items-center border-b border-slate-700 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Evolución Mensual de Ventas Totales
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Año {selectedYear !== 'ALL' ? selectedYear : 'Histórico'}
                </span>
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total Ventas: <strong className="text-emerald-400">S/ {totalVentasBrutas.toFixed(2)}</strong>
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `S/ ${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, 'Ventas Totales']}
                />
                <Area
                  type="monotone"
                  dataKey="Ventas"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#salesTrendGradient)"
                  name="Ventas Totales"
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 7, fill: '#34d399' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Comparison Bar Chart */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="w-4 h-4 text-purple-400" /> Comparativo Mensual: Ventas vs Gastos (S/)
              </h3>
              <span className="text-xs text-slate-400">Año {selectedYear}</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartMonthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="monthName" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, '']}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} name="Ventas" />
                  <Bar dataKey="Gastos" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Gastos" />
                  <Bar dataKey="Utilidad" fill="#a855f7" radius={[4, 4, 0, 0]} name="Utilidad" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Expense Category Pie Chart */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-sky-400" /> Gastos por Categoría
              </h3>
            </div>

            <div className="h-64 w-full flex items-center justify-center">
              {pieCategoryData.length === 0 ? (
                <p className="text-xs text-slate-500">No hay gastos registrados en este período.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieCategoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(val: any) => [`S/ ${Number(val).toFixed(2)}`, 'Monto']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers & Top Suppliers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
            <Receipt className="w-4 h-4 text-emerald-400" /> Top 5 Clientes en Ventas
          </h3>
          <div className="space-y-2">
            {topClients.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">Sin ventas registradas en el período.</p>
            ) : (
              topClients.map(([clientName, amount], i) => (
                <div key={clientName} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-white font-medium truncate">{clientName}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 whitespace-nowrap">
                    S/ {amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-700 pb-2">
            <ShoppingCart className="w-4 h-4 text-sky-400" /> Top 5 Proveedores en Compras/Gastos
          </h3>
          <div className="space-y-2">
            {topSuppliers.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">Sin gastos registrados en el período.</p>
            ) : (
              topSuppliers.map(([supplierName, amount], i) => (
                <div key={supplierName} className="flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-[10px] shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-white font-medium truncate">{supplierName}</span>
                  </div>
                  <span className="font-mono font-bold text-sky-400 whitespace-nowrap">
                    S/ {amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DETAILED CONSOLIDATED TABLE WITH DRIVE LINKS */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Detalle Consolidado con Enlace Google Drive</span>
                <span className="text-[11px] font-normal text-slate-400">({filteredSales.length + filteredExpenses.length} operaciones)</span>
              </h3>
              <p className="text-[11px] text-slate-400">Auditoría con acceso directo a comprobantes alojados en Google Drive</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setTableTab('all')}
                className={`px-3 py-1 rounded-md font-medium transition ${tableTab === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Todos ({filteredSales.length + filteredExpenses.length})
              </button>
              <button
                onClick={() => setTableTab('sales')}
                className={`px-3 py-1 rounded-md font-medium transition ${tableTab === 'sales' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Ventas ({filteredSales.length})
              </button>
              <button
                onClick={() => setTableTab('expenses')}
                className={`px-3 py-1 rounded-md font-medium transition ${tableTab === 'expenses' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Gastos ({filteredExpenses.length})
              </button>
            </div>

            <button
              onClick={() => setShowDetailedTable(!showDetailedTable)}
              className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
              title={showDetailedTable ? 'Ocultar tabla' : 'Mostrar tabla'}
            >
              {showDetailedTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showDetailedTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/80 border-b border-slate-700">
                <tr>
                  <th className="px-3 py-2.5 whitespace-nowrap">Módulo</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                      <FolderOpen className="w-4 h-4 text-blue-400" />
                      <span>Comprobante Drive</span>
                    </div>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">F. Emisión</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Serie</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Número</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">RUC / DNI</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Razón Social</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Concepto</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Base Imp.</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">IGV</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Total</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Neto</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Forma Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60 font-sans">
                {/* Sales Rows */}
                {(tableTab === 'all' || tableTab === 'sales') &&
                  filteredSales.map((s) => (
                    <tr key={`sale-${s.id}`} className="hover:bg-slate-700/30 transition">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          VENTA
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {s.fileUrl ? (
                          <a
                            href={s.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-blue-900/50 hover:bg-blue-800/80 border border-blue-600/70 text-blue-200 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition group"
                            title={`Abrir archivo en Google Drive: ${s.fileName || 'Comprobante'}\nRuta: ${s.fileDrivePath || 'Ventas'}`}
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />
                            <span>Abrir Comprobante</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 opacity-80 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <a
                            href={getGoogleDriveFolderUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-400 text-[11px] transition"
                            title="Sin comprobante adjunto. Clic para abrir carpeta general de Drive"
                          >
                            <FolderOpen className="w-3 h-3 opacity-60" />
                            <span className="italic">Sin archivo</span>
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{s.date || '-'}</td>
                      <td className="px-3 py-2 text-slate-300">{s.type || '-'}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400 font-semibold whitespace-nowrap">{s.series || '-'}</td>
                      <td className="px-3 py-2 font-mono text-emerald-400 font-semibold whitespace-nowrap">{s.number || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{s.clientDocNumber || '-'}</td>
                      <td className="px-3 py-2 font-semibold text-white truncate max-w-[140px]">{s.clientName || '-'}</td>
                      <td className="px-3 py-2 text-slate-300 truncate max-w-[140px]">{s.concept || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">S/ {(s.base || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-blue-400">S/ {(s.igv || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">S/ {(s.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-white">S/ {(s.netPay || s.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-slate-300">{s.paymentMethod || '-'}</td>
                    </tr>
                  ))}

                {/* Expense Rows */}
                {(tableTab === 'all' || tableTab === 'expenses') &&
                  filteredExpenses.map((e) => (
                    <tr key={`exp-${e.id}`} className="hover:bg-slate-700/30 transition">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          GASTO ({e.expenseCategory?.substring(0, 12) || 'Operativo'}...)
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {e.fileUrl ? (
                          <a
                            href={e.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 bg-blue-900/50 hover:bg-blue-800/80 border border-blue-600/70 text-blue-200 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition group"
                            title={`Abrir archivo en Google Drive: ${e.fileName || 'Comprobante'}\nRuta: ${e.fileDrivePath || 'Gastos'}`}
                          >
                            <FileCheck2 className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />
                            <span>Abrir Comprobante</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 opacity-80 group-hover:opacity-100" />
                          </a>
                        ) : (
                          <a
                            href={getGoogleDriveFolderUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-400 text-[11px] transition"
                            title="Sin comprobante adjunto. Clic para abrir carpeta general de Drive"
                          >
                            <FolderOpen className="w-3 h-3 opacity-60" />
                            <span className="italic">Sin archivo</span>
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{e.date || '-'}</td>
                      <td className="px-3 py-2 text-slate-300">{e.type || '-'}</td>
                      <td className="px-3 py-2 font-mono text-sky-400 font-semibold whitespace-nowrap">{e.series || '-'}</td>
                      <td className="px-3 py-2 font-mono text-sky-400 font-semibold whitespace-nowrap">{e.number || '-'}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{e.supplierDocNumber || '-'}</td>
                      <td className="px-3 py-2 font-semibold text-white truncate max-w-[140px]">{e.supplierName || '-'}</td>
                      <td className="px-3 py-2 text-slate-300 truncate max-w-[140px]">{e.concept || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">S/ {(e.base || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono text-sky-400">S/ {(e.igv || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-red-400">S/ {(e.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-white">S/ {(e.netPay || e.total || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-slate-300">{e.paymentMethod || '-'}</td>
                    </tr>
                  ))}

                {filteredSales.length === 0 && filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={14} className="text-center py-6 text-slate-500">
                      No hay operaciones para el período seleccionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Financial Insight Generator Section */}
      <div className="bg-slate-800 border border-purple-500/40 rounded-xl p-5 sm:p-6 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Sparkles className="w-4 h-4" />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Informe Ejecutivo Financiero con IA
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-200 border border-purple-500/30">
                {getPeriodLabel()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Diagnóstico gerencial y tributario conciso y visual de {getCompanyShortName()} enfocado en: <strong className="text-slate-300">{getPeriodLabel()}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {aiReport && (
              <button
                onClick={handleCopySummary}
                className="flex-1 sm:flex-none bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-slate-600 transition"
                title="Copiar resumen para enviar por WhatsApp o Correo"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-300" />
                    <span>Copiar Resumen</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleGenerateAiReport}
              disabled={isGeneratingAi}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow hover:shadow-purple-500/20"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiReport ? 'Actualizar Informe' : 'Generar Informe Ejecutivo'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isGeneratingAi && (
          <div className="text-center py-10 text-purple-400 space-y-3 bg-slate-900/60 rounded-xl border border-purple-500/20">
            <div className="animate-spin inline-block w-8 h-8 border-3 border-current border-t-transparent rounded-full"></div>
            <p className="text-sm font-semibold text-white">Sintetizando métricas, balance tributario y rentabilidad...</p>
            <p className="text-xs text-slate-400">Generando resumen ejecutivo estructurado y sin exceso de texto.</p>
          </div>
        )}

        {aiReport && !isGeneratingAi && (
          <div className="space-y-5">
            {/* Health Status & Headline Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-purple-950/40 border border-purple-500/30 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    aiReport.healthStatus === 'Excelente' || aiReport.healthStatus === 'Saludable'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : aiReport.healthStatus === 'Atención Requerida'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/30'
                  }`}>
                    {aiReport.healthStatus === 'Excelente' || aiReport.healthStatus === 'Saludable' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    )}
                    <span>Salud Financiera: {aiReport.healthStatus}</span>
                  </span>

                  <span className="text-xs text-slate-400 font-mono">
                    Score: <strong className="text-white">{aiReport.healthScore || (utilidadBruta >= 0 ? 88 : 45)}</strong>/100
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-bold text-white tracking-wide leading-snug">
                  "{aiReport.headline}"
                </h4>
              </div>

              {/* View mode toggle */}
              <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs shrink-0 self-end md:self-auto">
                <button
                  onClick={() => setReportViewMode('cards')}
                  className={`px-3 py-1 rounded-md font-medium transition ${reportViewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Vista Visual
                </button>
                <button
                  onClick={() => setReportViewMode('raw')}
                  className={`px-3 py-1 rounded-md font-medium transition ${reportViewMode === 'raw' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Texto Plano
                </button>
              </div>
            </div>

            {reportViewMode === 'cards' ? (
              <>
                {/* 3 Executive Bento Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Card 1: Rendimiento Comercial */}
                  <div className="bg-slate-900/80 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl p-4 space-y-3 transition flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-400" /> Rendimiento & Margen
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${margenUtilidadPercent >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {margenUtilidadPercent.toFixed(1)}% Margen
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {aiReport.commercialInsight}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Utilidad Est.:</span>
                      <span className={`font-bold ${utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        S/ {utilidadBruta.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Posición Tributaria SUNAT */}
                  <div className="bg-slate-900/80 border border-slate-700/80 hover:border-blue-500/40 rounded-xl p-4 space-y-3 transition flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-blue-400" /> Posición Tributaria SUNAT
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          aiReport.taxInsight.status.toLowerCase().includes('favor') || igvBalance <= 0
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {aiReport.taxInsight.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {aiReport.taxInsight.advice}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Balance IGV:</span>
                      <span className="font-bold text-white">
                        {aiReport.taxInsight.amountText || `S/ ${Math.abs(igvBalance).toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Card 3: Control de Costos */}
                  <div className="bg-slate-900/80 border border-slate-700/80 hover:border-purple-500/40 rounded-xl p-4 space-y-3 transition flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <ShoppingCart className="w-4 h-4 text-purple-400" /> Mayor Gasto & Control
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 truncate max-w-[120px]">
                          {aiReport.costInsight.mainDriver || 'Operación'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {aiReport.costInsight.alert}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-mono">
                      <span className="text-slate-400">Gastos Totales:</span>
                      <span className="font-bold text-sky-400">
                        S/ {totalGastosBrutos.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plan de Acción Rápido: 3 Acciones Concretas */}
                <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" /> Plan de Acción Inmediato (Recomendaciones Clave)
                    </h4>
                    <span className="text-[11px] text-slate-400">Priorizado por impacto</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {aiReport.keyActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-800/80 border border-slate-700 hover:border-slate-600 p-3 rounded-lg space-y-1.5 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-300 text-[10px] flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            {action.title}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            action.priority === 'Inmediata'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : action.priority === 'Alta'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          }`}>
                            {action.priority}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-snug">
                          {action.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900/90 border border-purple-500/30 rounded-xl p-5 text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans">
                {aiReport.rawMarkdown || JSON.stringify(aiReport, null, 2)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
