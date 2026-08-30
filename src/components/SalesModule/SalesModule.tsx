import React, { useState, useMemo } from 'react';
import { SaleItem } from '../../types';
import { analyzeVoucherWithAI, compressFileToBase64, fileToBase64, VoucherAnalysisResult } from '../../utils/aiService';
import { uploadVoucherToGoogleDrive, getGoogleDriveFolderUrl, getGoogleDriveFolderId, getSalesDriveFolderConfig, getCompanyShortName, getAppsScriptUrl, DriveUploadResponse, syncToGoogleSheets } from '../../utils/googleSheetsSync';
import { saveSales, loadExpenses, unmarkDeletedItem } from '../../utils/storage';
import { ConfirmModal } from '../ConfirmModal';
import {
  LayoutDashboard,
  ScanLine,
  PlusCircle,
  Users,
  Search,
  FileSpreadsheet,
  Sparkles,
  UploadCloud,
  CheckCircle,
  CheckCircle2,
  ArrowRight,
  Pencil,
  Trash2,
  Receipt,
  AlertCircle,
  X,
  FolderOpen,
  ExternalLink,
  FileText,
  Calendar,
  FileCheck2,
  Settings2,
  RefreshCw,
  CheckSquare,
  Code2,
  Clock,
  Zap,
  Filter,
  RotateCcw,
  Building2
} from 'lucide-react';

interface SalesModuleProps {
  salesData: SaleItem[];
  setSalesData: React.Dispatch<React.SetStateAction<SaleItem[]>>;
  apiKey: string;
  selectedModel: string;
  onOpenSettings?: (tab?: 'drive' | 'sheets' | 'script') => void;
  onManualSync?: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string;
}

export const SalesModule: React.FC<SalesModuleProps> = ({
  salesData,
  setSalesData,
  apiKey,
  selectedModel,
  onOpenSettings,
  onManualSync,
  isSyncing,
  lastSyncTime
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'scanner' | 'new-sale' | 'customers'>('dashboard');
  
  // Filters
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [yearFilter, setYearFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [hasFileFilter, setHasFileFilter] = useState<'ALL' | 'WITH_FILE' | 'WITHOUT_FILE'>('ALL');

  // Unique clients list for dropdown
  const uniqueClients = useMemo(() => {
    const clients = new Set<string>();
    salesData.forEach((s) => {
      if (s.clientName && s.clientName.trim()) {
        clients.add(s.clientName.trim());
      }
    });
    return Array.from(clients).sort((a, b) => a.localeCompare(b));
  }, [salesData]);

  // Check if any filter is active
  const hasActiveFilters =
    search.trim() !== '' ||
    clientFilter !== 'ALL' ||
    startDate !== '' ||
    endDate !== '' ||
    yearFilter !== 'ALL' ||
    monthFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    hasFileFilter !== 'ALL';

  const handleClearFilters = () => {
    setSearch('');
    setClientFilter('ALL');
    setStartDate('');
    setEndDate('');
    setYearFilter('ALL');
    setMonthFilter('ALL');
    setTypeFilter('ALL');
    setHasFileFilter('ALL');
  };

  // Scanner & Drive Upload states
  const [isScanning, setIsScanning] = useState(false);
  const [isExtractingAI, setIsExtractingAI] = useState(false);
  const [scanningRowId, setScanningRowId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState('');
  const [targetMonthYear, setTargetMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dragActive, setDragActive] = useState(false);
  const [uploadedVoucherState, setUploadedVoucherState] = useState<{
    fileBase64: string;
    mimeType: string;
    fileName: string;
    fileUrl: string;
    folderPath: string;
    extractedData?: VoucherAnalysisResult | null;
  } | null>(null);

  // Form states
  const [editingId, setEditingId] = useState('');
  const [formVoucherType, setFormVoucherType] = useState<'Factura' | 'Boleta' | 'Ticket'>('Factura');
  const [formSeries, setFormSeries] = useState('F001');
  const [formNumber, setFormNumber] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState('');
  const [formDocNumber, setFormDocNumber] = useState('');
  const [formClientName, setFormClientName] = useState('');
  const [formConcept, setFormConcept] = useState('');
  const [formBase, setFormBase] = useState<number | ''>('');
  const [formIgv, setFormIgv] = useState<number | ''>('');
  const [formTotal, setFormTotal] = useState<number | ''>('');
  const [formDetractionRate, setFormDetractionRate] = useState<number | ''>('');
  const [formDetractionAmount, setFormDetractionAmount] = useState<number | ''>('');
  const [formNetPay, setFormNetPay] = useState<number | ''>('');
  const [formCost, setFormCost] = useState<number | ''>('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('Contado');
  const [formFileUrl, setFormFileUrl] = useState<string>('');
  const [formFileName, setFormFileName] = useState<string>('');
  const [formFileDrivePath, setFormFileDrivePath] = useState<string>('');
  const [isFormFileUploading, setIsFormFileUploading] = useState(false);

  // Selection & Deletion states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiSuccess, setUiSuccess] = useState<string | null>(null);

  // Calculations
  const handleBaseChange = (val: number) => {
    setFormBase(val);
    const igv = val * 0.18;
    const total = val + igv;
    setFormIgv(Number(igv.toFixed(2)));
    setFormTotal(Number(total.toFixed(2)));
    recalcDetraction(total, Number(formDetractionRate) || 0);
  };

  const handleIgvChange = (val: number) => {
    setFormIgv(val);
    const base = Number(formBase) || 0;
    const total = base + val;
    setFormTotal(Number(total.toFixed(2)));
    recalcDetraction(total, Number(formDetractionRate) || 0);
  };

  const handleTotalChange = (val: number) => {
    setFormTotal(val);
    const base = val / 1.18;
    const igv = val - base;
    setFormBase(Number(base.toFixed(2)));
    setFormIgv(Number(igv.toFixed(2)));
    recalcDetraction(val, Number(formDetractionRate) || 0);
  };

  const handleDetractionRateChange = (rate: number) => {
    setFormDetractionRate(rate);
    const total = Number(formTotal) || 0;
    recalcDetraction(total, rate);
  };

  const recalcDetraction = (tot: number, rate: number) => {
    const detAmt = tot * (rate / 100);
    const net = tot - detAmt;
    setFormDetractionAmount(detAmt > 0 ? Number(detAmt.toFixed(2)) : 0);
    setFormNetPay(net > 0 ? Number(net.toFixed(2)) : tot);
  };

  // Filtered dataset
  const filteredSales = salesData.filter((item) => {
    const searchLower = search.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (item.clientName || '').toLowerCase().includes(searchLower) ||
      (item.clientDocNumber || '').includes(searchLower) ||
      (item.series || '').toLowerCase().includes(searchLower) ||
      (item.number || '').includes(searchLower) ||
      (item.concept || '').toLowerCase().includes(searchLower) ||
      (item.fileName || '').toLowerCase().includes(searchLower);

    const itemYear = item.date ? item.date.substring(0, 4) : '';
    const itemMonth = item.date ? item.date.substring(5, 7) : '';

    const matchesYear = yearFilter === 'ALL' || itemYear === yearFilter;
    const matchesMonth = monthFilter === 'ALL' || itemMonth === monthFilter;
    const matchesType = typeFilter === 'ALL' || item.type === typeFilter;
    const matchesClient = clientFilter === 'ALL' || (item.clientName || '').trim().toLowerCase() === clientFilter.trim().toLowerCase();

    const itemDate = item.date || '';
    const matchesStartDate = !startDate || (itemDate && itemDate >= startDate);
    const matchesEndDate = !endDate || (itemDate && itemDate <= endDate);

    const matchesFile =
      hasFileFilter === 'ALL' ||
      (hasFileFilter === 'WITH_FILE' && !!item.fileUrl) ||
      (hasFileFilter === 'WITHOUT_FILE' && !item.fileUrl);

    return matchesSearch && matchesYear && matchesMonth && matchesType && matchesClient && matchesStartDate && matchesEndDate && matchesFile;
  });

  // Aggregates
  const totalVentas = filteredSales.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalIgv = filteredSales.reduce((acc, curr) => acc + (curr.igv || 0), 0);
  const totalNet = filteredSales.reduce((acc, curr) => acc + (curr.netPay || curr.total || 0), 0);
  const totalDetraction = filteredSales.reduce((acc, curr) => acc + (curr.detractionAmount || 0), 0);
  const countWithDriveFile = filteredSales.filter(s => !!s.fileUrl).length;

  // Form Save
  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    const saleObject: SaleItem = {
      id: editingId || Date.now().toString(),
      date: formDate || new Date().toISOString().split('T')[0],
      dueDate: formDueDate || '',
      clientName: formClientName.trim() || 'CLIENTE VARIOS',
      clientDocNumber: formDocNumber.trim() || '00000000',
      type: formVoucherType,
      series: formSeries.trim().toUpperCase() || 'F001',
      number: formNumber.trim() || '0000001',
      concept: formConcept.trim() || 'Venta de mercadería',
      base: Number(formBase) || 0,
      igv: Number(formIgv) || 0,
      total: Number(formTotal) || 0,
      detractionRate: Number(formDetractionRate) || 0,
      detractionAmount: Number(formDetractionAmount) || 0,
      netPay: Number(formNetPay) || Number(formTotal) || 0,
      cost: Number(formCost) || 0,
      paymentMethod: formPaymentMethod,
      fileUrl: formFileUrl || undefined,
      fileName: formFileName || undefined,
      fileDrivePath: formFileDrivePath || undefined,
    };

    const updatedSales = editingId
      ? salesData.map(s => s.id === editingId ? saleObject : s)
      : [{ ...saleObject, createdAt: Date.now() }, ...salesData];

    unmarkDeletedItem(saleObject);
    saveSales(updatedSales);
    setSalesData(updatedSales);

    try {
      window.dispatchEvent(new CustomEvent('app-item-added', { detail: { item: saleObject, allSales: updatedSales, allExpenses: loadExpenses() } }));
    } catch (e) {}

    resetForm();
    setActiveTab('dashboard');
  };

  const handleEdit = (item: SaleItem) => {
    setEditingId(item.id);
    setFormVoucherType(item.type as any || 'Factura');
    setFormSeries(item.series || 'F001');
    setFormNumber(item.number || '');
    setFormDate(item.date || new Date().toISOString().split('T')[0]);
    setFormDueDate(item.dueDate || '');
    setFormDocNumber(item.clientDocNumber || '');
    setFormClientName(item.clientName || '');
    setFormConcept(item.concept || '');
    setFormBase(item.base || '');
    setFormIgv(item.igv || '');
    setFormTotal(item.total || '');
    setFormDetractionRate(item.detractionRate || '');
    setFormDetractionAmount(item.detractionAmount || '');
    setFormNetPay(item.netPay || '');
    setFormCost(item.cost || '');
    setFormPaymentMethod(item.paymentMethod || 'Contado');
    setFormFileUrl(item.fileUrl || '');
    setFormFileName(item.fileName || '');
    setFormFileDrivePath(item.fileDrivePath || '');

    setActiveTab('new-sale');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredSales.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredSales.map(s => s.id));
  };

  const handleDelete = (id: string) => {
    const itemToDelete = salesData.find(s => s.id === id);
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar comprobante de venta',
      message: '¿Deseas eliminar este registro de venta? Esta acción se sincronizará inmediatamente con Google Sheets.',
      onConfirm: () => {
        const updatedSales = salesData.filter(s => s.id !== id);
        saveSales(updatedSales);
        setSalesData(updatedSales);
        setSelectedIds(prev => prev.filter(i => i !== id));
        try {
          window.dispatchEvent(new CustomEvent('app-item-deleted', { detail: { id, item: itemToDelete, allSales: updatedSales, allExpenses: loadExpenses() } }));
        } catch (e) {}
        setUiSuccess('Comprobante de venta eliminado y sincronizado.');
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const itemsToDelete = salesData.filter(s => selectedIds.includes(s.id));
    setConfirmModal({
      isOpen: true,
      title: `Eliminar ${count} comprobante${count > 1 ? 's' : ''} de venta`,
      message: `¿Estás seguro de eliminar los ${count} comprobantes de venta seleccionados? Esta acción limpiará los registros y se sincronizará inmediatamente con Google Sheets.`,
      onConfirm: () => {
        const updatedSales = salesData.filter(s => !selectedIds.includes(s.id));
        saveSales(updatedSales);
        setSalesData(updatedSales);
        setSelectedIds([]);
        try {
          window.dispatchEvent(new CustomEvent('app-item-deleted', { detail: { ids: selectedIds, items: itemsToDelete, allSales: updatedSales, allExpenses: loadExpenses() } }));
        } catch (e) {}
        setUiSuccess(`Se eliminaron exitosamente ${count} comprobante${count > 1 ? 's' : ''} de venta.`);
      }
    });
  };

  const handleExportSelectedCsv = () => {
    if (selectedIds.length === 0) return;
    const selectedItems = filteredSales.filter(s => selectedIds.includes(s.id));
    const headers = "Fecha de Emisión|Fecha Vencimiento|Cliente|RUC - DNI|Tipo Documento|Serie|Número|Concepto|Base Imponible|IGV|Total|Tasa Detracción %|Monto Detracción|Neto a Cobrar|Costo de Venta|Forma de Cobro|Enlace Comprobante Drive";
    const rows = selectedItems.map(s => [
      s.date || '',
      s.dueDate || '',
      `"${(s.clientName || '').replace(/"/g, '""')}"`,
      s.clientDocNumber || '',
      s.type || '',
      s.series || '',
      s.number || '',
      `"${(s.concept || '').replace(/"/g, '""')}"`,
      s.base ? s.base.toFixed(2) : '0.00',
      s.igv ? s.igv.toFixed(2) : '0.00',
      s.total ? s.total.toFixed(2) : '0.00',
      s.detractionRate ? s.detractionRate : '0',
      s.detractionAmount ? s.detractionAmount.toFixed(2) : '0.00',
      s.netPay ? s.netPay.toFixed(2) : '0.00',
      s.cost ? s.cost.toFixed(2) : '0.00',
      s.paymentMethod || '',
      s.fileUrl || ''
    ].join('|'));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const compTag = getCompanyShortName().replace(/\s+/g, '_');
    a.download = `Ventas_Seleccionadas_${selectedItems.length}_${compTag}_${Date.now()}.csv`;
    a.click();
  };

  const resetForm = () => {
    setEditingId('');
    setFormVoucherType('Factura');
    setFormSeries('F001');
    setFormNumber('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDueDate('');
    setFormDocNumber('');
    setFormClientName('');
    setFormConcept('');
    setFormBase('');
    setFormIgv('');
    setFormTotal('');
    setFormDetractionRate('');
    setFormDetractionAmount('');
    setFormNetPay('');
    setFormCost('');
    setFormPaymentMethod('Contado');
    setFormFileUrl('');
    setFormFileName('');
    setFormFileDrivePath('');
  };

  // 1. SUBIDA INICIAL DEL COMPROBANTE A GOOGLE DRIVE
  const processFileUpload = async (file: File, chosenMonthYear?: string) => {
    setIsScanning(true);
    setUiError(null);
    setUiSuccess(null);
    setUploadedVoucherState(null);

    const monthYearToUse = chosenMonthYear || targetMonthYear || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    try {
      setScanStatus(`☁️ Subiendo comprobante a Google Drive (Ventas / ${monthYearToUse})...`);
      const compressed = await compressFileToBase64(file, 800, 0.60);
      const salesDriveConfig = getSalesDriveFolderConfig();

      const driveRes = await uploadVoucherToGoogleDrive({
        fileBase64: compressed.base64,
        fileName: file.name,
        mimeType: compressed.mimeType || file.type || 'image/jpeg',
        folderType: 'Ventas',
        monthYear: monthYearToUse,
        parentFolderId: salesDriveConfig.effectiveId
      }).catch((err): DriveUploadResponse => {
        console.warn('Drive upload error:', err);
        return { success: false, error: err?.message };
      });

      const fileUrl = (driveRes && driveRes.success && driveRes.fileUrl) ? driveRes.fileUrl : '';
      const fileName = (driveRes && driveRes.fileName) || file.name;
      const folderPath = (driveRes && driveRes.folderPath) || `Ventas / ${monthYearToUse}`;

      setUploadedVoucherState({
        fileBase64: compressed.base64,
        mimeType: compressed.mimeType || file.type || 'image/jpeg',
        fileName,
        fileUrl,
        folderPath,
        extractedData: null
      });

      setUiSuccess(`✅ Comprobante guardado en Google Drive en "${folderPath}". Elige si deseas extraer los datos ahora con IA o guardarlo en la tabla para extraerlos más tarde.`);
    } catch (err: any) {
      setUiError(`Error al subir comprobante a Google Drive: ${err.message || err}`);
    } finally {
      setIsScanning(false);
    }
  };

  // REGISTRO DIRECTO EN 1 CLIC DESDE LOS DATOS EXTRAÍDOS POR IA
  const handleDirectRegisterSale = (customRes?: VoucherAnalysisResult) => {
    if (!uploadedVoucherState) return;
    const res = customRes || uploadedVoucherState.extractedData;
    if (!res) {
      handleExtractAndRegisterAI();
      return;
    }

    const totalCalculated = res.totalAmount !== undefined ? res.totalAmount : 0;
    const baseCalculated = res.baseAmount !== undefined ? res.baseAmount : (totalCalculated > 0 ? parseFloat((totalCalculated / 1.18).toFixed(2)) : 0);
    const igvCalculated = res.igvAmount !== undefined ? res.igvAmount : (totalCalculated > 0 ? parseFloat((totalCalculated - baseCalculated).toFixed(2)) : 0);
    const detractionAmt = res.detractionAmount !== undefined ? res.detractionAmount : (res.detractionRate ? parseFloat(((totalCalculated * res.detractionRate) / 100).toFixed(2)) : 0);
    const netPayCalculated = res.netPay !== undefined ? res.netPay : (totalCalculated - detractionAmt);

    const seriesStr = (res.series || 'F001').toUpperCase().trim();
    const numberStr = (res.number || '000001').trim();

    const newSale: SaleItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      date: res.date || new Date().toISOString().split('T')[0],
      dueDate: res.dueDate || '',
      clientName: (res.clientName || 'CLIENTE VARIOS').trim(),
      clientDocNumber: (res.clientDocNumber || '00000000').trim(),
      type: (res.type as any) || 'Factura',
      series: seriesStr,
      number: numberStr,
      concept: (res.concept || uploadedVoucherState.fileName || 'Venta de mercadería').trim(),
      base: baseCalculated,
      igv: igvCalculated,
      total: totalCalculated,
      detractionRate: res.detractionRate || 0,
      detractionAmount: detractionAmt,
      netPay: netPayCalculated,
      cost: 0,
      paymentMethod: res.paymentMethod || 'Contado',
      fileUrl: uploadedVoucherState.fileUrl || undefined,
      fileName: uploadedVoucherState.fileName || undefined,
      fileDrivePath: uploadedVoucherState.folderPath || undefined,
      isPendingScan: false,
      createdAt: Date.now()
    };

    const updatedSales = [newSale, ...salesData];
    unmarkDeletedItem(newSale);
    saveSales(updatedSales);
    setSalesData(updatedSales);
    try {
      window.dispatchEvent(new CustomEvent('app-item-added', { detail: { item: newSale, allSales: updatedSales, allExpenses: loadExpenses() } }));
    } catch (e) {}

    setUploadedVoucherState(null);
    setUiSuccess(`✅ ¡Comprobante ${newSale.type} ${newSale.series}-${newSale.number} (Total S/ ${newSale.total.toFixed(2)}) guardado y registrado en la tabla con respaldo en Google Drive!`);
    setActiveTab('dashboard');
  };

  // 2. EXTRACCIÓN CON IA Y ASIGNACIÓN A COLUMNAS DEL FORMULARIO
  const handleExtractAndRegisterAI = async () => {
    if (!uploadedVoucherState) return;
    setIsExtractingAI(true);
    setUiError(null);
    setUiSuccess(null);

    try {
      const aiRes = await analyzeVoucherWithAI(
        { base64: uploadedVoucherState.fileBase64, mimeType: uploadedVoucherState.mimeType },
        'sale',
        apiKey,
        selectedModel
      );

      resetForm();

      if (uploadedVoucherState.fileUrl) {
        setFormFileUrl(uploadedVoucherState.fileUrl);
        setFormFileName(uploadedVoucherState.fileName);
        setFormFileDrivePath(uploadedVoucherState.folderPath);
      }

      if (aiRes) {
        setUploadedVoucherState(prev => prev ? { ...prev, extractedData: aiRes } : null);

        if (aiRes.date) setFormDate(aiRes.date);
        if (aiRes.dueDate) setFormDueDate(aiRes.dueDate);
        if (aiRes.clientName) setFormClientName(aiRes.clientName);
        if (aiRes.clientDocNumber) setFormDocNumber(aiRes.clientDocNumber);
        if (aiRes.type) setFormVoucherType(aiRes.type as any || 'Factura');
        if (aiRes.series) setFormSeries(aiRes.series);
        if (aiRes.number) setFormNumber(aiRes.number);
        if (aiRes.concept) setFormConcept(aiRes.concept);
        if (aiRes.baseAmount) setFormBase(aiRes.baseAmount);
        if (aiRes.igvAmount) setFormIgv(aiRes.igvAmount);
        if (aiRes.totalAmount) setFormTotal(aiRes.totalAmount);
        if (aiRes.detractionRate) setFormDetractionRate(aiRes.detractionRate);
        if (aiRes.detractionAmount) setFormDetractionAmount(aiRes.detractionAmount);
        if (aiRes.netPay) setFormNetPay(aiRes.netPay);
        if (aiRes.paymentMethod) setFormPaymentMethod(aiRes.paymentMethod);

        if (aiRes.totalAmount && !aiRes.baseAmount) {
          handleTotalChange(aiRes.totalAmount);
        }

        setUiSuccess(`✅ Datos del comprobante extraídos con IA. Puedes registrarlo directamente o revisarlo en el formulario.`);
      } else {
        setUiSuccess(`✅ Enlace de Google Drive vinculado. Completa los datos en el formulario.`);
      }
    } catch (err: any) {
      setUiError(`Error al leer datos con IA: ${err.message || err}`);
    } finally {
      setIsExtractingAI(false);
    }
  };

  // REVISAR EN FORMULARIO MANUALMENTE
  const handleReviewInForm = () => {
    if (!uploadedVoucherState) return;
    resetForm();
    if (uploadedVoucherState.fileUrl) {
      setFormFileUrl(uploadedVoucherState.fileUrl);
      setFormFileName(uploadedVoucherState.fileName);
      setFormFileDrivePath(uploadedVoucherState.folderPath);
    }

    const aiRes = uploadedVoucherState.extractedData;
    if (aiRes) {
      if (aiRes.date) setFormDate(aiRes.date);
      if (aiRes.dueDate) setFormDueDate(aiRes.dueDate);
      if (aiRes.clientName) setFormClientName(aiRes.clientName);
      if (aiRes.clientDocNumber) setFormDocNumber(aiRes.clientDocNumber);
      if (aiRes.type) setFormVoucherType(aiRes.type as any || 'Factura');
      if (aiRes.series) setFormSeries(aiRes.series);
      if (aiRes.number) setFormNumber(aiRes.number);
      if (aiRes.concept) setFormConcept(aiRes.concept);
      if (aiRes.baseAmount) setFormBase(aiRes.baseAmount);
      if (aiRes.igvAmount) setFormIgv(aiRes.igvAmount);
      if (aiRes.totalAmount) setFormTotal(aiRes.totalAmount);
      if (aiRes.detractionRate) setFormDetractionRate(aiRes.detractionRate);
      if (aiRes.detractionAmount) setFormDetractionAmount(aiRes.detractionAmount);
      if (aiRes.netPay) setFormNetPay(aiRes.netPay);
      if (aiRes.paymentMethod) setFormPaymentMethod(aiRes.paymentMethod);
    }

    setUploadedVoucherState(null);
    setActiveTab('new-sale');
  };

  // REGISTRO MANUAL CON EL ENLACE DE DRIVE VINCULADO
  const handleRegisterManualWithVoucher = () => {
    if (!uploadedVoucherState) return;
    resetForm();
    if (uploadedVoucherState.fileUrl) {
      setFormFileUrl(uploadedVoucherState.fileUrl);
      setFormFileName(uploadedVoucherState.fileName);
      setFormFileDrivePath(uploadedVoucherState.folderPath);
    }
    setUploadedVoucherState(null);
    setActiveTab('new-sale');
  };

  // 3. OPCIÓN: ESCANEAR MÁS TARDE (Guarda fila vacía en el reporte con el enlace Drive vinculado)
  const handleSaveForLater = () => {
    if (!uploadedVoucherState) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = targetMonthYear ? `${targetMonthYear}-01` : todayStr;

    const pendingSale: SaleItem = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      date: targetDate,
      dueDate: '',
      clientName: '⚠️ PENDIENTE DE ESCANEO',
      clientDocNumber: '-',
      type: 'Factura',
      series: '-',
      number: '-',
      concept: `[POR ESCANEAR] ${uploadedVoucherState.fileName}`,
      base: 0,
      igv: 0,
      total: 0,
      detractionRate: 0,
      detractionAmount: 0,
      netPay: 0,
      cost: 0,
      paymentMethod: '-',
      fileUrl: uploadedVoucherState.fileUrl,
      fileName: uploadedVoucherState.fileName,
      fileDrivePath: uploadedVoucherState.folderPath,
      isPendingScan: true,
      storedBase64: uploadedVoucherState.fileBase64,
      storedMimeType: uploadedVoucherState.mimeType,
      createdAt: Date.now()
    };

    const updatedList = [pendingSale, ...salesData];
    unmarkDeletedItem(pendingSale);
    saveSales(updatedList);
    setSalesData(updatedList);
    try {
      window.dispatchEvent(new CustomEvent('app-item-added', { detail: { item: pendingSale, allSales: updatedList, allExpenses: loadExpenses() } }));
    } catch (e) {}

    setUiSuccess(`✅ Comprobante alojado en Google Drive y registrado en la tabla. Las demás columnas quedan en blanco como pendiente. Haz clic en "⚡ Extraer datos con IA" en esa misma fila cuando desees.`);
    setUploadedVoucherState(null);
    setActiveTab('dashboard');
  };

  // 4. ESCANEO POSTERIOR DESDE LA TABLA (Para registros pendientes o re-escaneo desde Drive)
  const handleScanPendingSale = async (item: SaleItem) => {
    setScanningRowId(item.id);
    setUiError(null);
    setUiSuccess(null);

    try {
      if (!item.storedBase64 && !item.fileUrl) {
        setUiError(`Este registro no tiene comprobante adjunto ni enlace de Google Drive.`);
        setScanningRowId(null);
        return;
      }

      const aiRes = await analyzeVoucherWithAI(
        {
          base64: item.storedBase64,
          mimeType: item.storedMimeType,
          fileUrl: item.fileUrl,
          fileName: item.fileName
        },
        'sale',
        apiKey,
        selectedModel,
        getAppsScriptUrl()
      );

      if (!aiRes) {
        throw new Error('No se pudieron extraer datos del comprobante.');
      }

      const totalCalculated = aiRes.totalAmount !== undefined ? aiRes.totalAmount : (item.total || 0);
      const baseCalculated = aiRes.baseAmount !== undefined ? aiRes.baseAmount : (totalCalculated > 0 ? parseFloat((totalCalculated / 1.18).toFixed(2)) : 0);
      const igvCalculated = aiRes.igvAmount !== undefined ? aiRes.igvAmount : (totalCalculated > 0 ? parseFloat((totalCalculated - baseCalculated).toFixed(2)) : 0);
      const detractionAmt = aiRes.detractionAmount !== undefined ? aiRes.detractionAmount : (aiRes.detractionRate ? parseFloat(((totalCalculated * aiRes.detractionRate) / 100).toFixed(2)) : 0);
      const netPayCalculated = aiRes.netPay !== undefined ? aiRes.netPay : (totalCalculated - detractionAmt);

      const updatedSale: SaleItem = {
        ...item,
        date: aiRes.date || item.date || new Date().toISOString().split('T')[0],
        dueDate: aiRes.dueDate || item.dueDate || '',
        clientName: aiRes.clientName || item.clientName || 'Cliente No Identificado',
        clientDocNumber: aiRes.clientDocNumber || item.clientDocNumber || '-',
        type: (aiRes.type as any) || item.type || 'Factura',
        series: (aiRes.series || item.series || '-').toUpperCase().trim(),
        number: aiRes.number || item.number || '-',
        concept: aiRes.concept || item.concept || item.fileName || 'Venta de mercadería',
        base: baseCalculated,
        igv: igvCalculated,
        total: totalCalculated,
        detractionRate: aiRes.detractionRate || 0,
        detractionAmount: detractionAmt,
        netPay: netPayCalculated,
        cost: item.cost || 0,
        paymentMethod: aiRes.paymentMethod || item.paymentMethod || 'Contado',
        isPendingScan: false,
        storedBase64: undefined,
        storedMimeType: undefined
      };

      const updatedList = salesData.map(s => s.id === item.id ? updatedSale : s);
      unmarkDeletedItem(updatedSale);
      saveSales(updatedList);
      setSalesData(updatedList);
      try {
        window.dispatchEvent(new CustomEvent('app-item-added', { detail: { item: updatedSale, allSales: updatedList, allExpenses: loadExpenses() } }));
      } catch (e) {}
      setUiSuccess(`✨ ¡Comprobante leído con éxito desde el enlace de Drive! Se actualizaron todas las columnas: RUC ${updatedSale.clientDocNumber}, Cliente "${updatedSale.clientName}", ${updatedSale.type} ${updatedSale.series}-${updatedSale.number}, Fecha ${updatedSale.date}, Base S/ ${baseCalculated.toFixed(2)}, IGV S/ ${igvCalculated.toFixed(2)}, Total S/ ${totalCalculated.toFixed(2)}${detractionAmt > 0 ? `, Detracción S/ ${detractionAmt.toFixed(2)}` : ''}.`);
    } catch (err: any) {
      console.error('Error al leer comprobante con IA:', err);
      setUiError(`Error al leer comprobante desde Google Drive: ${err.message || err}`);
    } finally {
      setScanningRowId(null);
    }
  };

  // Upload file directly from New Sale form
  const handleFormFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFormFileUploading(true);
    const dateObj = formDate ? new Date(formDate) : new Date();
    const monthYear = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

    try {
      const { base64, mimeType } = await compressFileToBase64(file, 900, 0.65);
      const salesDriveConfig = getSalesDriveFolderConfig();
      const driveRes = await uploadVoucherToGoogleDrive({
        fileBase64: base64,
        fileName: file.name,
        mimeType: mimeType || file.type,
        folderType: 'Ventas',
        monthYear,
        parentFolderId: salesDriveConfig.effectiveId
      });

      if (driveRes.success && driveRes.fileUrl) {
        setFormFileUrl(driveRes.fileUrl);
        setFormFileName(driveRes.fileName || file.name);
        setFormFileDrivePath(driveRes.folderPath || `Ventas / ${monthYear}`);
        setUiSuccess(`✅ Archivo adjunto guardado en Google Drive (${driveRes.folderPath || `Ventas / ${monthYear}`})`);
      } else {
        setUiError(driveRes.error || 'No se pudo guardar el archivo en Google Drive');
      }
    } catch (err: any) {
      setUiError(`Error al subir archivo: ${err.message}`);
    } finally {
      setIsFormFileUploading(false);
      e.target.value = '';
    }
  };

  // Handle Drag & Drop in Scanner Tab
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileUpload(e.dataTransfer.files[0]);
    }
  };

  // Customers Summary
  const customersMap: Record<string, { name: string; count: number; total: number }> = {};
  salesData.forEach(s => {
    const docKey = s.clientDocNumber || 'SIN_DOC';
    if (!customersMap[docKey]) {
      customersMap[docKey] = { name: s.clientName || 'Cliente No Identificado', count: 0, total: 0 };
    }
    customersMap[docKey].count++;
    customersMap[docKey].total += (s.total || 0);
  });

  // CSV Export
  const exportToExcelCsv = () => {
    const headers = "Fecha de Emisión|Fecha Vencimiento|Cliente|RUC - DNI|Tipo Documento|Serie|Número|Concepto|Base Imponible|IGV|Total|Tasa Detracción %|Monto Detracción|Neto a Cobrar|Costo de Venta|Forma de Cobro|Enlace Comprobante Drive";
    const rows = filteredSales.map(s => [
      s.date || '',
      s.dueDate || '',
      `"${(s.clientName || '').replace(/"/g, '""')}"`,
      s.clientDocNumber || '',
      s.type || '',
      s.series || '',
      s.number || '',
      `"${(s.concept || '').replace(/"/g, '""')}"`,
      s.base ? s.base.toFixed(2) : '0.00',
      s.igv ? s.igv.toFixed(2) : '0.00',
      s.total ? s.total.toFixed(2) : '0.00',
      s.detractionRate ? s.detractionRate : '0',
      s.detractionAmount ? s.detractionAmount.toFixed(2) : '0.00',
      s.netPay ? s.netPay.toFixed(2) : '0.00',
      s.cost ? s.cost.toFixed(2) : '0.00',
      s.paymentMethod || '',
      s.fileUrl || ''
    ].join('|'));

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const compTag = getCompanyShortName().replace(/\s+/g, '_');
    a.download = `Reporte_Ventas_${compTag}_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Feedback Messages */}
      {uiError && (
        <div className="bg-red-900/80 border border-red-700 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{uiError}</span>
          </div>
          <button
            onClick={() => setUiError(null)}
            className="text-red-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {uiSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl flex items-center justify-between text-xs font-medium animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{uiSuccess}</span>
          </div>
          <button
            onClick={() => setUiSuccess(null)}
            className="text-emerald-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub Tabs Navigation */}
      <div className="flex space-x-1.5 sm:space-x-4 border-b border-slate-700 pb-2 overflow-x-auto scrollbar-none touch-manipulation">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition touch-manipulation ${
            activeTab === 'dashboard'
              ? 'bg-emerald-500 text-slate-900 font-bold shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Reporte de Ventas</span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition touch-manipulation ${
            activeTab === 'scanner'
              ? 'bg-emerald-500 text-slate-900 font-bold shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <ScanLine className="w-4 h-4 shrink-0" />
          <span>Subir Drive & IA</span>
        </button>

        <button
          onClick={() => { resetForm(); setActiveTab('new-sale'); }}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition touch-manipulation ${
            activeTab === 'new-sale'
              ? 'bg-emerald-500 text-slate-900 font-bold shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span>{editingId ? 'Editando Venta' : 'Nueva Venta'}</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition touch-manipulation ${
            activeTab === 'customers'
              ? 'bg-emerald-500 text-slate-900 font-bold shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Clientes</span>
        </button>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition shadow-sm ${
                isSyncing
                  ? 'bg-amber-950/80 border-amber-600/80 text-amber-300 animate-pulse'
                  : 'text-emerald-300 hover:text-white bg-slate-800 border-slate-700 hover:bg-slate-700'
              }`}
              title="Sincronizar ahora con Google Sheets (Descarga cambios y sube comprobantes)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Sheets'}</span>
            </button>
          )}



          <a
            href={getSalesDriveFolderConfig().folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-slate-300 hover:text-white bg-slate-800 border border-slate-700 hover:bg-slate-700 transition"
            title="Abrir Carpeta de Ventas en Google Drive"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Carpeta Ventas</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* TAB 1: DASHBOARD / REPORT */}
      {activeTab === 'dashboard' && (
        <section className="space-y-4">
          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Total Facturado</span>
              <p className="text-xl font-extrabold text-emerald-400 font-mono mt-0.5">S/ {totalVentas.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400">{filteredSales.length} comprobantes</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">IGV Fiscal (18%)</span>
              <p className="text-xl font-extrabold text-blue-400 font-mono mt-0.5">S/ {totalIgv.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400">Débito Fiscal</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Detracciones Retenidas</span>
              <p className="text-xl font-extrabold text-purple-400 font-mono mt-0.5">S/ {totalDetraction.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400">Cta. BN SPOT</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Neto a Cobrar</span>
              <p className="text-xl font-extrabold text-white font-mono mt-0.5">S/ {totalNet.toFixed(2)}</p>
              <span className="text-[10px] text-slate-400">Efectivo / Bancos</span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 p-3.5 rounded-xl">
              <span className="text-[11px] text-slate-400 uppercase font-semibold">Comprobantes en Drive</span>
              <p className="text-xl font-extrabold text-blue-300 font-mono mt-0.5">{countWithDriveFile} / {filteredSales.length}</p>
              <span className="text-[10px] text-blue-400 flex items-center gap-1">
                <FolderOpen className="w-3 h-3" /> Carpeta Ventas
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-800/90 border border-slate-700/90 rounded-2xl p-4 space-y-3.5 shadow-md">
            {/* Top Row: Search & Export */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, RUC, serie, número, concepto o archivo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white p-0.5 rounded-md hover:bg-slate-800 transition"
                    title="Limpiar búsqueda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="px-3 py-2 bg-slate-700/80 hover:bg-slate-700 text-rose-300 hover:text-rose-200 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    title="Restablecer todos los filtros aplicados"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>Limpiar Filtros</span>
                  </button>
                )}

                <button
                  onClick={exportToExcelCsv}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-600 transition shadow-sm"
                  title="Exportar registros filtrados a CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Bottom Row: Detailed Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-700/60">
              {/* Filter 1: Cliente */}
              <div className="space-y-1 lg:col-span-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3 text-emerald-400" />
                  Cliente
                </label>
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">👥 Todos los Clientes ({uniqueClients.length})</option>
                  {uniqueClients.map((client) => (
                    <option key={client} value={client}>
                      {client}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 2: Tipo de Comprobante */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Receipt className="w-3 h-3 text-emerald-400" />
                  Comprobante
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">📄 Todos los Tipos</option>
                  <option value="Factura">Factura</option>
                  <option value="Boleta">Boleta</option>
                  <option value="Ticket">Ticket</option>
                  <option value="Nota de Crédito">Nota de Crédito</option>
                  <option value="Nota de Débito">Nota de Débito</option>
                </select>
              </div>

              {/* Filter 3: Año / Mes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  Periodo (Mes/Año)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">Año: Todos</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>

                  <select
                    value={monthFilter}
                    onChange={(e) => setMonthFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">Mes: Todos</option>
                    <option value="01">Ene</option>
                    <option value="02">Feb</option>
                    <option value="03">Mar</option>
                    <option value="04">Abr</option>
                    <option value="05">May</option>
                    <option value="06">Jun</option>
                    <option value="07">Jul</option>
                    <option value="08">Ago</option>
                    <option value="09">Set</option>
                    <option value="10">Oct</option>
                    <option value="11">Nov</option>
                    <option value="12">Dic</option>
                  </select>
                </div>
              </div>

              {/* Filter 4: Rango de Fecha (Desde / Hasta) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400" />
                  Rango Fechas
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    title="Fecha Desde"
                    placeholder="Desde"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    title="Fecha Hasta"
                    placeholder="Hasta"
                  />
                </div>
              </div>

              {/* Filter 5: Estado Comprobante Drive */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <FolderOpen className="w-3 h-3 text-blue-400" />
                  Archivo Drive
                </label>
                <select
                  value={hasFileFilter}
                  onChange={(e) => setHasFileFilter(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">📁 Todos</option>
                  <option value="WITH_FILE">🟢 Con Archivo</option>
                  <option value="WITHOUT_FILE">⚠️ Sin Archivo</option>
                </select>
              </div>
            </div>

            {/* Results Counter Bar */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-white">
                  Mostrando <span className="text-emerald-400 font-bold">{filteredSales.length}</span> de <span className="text-slate-300">{salesData.length}</span> comprobantes
                </span>
                {hasActiveFilters && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                    Filtros activos
                  </span>
                )}
              </div>
              {filteredSales.length === 0 && (
                <span className="text-amber-400 text-xs">
                  No se encontraron ventas con los filtros seleccionados.
                </span>
              )}
            </div>
          </div>

          {/* Bulk Selection Action Toolbar */}
          {selectedIds.length > 0 && (
            <div className="bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border border-emerald-500/50 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {selectedIds.length} comprobante{selectedIds.length > 1 ? 's' : ''} seleccionado{selectedIds.length > 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      {selectedIds.length === filteredSales.length ? 'Todos los visibles' : `de ${filteredSales.length} comprobantes`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Puedes exportar o eliminar en lote los registros seleccionados para limpiar el reporte.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
                  title="Seleccionar todos los comprobantes que coinciden con los filtros actuales"
                >
                  Seleccionar Todo ({filteredSales.length})
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 transition"
                >
                  Limpiar Selección
                </button>
                <button
                  type="button"
                  onClick={handleExportSelectedCsv}
                  className="bg-emerald-800 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-emerald-600 transition shadow-sm"
                  title="Descargar solo los comprobantes seleccionados a CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Exportar ({selectedIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-md hover:shadow-red-600/30"
                  title="Eliminar todos los comprobantes seleccionados"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Seleccionados ({selectedIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Full Table */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/80 border-b border-slate-700">
                  <tr>
                    <th className="px-3 py-3 text-center w-8">
                      <input
                        type="checkbox"
                        checked={filteredSales.length > 0 && selectedIds.length === filteredSales.length}
                        onChange={handleSelectAll}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                        <FolderOpen className="w-4 h-4 text-blue-400" />
                        <span>Comprobante Drive</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap">F. Emisión</th>
                    <th className="px-3 py-3 whitespace-nowrap">F. Venc.</th>
                    <th className="px-3 py-3 whitespace-nowrap">Cliente</th>
                    <th className="px-3 py-3 whitespace-nowrap">RUC / DNI</th>
                    <th className="px-3 py-3 whitespace-nowrap">Tipo</th>
                    <th className="px-3 py-3 whitespace-nowrap">Serie</th>
                    <th className="px-3 py-3 whitespace-nowrap">Número</th>
                    <th className="px-3 py-3 whitespace-nowrap">Concepto</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Base Imp.</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">IGV</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Total</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Det. %</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Monto Det.</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Neto a Cobrar</th>
                    <th className="px-3 py-3 text-right whitespace-nowrap">Costo</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Forma Cobro</th>
                    <th className="px-3 py-3 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/60 font-sans">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="text-center py-6 text-slate-500">
                        No se encontraron comprobantes de venta con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((item) => {
                      const isPending = item.isPendingScan || item.clientName?.includes('PENDIENTE DE ESCANEO') || item.concept?.startsWith('[POR ESCANEAR]');
                      const isRowScanning = scanningRowId === item.id;

                      return (
                        <tr
                          key={item.id}
                          className={`transition ${
                            selectedIds.includes(item.id)
                              ? 'bg-emerald-950/30'
                              : isPending
                              ? 'bg-amber-950/15 border-l-2 border-l-amber-500 hover:bg-amber-950/25'
                              : 'hover:bg-slate-700/40'
                          }`}
                        >
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={() => handleSelectOne(item.id)}
                              className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {item.fileUrl ? (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 bg-blue-900/50 hover:bg-blue-800/80 border border-blue-600/70 text-blue-200 hover:text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-sm transition group"
                                title={`Abrir archivo en Google Drive: ${item.fileName || 'Comprobante'}\nRuta: ${item.fileDrivePath || 'Ventas'}`}
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
                          <td className="px-3 py-2.5 font-mono text-[11px]">{item.date || '-'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-400">{item.dueDate || '-'}</td>
                          <td className="px-3 py-2.5 font-semibold text-white truncate max-w-[170px]">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                                <Clock className="w-3 h-3" />
                                <span>Por Escanear</span>
                              </span>
                            ) : (
                              item.clientName || '-'
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-300">{item.clientDocNumber || '-'}</td>
                          <td className="px-3 py-2.5 text-slate-300">{item.type || '-'}</td>
                          <td className="px-3 py-2.5 font-mono text-emerald-400 font-semibold whitespace-nowrap">
                            {item.series || '-'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-emerald-400 font-semibold whitespace-nowrap">
                            {item.number || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-slate-300 truncate max-w-[160px]" title={item.concept}>
                            {item.concept || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {isPending && item.base === 0 ? <span className="text-slate-500 italic">-</span> : `S/ ${(item.base || 0).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-blue-400 font-semibold">
                            {isPending && item.igv === 0 ? <span className="text-slate-500 italic">-</span> : `S/ ${(item.igv || 0).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400">
                            {isPending && item.total === 0 ? <span className="text-slate-500 italic">-</span> : `S/ ${(item.total || 0).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-purple-300">{item.detractionRate ? `${item.detractionRate}%` : '-'}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-purple-400">{item.detractionAmount ? `S/ ${item.detractionAmount.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-300">
                            {isPending && item.netPay === 0 ? <span className="text-slate-500 italic">-</span> : `S/ ${(item.netPay || item.total || 0).toFixed(2)}`}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-400">{item.cost ? `S/ ${item.cost.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2.5 text-center text-slate-300">{item.paymentMethod || '-'}</td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botón Extraer Datos con IA para filas pendientes */}
                              {isPending ? (
                                <button
                                  type="button"
                                  onClick={() => handleScanPendingSale(item)}
                                  disabled={isRowScanning}
                                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-600 hover:from-amber-400 hover:to-emerald-500 text-white font-extrabold text-[11px] px-3 py-1 rounded-lg shadow-md hover:shadow-emerald-500/25 transition border border-amber-400/40 cursor-pointer animate-pulse hover:animate-none whitespace-nowrap"
                                  title="Escanear ahora con IA para autocompletar todas las columnas del reporte"
                                >
                                  {isRowScanning ? (
                                    <>
                                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                      <span>Extrayendo...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Zap className="w-3.5 h-3.5 text-amber-200 fill-amber-200" />
                                      <span>⚡ Extraer datos con IA</span>
                                    </>
                                  )}
                                </button>
                              ) : (item.fileUrl || item.storedBase64) ? (
                                <button
                                  type="button"
                                  onClick={() => handleScanPendingSale(item)}
                                  disabled={isRowScanning}
                                  title="Re-escanear comprobante con IA desde Google Drive para actualizar todas las columnas"
                                  className="p-1 text-slate-400 hover:text-amber-400 transition"
                                >
                                  {isRowScanning ? (
                                    <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                                  ) : (
                                    <Zap className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              ) : null}

                              <button
                                onClick={() => handleEdit(item)}
                                title="Modificar"
                                className="p-1 text-slate-400 hover:text-emerald-400 transition"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                title="Eliminar"
                                className="p-1 text-slate-400 hover:text-red-400 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: DRIVE UPLOAD & AI SCANNER */}
      {activeTab === 'scanner' && (
        <section className="max-w-2xl mx-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-base">Subida a Google Drive & Escáner IA</h2>
                  <p className="text-xs text-slate-400">Guarda automáticamente en Drive y extrae los datos contables</p>
                </div>
              </div>
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>

            {/* Folder Destination Breadcrumb */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  <span>Carpeta de Destino en Google Drive:</span>
                </span>
                <a
                  href={getGoogleDriveFolderUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 underline font-medium"
                >
                  Abrir Drive ↗
                </a>
              </div>
              <div className="flex items-center gap-2 text-xs bg-slate-950 px-3.5 py-2.5 rounded-lg border border-slate-800 font-mono text-slate-200">
                <span className="text-blue-400 font-semibold">📁 Google Drive</span>
                <span className="text-slate-500">&gt;</span>
                <span className="text-emerald-400 font-semibold">Ventas</span>
                <span className="text-slate-500">&gt;</span>
                <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {targetMonthYear}
                </span>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-2 pt-1.5">
                <label className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Subcarpeta Mes-Año:</span>
                </label>
                <input
                  type="month"
                  value={targetMonthYear}
                  onChange={(e) => setTargetMonthYear(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* VOUCHER UPLOADED TO DRIVE: READY TO REGISTER / EXTRACT DATA */}
            {uploadedVoucherState && (
              <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 space-y-5 shadow-2xl">
                <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/30">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Paso 1 Completado</span>
                      <h3 className="text-base font-bold text-white">Comprobante Subido a Google Drive</h3>
                      <p className="text-xs text-slate-400">El archivo ya está alojado y vinculado en tu nube.</p>
                    </div>
                  </div>
                  {uploadedVoucherState.fileUrl && (
                    <a
                      href={uploadedVoucherState.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-medium"
                    >
                      <span>Ver en Drive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* File & Folder Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Archivo Subido:</span>
                    <p className="font-mono text-slate-200 font-semibold truncate flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="truncate">{uploadedVoucherState.fileName}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 text-[11px]">Carpeta de Destino:</span>
                    <p className="font-mono text-emerald-300 font-semibold truncate flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="truncate">{uploadedVoucherState.folderPath}</span>
                    </p>
                  </div>
                </div>

                {/* AI Extracting State */}
                {isExtractingAI ? (
                  <div className="p-5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full shrink-0"></div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-emerald-300">Leyendo y organizando datos contables con Gemini AI...</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Identificando RUC, Cliente, Fecha, Montos, IGV y Detracción SPOT...</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full animate-pulse w-4/5"></div>
                    </div>
                  </div>
                ) : uploadedVoucherState.extractedData ? (
                  /* AI EXTRACTION RESULTS & DIRECT REGISTRATION */
                  <div className="space-y-4 pt-1">
                    <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Datos Extraídos por IA (Gemini)</span>
                        </div>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                          Listo para Guardar
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Comprobante</span>
                          <span className="font-bold text-white">
                            {uploadedVoucherState.extractedData.type || 'Factura'} {uploadedVoucherState.extractedData.series || 'F001'}-{uploadedVoucherState.extractedData.number || '000001'}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Fecha Emisión</span>
                          <span className="font-bold text-white">{uploadedVoucherState.extractedData.date || new Date().toISOString().split('T')[0]}</span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 col-span-2">
                          <span className="text-[10px] text-slate-400 block">Cliente / RUC</span>
                          <span className="font-bold text-emerald-300 truncate block">
                            {uploadedVoucherState.extractedData.clientName || 'CLIENTE VARIOS'} {uploadedVoucherState.extractedData.clientDocNumber ? `(${uploadedVoucherState.extractedData.clientDocNumber})` : ''}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Base Imponible</span>
                          <span className="font-mono font-semibold text-slate-200">
                            S/ {(uploadedVoucherState.extractedData.baseAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">IGV (18%)</span>
                          <span className="font-mono font-semibold text-slate-200">
                            S/ {(uploadedVoucherState.extractedData.igvAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Detracción SPOT</span>
                          <span className="font-mono font-semibold text-amber-300">
                            {uploadedVoucherState.extractedData.detractionRate ? `${uploadedVoucherState.extractedData.detractionRate}% (S/ ${(uploadedVoucherState.extractedData.detractionAmount || 0).toFixed(2)})` : 'No aplica'}
                          </span>
                        </div>
                        <div className="bg-slate-900/80 p-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30">
                          <span className="text-[10px] text-emerald-400 block font-semibold">Total Facturado</span>
                          <span className="font-mono font-extrabold text-emerald-300 text-sm">
                            S/ {(uploadedVoucherState.extractedData.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {uploadedVoucherState.extractedData.concept && (
                        <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                          <span className="text-slate-400 mr-1.5 font-medium">Concepto:</span>
                          <span>{uploadedVoucherState.extractedData.concept}</span>
                        </div>
                      )}
                    </div>

                    {/* Main Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Botón 1: Guardar Inmediatamente */}
                      <button
                        type="button"
                        onClick={() => handleDirectRegisterSale()}
                        className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg hover:shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                        <span>⚡ Guardar y Registrar Venta Directamente</span>
                      </button>

                      {/* Botón 2: Revisar en Formulario */}
                      <button
                        type="button"
                        onClick={handleReviewInForm}
                        className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all border border-slate-600 flex items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        <Pencil className="w-4 h-4 text-blue-400" />
                        <span>✏️ Revisar / Modificar en Formulario</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleSaveForLater}
                        className="text-xs text-amber-300 hover:text-amber-200 py-1.5 px-3 rounded-lg hover:bg-amber-950/30 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>Guardar como Pendiente de Escaneo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUploadedVoucherState(null)}
                        className="text-xs text-slate-400 hover:text-red-300 hover:bg-slate-800/80 py-1.5 px-3 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Subir otro comprobante</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons: Escanear Ahora vs Escanear Más Tarde */
                  <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-300 font-semibold">
                      ¿Deseas escanear el comprobante ahora o registrarlo para escanear más tarde?
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Opción 1: Escanear Comprobante Ahora */}
                      <button
                        type="button"
                        onClick={handleExtractAndRegisterAI}
                        className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-lg hover:shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '4s' }} />
                        <span>Escanear Comprobante con IA (Ahora)</span>
                      </button>

                      {/* Opción 2: Escanear Más Tarde */}
                      <button
                        type="button"
                        onClick={handleSaveForLater}
                        className="bg-gradient-to-r from-amber-600/90 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-md border border-amber-500/50 flex items-center justify-center gap-2 cursor-pointer text-center"
                        title="Registra una fila con el enlace Drive y deja las columnas listas para escanear cuando tengas tiempo"
                      >
                        <Clock className="w-4 h-4 text-amber-200" />
                        <span>Escanear Más Tarde (Guardar Fila)</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={handleRegisterManualWithVoucher}
                        className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 py-2 px-3.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 text-blue-400" />
                        <span>Completar Formulario Manualmente</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUploadedVoucherState(null)}
                        className="text-xs text-slate-400 hover:text-red-300 hover:bg-slate-800/80 py-2 px-3 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Subir otro comprobante</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Drag & Drop Upload Zone (Shown when no file uploaded yet) */}
            {!uploadedVoucherState && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
                  dragActive
                    ? 'border-emerald-400 bg-emerald-950/30'
                    : 'border-slate-600 bg-slate-900/40 hover:border-emerald-500 hover:bg-slate-900/60'
                }`}
              >
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  id="sales-file-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFileUpload(f);
                  }}
                  disabled={isScanning}
                />
                <label htmlFor="sales-file-upload-input" className="cursor-pointer block space-y-3">
                  <UploadCloud className={`w-12 h-12 mx-auto transition ${dragActive ? 'text-emerald-400 scale-110' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-base font-semibold text-slate-200">
                      Haz clic para seleccionar o arrastra el comprobante aquí
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Formatos soportados: PDF, JPG, PNG, WEBP (Facturas y Boletas)
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium mt-2">
                    <span>1° Se sube a Drive ({targetMonthYear})</span>
                    <span>➔</span>
                    <span>2° Botón para registrar datos con IA</span>
                  </div>
                </label>
              </div>
            )}

            {/* Scanning Progress */}
            {isScanning && (
              <div className="p-4 bg-slate-900/90 border border-emerald-500/40 rounded-xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-300">{scanStatus}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Alojando en tu Google Drive y preparando enlace...</p>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-1.5 rounded-full animate-pulse w-3/4"></div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TAB 3: FORMULARIO NUEVA VENTA */}
      {activeTab === 'new-sale' && (
        <section className="max-w-4xl mx-auto bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-700 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="text-emerald-400" />
              <span>{editingId ? 'Modificar Comprobante de Venta' : 'Registrar Comprobante de Venta'}</span>
            </h2>
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Limpiar Formulario
            </button>
          </div>

          {/* Attached Google Drive Voucher Banner */}
          <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formFileUrl ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Comprobante Digital en Google Drive:</span>
                    {formFileUrl && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30">
                        Guardado en Drive
                      </span>
                    )}
                  </div>
                  {formFileUrl ? (
                    <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-slate-200">{formFileName || 'Comprobante_Venta.pdf'}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-blue-400 text-[11px] font-mono">📁 {formFileDrivePath || 'Ventas'}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 mt-0.5">
                      No hay comprobante subido aún para esta venta. Puedes adjuntarlo a Google Drive ahora.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {formFileUrl && (
                  <a
                    href={formFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ver en Drive</span>
                  </a>
                )}

                <label className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition">
                  <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isFormFileUploading ? 'Subiendo a Drive...' : formFileUrl ? 'Reemplazar Archivo' : 'Subir a Drive'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFormFileUpload}
                    disabled={isFormFileUploading}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveSale} className="space-y-4">
            {/* Row 1: Tipo & Fechas & Serie */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo Documento</label>
                <select
                  value={formVoucherType}
                  onChange={(e) => setFormVoucherType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500"
                >
                  <option value="Factura">Factura Electrónica</option>
                  <option value="Boleta">Boleta de Venta</option>
                  <option value="Ticket">Ticket POS</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Serie</label>
                <input
                  type="text"
                  value={formSeries}
                  onChange={(e) => setFormSeries(e.target.value.toUpperCase())}
                  placeholder="F001 o B001"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Número Correlativo</label>
                <input
                  type="text"
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  placeholder="0000001"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Fecha de Emisión</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Row 2: Doc Cliente, Razón Social, Concepto */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">RUC / DNI del Cliente</label>
                <input
                  type="text"
                  value={formDocNumber}
                  onChange={(e) => setFormDocNumber(e.target.value)}
                  placeholder="20600000001"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Nombre / Razón Social</label>
                <input
                  type="text"
                  value={formClientName}
                  onChange={(e) => setFormClientName(e.target.value)}
                  placeholder="AGROINDUSTRIA PERU S.A.C."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Concepto / Descripción</label>
                <input
                  type="text"
                  value={formConcept}
                  onChange={(e) => setFormConcept(e.target.value)}
                  placeholder="Venta de insumos agroindustriales..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Row 3: Base, IGV (editable), Total */}
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Base Imponible (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formBase}
                    onChange={(e) => handleBaseChange(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-blue-400 font-semibold mb-1">
                    IGV (S/) <span className="text-[10px] text-slate-400 font-normal">(Editable)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formIgv}
                    onChange={(e) => handleIgvChange(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-blue-500/50 rounded-lg p-2.5 text-sm text-blue-400 font-semibold focus:border-blue-400 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monto Total (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formTotal}
                    onChange={(e) => handleTotalChange(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-emerald-400 font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Detractions, Net Pay, Cost, Payment method */}
            <div className="bg-slate-900/30 border border-slate-700/80 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tasa Detracción %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formDetractionRate}
                    onChange={(e) => handleDetractionRateChange(parseFloat(e.target.value) || 0)}
                    placeholder="Ej: 10"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Monto Detracción</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={formDetractionAmount}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-purple-400 font-semibold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Neto a Cobrar (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    readOnly
                    value={formNetPay}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-blue-300 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Costo de Venta (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCost}
                    onChange={(e) => setFormCost(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Forma de Cobro</label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white"
                  >
                    <option value="Contado">Contado</option>
                    <option value="Crédito">Crédito</option>
                    <option value="Transferencia BCP/Interbank">Transferencia BCP/Interbank</option>
                    <option value="Yape/Plin">Yape / Plin</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold py-3 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg"
            >
              <CheckCircle className="w-5 h-5" /> Guardar Comprobante de Venta
            </button>
          </form>
        </section>
      )}

      {/* TAB 4: CLIENTS DIRECTORY */}
      {activeTab === 'customers' && (
        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="font-bold text-white mb-3">Directorio de Clientes Recurrentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3">RUC / DNI</th>
                  <th className="px-4 py-3">Razón Social / Cliente</th>
                  <th className="px-4 py-3 text-center">N° Comprobantes</th>
                  <th className="px-4 py-3 text-right">Total Facturado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {Object.entries(customersMap).map(([doc, c]) => (
                  <tr key={doc} className="hover:bg-slate-700/40 transition">
                    <td className="px-4 py-3 font-mono text-emerald-400">{doc}</td>
                    <td className="px-4 py-3 font-semibold text-white">{c.name}</td>
                    <td className="px-4 py-3 text-center font-mono">{c.count}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-white">
                      S/ {c.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
