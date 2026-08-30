export type VoucherType = 'Factura' | 'Boleta' | 'Ticket' | 'RxH';

export type ExpenseCategory = 
  | 'Mercadería / Insumos'
  | 'Servicios Básicos (Luz/Agua)'
  | 'Honorarios Profesionales'
  | 'Alquileres'
  | 'Gastos Administrativos'
  | 'Otros Gastos';

export const GOOGLE_DRIVE_PARENT_FOLDER_ID = '1xTx8NU6oOA19RSO4X73Iimo-PvkHfmbJ';
export const GOOGLE_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1xTx8NU6oOA19RSO4X73Iimo-PvkHfmbJ';

export interface SaleItem {
  id: string;
  date: string; // YYYY-MM-DD
  dueDate?: string;
  clientName: string;
  clientDocNumber: string; // RUC or DNI
  type: VoucherType;
  series: string;
  number: string;
  concept: string;
  base: number;
  igv: number;
  total: number;
  detractionRate: number; // e.g. 10%
  detractionAmount: number;
  netPay: number; // total - detractionAmount
  cost: number; // Cost of sale
  paymentMethod: string; // Contado, Crédito, Transferencia, Yape/Plin
  fileUrl?: string; // Enlace directo al archivo en Google Drive
  fileName?: string; // Nombre del comprobante subido
  fileDrivePath?: string; // Carpeta organizada (ej: Ventas / 2026-08)
  isPendingScan?: boolean; // Si está guardado para escanear más tarde
  storedBase64?: string; // Imagen en caché para escaneo posterior
  storedMimeType?: string;
  createdAt?: number; // Timestamp de creación para sincronización atómica
}

export interface ExpenseItem {
  id: string;
  expenseCategory: ExpenseCategory;
  date: string; // YYYY-MM-DD
  dueDate?: string;
  supplierName: string;
  supplierDocNumber: string; // RUC or DNI
  type: VoucherType;
  series: string;
  number: string;
  concept: string;
  base: number;
  igv: number;
  total: number;
  detractionRate: number;
  detractionAmount: number;
  retention4th: number; // 8% for RxH
  netPay: number; // total - detractionAmount - retention4th
  paymentMethod: string;
  fileUrl?: string; // Enlace directo al archivo en Google Drive
  fileName?: string; // Nombre del comprobante subido
  fileDrivePath?: string; // Carpeta organizada (ej: Gastos / 2026-08)
  isPendingScan?: boolean; // Si está guardado para escanear más tarde
  storedBase64?: string; // Imagen en caché para escaneo posterior
  storedMimeType?: string;
  createdAt?: number; // Timestamp de creación para sincronización atómica
}

export interface CustomerSummary {
  docNumber: string;
  name: string;
  salesCount: number;
  totalBilled: number;
}

export interface SupplierSummary {
  docNumber: string;
  name: string;
  expensesCount: number;
  mainCategory: ExpenseCategory;
  totalBilled: number;
  totalNetPay: number;
}

export interface MonthlyComparison {
  monthKey: string; // YYYY-MM
  monthName: string;
  salesTotal: number;
  salesIgv: number;
  salesNet: number;
  expensesTotal: number;
  expensesIgv: number;
  expensesNet: number;
  costOfSales: number;
  grossProfit: number; // salesTotal - expensesTotal - costOfSales
  igvTaxBalance: number; // salesIgv - expensesIgv
}

export type ActiveModule = 'dashboard' | 'sales' | 'expenses' | 'reports';
