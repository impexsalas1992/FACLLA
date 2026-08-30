import { SaleItem, ExpenseItem } from '../types';

export const COMPANY_NAME_KEY = 'impexsalas_company_name';
export const COMPANY_RUC_KEY = 'impexsalas_company_ruc';
export const DEFAULT_COMPANY_NAME = 'SALAS IMPORTACIONES & EXPORTACIONES S.A.C.';
export const DEFAULT_COMPANY_RUC = '20608512345';

/**
 * Obtiene el nombre / Razón Social de la empresa configurada
 */
export function getCompanyName(): string {
  const stored = localStorage.getItem(COMPANY_NAME_KEY) || localStorage.getItem('agricarl_company_name');
  if (stored && stored.trim()) {
    // Si tenía el nombre anterior de otra empresa, migrar al nuevo por defecto
    if (stored.trim() === 'AGRICARL PERU S.A.C.' || stored.trim() === 'AGRICARL S.A.C.') {
      localStorage.setItem(COMPANY_NAME_KEY, DEFAULT_COMPANY_NAME);
      localStorage.setItem('agricarl_company_name', DEFAULT_COMPANY_NAME);
      return DEFAULT_COMPANY_NAME;
    }
    return stored.trim();
  }
  return DEFAULT_COMPANY_NAME;
}

/**
 * Guarda el nombre / Razón Social de la empresa y notifica al aplicativo
 */
export function setCompanyName(name: string): string {
  const clean = (name || '').trim() || DEFAULT_COMPANY_NAME;
  localStorage.setItem(COMPANY_NAME_KEY, clean);
  localStorage.setItem('agricarl_company_name', clean);
  try {
    window.dispatchEvent(new CustomEvent('company-updated', { detail: { name: clean } }));
  } catch (e) {}
  return clean;
}

/**
 * Obtiene el RUC de la empresa
 */
export function getCompanyRuc(): string {
  const stored = localStorage.getItem(COMPANY_RUC_KEY) || localStorage.getItem('agricarl_company_ruc');
  if (stored && stored.trim()) {
    return stored.trim();
  }
  return DEFAULT_COMPANY_RUC;
}

/**
 * Guarda el RUC de la empresa
 */
export function setCompanyRuc(ruc: string): string {
  const clean = (ruc || '').trim();
  localStorage.setItem(COMPANY_RUC_KEY, clean);
  localStorage.setItem('agricarl_company_ruc', clean);
  return clean;
}

/**
 * Obtiene un nombre corto o comercial para badges compactos
 */
export function getCompanyShortName(fullName?: string): string {
  const name = fullName || getCompanyName();
  const withoutSuffix = name.replace(/\b(S\.A\.C\.|SAC|S\.A\.|SA|E\.I\.R\.L\.|EIRL|S\.R\.L\.|SRL|PERU|PERÚ)\b/gi, '').trim();
  const words = withoutSuffix.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0].toUpperCase() === 'SALAS') {
    return `${words[0]} ${words[1]}`;
  }
  if (words.length >= 1 && words[0].toUpperCase() === 'IMPEXSALAS') {
    return 'IMPEXSALAS';
  }
  if (words.length >= 1 && words[0].toUpperCase() === 'AGRICARL') {
    return 'SALAS';
  }
  return words[0] || name.slice(0, 12);
}

const APPSCRIPT_URL_KEY = 'impexsalas_appscript_url';
export const DEFAULT_APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxMC-UAUbUrEn6WZthpgJN_RRLSqoJVza64fMY5DvzoahtrlaV0SE1RSI1-6FX-7aIb/exec';

const SPREADSHEET_URL_KEY = 'impexsalas_spreadsheet_url';
export const DEFAULT_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1c4k_Hhz_JJwTjR9uYyz8nqHw6Ir50UXDKw0AfVv13cI/edit?gid=1773274751#gid=1773274751';

const DRIVE_FOLDER_ID_KEY = 'impexsalas_drive_folder_id';
const DRIVE_SALES_FOLDER_KEY = 'impexsalas_drive_sales_folder_id';
const DRIVE_EXPENSES_FOLDER_KEY = 'impexsalas_drive_expenses_folder_id';
const DRIVE_SALES_FOLDER_NAME_KEY = 'impexsalas_drive_sales_folder_name';
const DRIVE_EXPENSES_FOLDER_NAME_KEY = 'impexsalas_drive_expenses_folder_name';

export const DEFAULT_DRIVE_FOLDER_ID = '1xTx8NU6oOA19RSO4X73Iimo-PvkHfmbJ';
export const DEFAULT_DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1xTx8NU6oOA19RSO4X73Iimo-PvkHfmbJ';

/**
 * Extrae el ID limpio de una carpeta de Google Drive ya sea que el usuario pegue
 * la URL completa (https://drive.google.com/drive/folders/...) o sólo el ID alfanumérico.
 */
export function extractDriveFolderId(input: string): string {
  if (!input) return DEFAULT_DRIVE_FOLDER_ID;
  const trimmed = input.trim();

  // Caso 1: URL formato /folders/ID
  const matchFolders = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (matchFolders && matchFolders[1]) {
    return matchFolders[1];
  }

  // Caso 2: URL formato id=ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return matchId[1];
  }

  // Caso 3: Si es directamente el ID
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed || DEFAULT_DRIVE_FOLDER_ID;
}

export function getGoogleDriveFolderId(): string {
  const stored = localStorage.getItem(DRIVE_FOLDER_ID_KEY) || localStorage.getItem('agricarl_drive_folder_id');
  if (stored && stored.trim()) {
    const extracted = extractDriveFolderId(stored);
    // Upgrade old placeholder defaults if present
    if (
      extracted === '1e-YdQS3w3KsYWhX_JR0qQpO4FAs45A73' ||
      extracted === '1e2ppxGA0EL38C-9aUhDLmtAIRJLRSnLV' ||
      extracted === '1tz8reRLZs8yABCykbQIprVK9R7Rbc6Dd' ||
      extracted === '1S192VmTYb2jidhivUtu6AXzSgKg2471Q' ||
      extracted === '1HH8LFBN56MHLu8xH3UztXvln9JH6CFhW' ||
      extracted === '1rsRjOifDCXQzkDiV0mD18CX4yntgIjRN'
    ) {
      localStorage.setItem(DRIVE_FOLDER_ID_KEY, DEFAULT_DRIVE_FOLDER_ID);
      localStorage.setItem('agricarl_drive_folder_id', DEFAULT_DRIVE_FOLDER_ID);
      return DEFAULT_DRIVE_FOLDER_ID;
    }
    return extracted;
  }
  return DEFAULT_DRIVE_FOLDER_ID;
}

export function setGoogleDriveFolderId(idOrUrl: string): string {
  const folderId = extractDriveFolderId(idOrUrl);
  localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);
  localStorage.setItem('agricarl_drive_folder_id', folderId);
  return folderId;
}

export function getGoogleDriveFolderUrl(customId?: string): string {
  const folderId = customId ? extractDriveFolderId(customId) : getGoogleDriveFolderId();
  return `https://drive.google.com/drive/folders/${folderId}?usp=sharing`;
}

export function getSpreadsheetUrl(): string {
  const stored = localStorage.getItem(SPREADSHEET_URL_KEY) || localStorage.getItem('agricarl_spreadsheet_url');
  if (stored && stored.trim()) {
    if (
      stored.includes('19pKLOY12-LjG9CFHG-zlZ0fbX669fWxSJYQBZkdOmMI') ||
      stored.includes('126ZvjGVlEvPpMdZ4mZ-s-oeoBbjo3Vwy97wMtZeip0w') ||
      stored.includes('1R-nZ5rWFSrXLVblGdvToJ0au-l4r3DA2XLjVc0xHw4c') ||
      stored.includes('1dl58unxL0YfpyP3livdCpSLmYRoL4uvMsW8ip-hU3tc') ||
      stored.includes('1De5cLqAOFnqK7DGEHxQTvnteq1yOUlQ7CpuSEqSq8PQ')
    ) {
      localStorage.setItem(SPREADSHEET_URL_KEY, DEFAULT_SPREADSHEET_URL);
      localStorage.setItem('agricarl_spreadsheet_url', DEFAULT_SPREADSHEET_URL);
      return DEFAULT_SPREADSHEET_URL;
    }
    return stored.trim();
  }
  return DEFAULT_SPREADSHEET_URL;
}

export function setSpreadsheetUrl(url: string): void {
  localStorage.setItem(SPREADSHEET_URL_KEY, url.trim() || DEFAULT_SPREADSHEET_URL);
  localStorage.setItem('agricarl_spreadsheet_url', url.trim() || DEFAULT_SPREADSHEET_URL);
}

// Configuración de Carpetas específicas de Ventas
export function getSalesDriveFolderConfig(): {
  customId: string;
  folderName: string;
  effectiveId: string;
  folderUrl: string;
} {
  const customId = localStorage.getItem(DRIVE_SALES_FOLDER_KEY) || '';
  const folderName = localStorage.getItem(DRIVE_SALES_FOLDER_NAME_KEY) || 'Ventas';
  const rootId = getGoogleDriveFolderId();
  const effectiveId = customId.trim() ? extractDriveFolderId(customId) : rootId;
  const folderUrl = `https://drive.google.com/drive/folders/${effectiveId}?usp=sharing`;

  return {
    customId: customId.trim(),
    folderName,
    effectiveId,
    folderUrl,
  };
}

export function setSalesDriveFolderConfig(customIdOrUrl: string, folderName = 'Ventas'): void {
  const cleanedId = customIdOrUrl.trim() ? extractDriveFolderId(customIdOrUrl) : '';
  localStorage.setItem(DRIVE_SALES_FOLDER_KEY, cleanedId);
  localStorage.setItem(DRIVE_SALES_FOLDER_NAME_KEY, folderName.trim() || 'Ventas');
}

// Configuración de Carpetas específicas de Gastos
export function getExpensesDriveFolderConfig(): {
  customId: string;
  folderName: string;
  effectiveId: string;
  folderUrl: string;
} {
  const customId = localStorage.getItem(DRIVE_EXPENSES_FOLDER_KEY) || '';
  const folderName = localStorage.getItem(DRIVE_EXPENSES_FOLDER_NAME_KEY) || 'Gastos';
  const rootId = getGoogleDriveFolderId();
  const effectiveId = customId.trim() ? extractDriveFolderId(customId) : rootId;
  const folderUrl = `https://drive.google.com/drive/folders/${effectiveId}?usp=sharing`;

  return {
    customId: customId.trim(),
    folderName,
    effectiveId,
    folderUrl,
  };
}

export function setExpensesDriveFolderConfig(customIdOrUrl: string, folderName = 'Gastos'): void {
  const cleanedId = customIdOrUrl.trim() ? extractDriveFolderId(customIdOrUrl) : '';
  localStorage.setItem(DRIVE_EXPENSES_FOLDER_KEY, cleanedId);
  localStorage.setItem(DRIVE_EXPENSES_FOLDER_NAME_KEY, folderName.trim() || 'Gastos');
}

export function resetDriveFoldersToDefault(): void {
  localStorage.setItem(DRIVE_FOLDER_ID_KEY, DEFAULT_DRIVE_FOLDER_ID);
  localStorage.removeItem(DRIVE_SALES_FOLDER_KEY);
  localStorage.removeItem(DRIVE_EXPENSES_FOLDER_KEY);
  localStorage.setItem(DRIVE_SALES_FOLDER_NAME_KEY, 'Ventas');
  localStorage.setItem(DRIVE_EXPENSES_FOLDER_NAME_KEY, 'Gastos');
}

export function getAppsScriptUrl(): string {
  const stored = localStorage.getItem(APPSCRIPT_URL_KEY) || localStorage.getItem('agricarl_appscript_url');
  if (stored && stored.trim().startsWith('https://script.google.com/')) {
    // If it was an old default URL or library URL, update it to the new user URL
    if (
      stored.includes('AKfycbwHkiwyIThvFw1MUC1in6bbZV_J1NsDmE58cYIb_o3T9t1LZQjFeMQ4ZymwJz0YQNg') ||
      stored.includes('AKfycbyVVOF4yR8IYaMs3F9g8NySEIkeq3pZoTfoYmnoIyFS6daDjhBcN9QUMFqvTGYQUPOB') ||
      stored.includes('1IuGQDB_ytXcoaGwUp9jsLrDG3vA3joS1w7BxNMV7b0JUUMcvX7B39Rwb') ||
      stored.includes('AKfycbx_L3B-8W6NHzRy_RQathPe9WsqGXMzqBRzApywrnnnKKr8Zchj7Xsw6dXKgVQ8LyOUnA') ||
      stored.includes('AKfycbyaTisH-eoOUIU61BzaZkWLcJ8mk0bwBKp60BARGklOqO3Pib9KOs_5a7Dl0r9tKVSfOg') ||
      stored.includes('AKfycbxSWhOWWgShGWnjDkv27VTj-SoGNrDH0Msx1vDEzAzGNUOD5w0mdHH-ZWEIrFxF9EGgiA') ||
      stored.includes('AKfycbwyOAZ65QRYV1jvS22AfEOyjVftNRyKvw3xqLfh2_5yYxf1GEUehplKPg6zjDzBj-R1gg') ||
      stored.includes('AKfycbxGMpeTYmt6c4xhI2mFaEO5C7BQGPBtFOrPWQhd_cRSUw0GdkXWCASi9hxkK4UiGlHg')
    ) {
      localStorage.setItem(APPSCRIPT_URL_KEY, DEFAULT_APPSCRIPT_URL);
      localStorage.setItem('agricarl_appscript_url', DEFAULT_APPSCRIPT_URL);
      return DEFAULT_APPSCRIPT_URL;
    }
    return stored.trim();
  }
  return DEFAULT_APPSCRIPT_URL;
}

export function setAppsScriptUrl(url: string): void {
  localStorage.setItem(APPSCRIPT_URL_KEY, url.trim());
  localStorage.setItem('agricarl_appscript_url', url.trim());
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).replace(/S\/\.?\s?/gi, '').replace(/\s/g, '').trim();
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else {
    str = str.replace(/,/g, '');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split('T')[0];
  const strVal = String(val).trim();
  if (strVal.includes('T')) return strVal.split('T')[0];

  // If format is DD/MM/YYYY or D/M/YYYY
  if (strVal.includes('/')) {
    const parts = strVal.split('/');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY/MM/DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  if (strVal.includes('-')) {
    const parts = strVal.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // DD-MM-YYYY
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // Handle standard JS/Google Sheets date string representations
  if (isNaN(Number(strVal)) && !isNaN(Date.parse(strVal)) && strVal.length > 9) {
    try {
      const d = new Date(strVal);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
  }

  return strVal;
}

function getStableId(item: any, prefix: string, idx: number): string {
  if (item && item.id && String(item.id).trim() !== '') {
    return String(item.id).trim();
  }
  const series = item?.series ? String(item.series).trim() : '';
  const number = item?.number ? String(item.number).trim() : '';
  
  if (series && number) {
    return `${prefix}_${series}_${number}`.toLowerCase();
  }
  const date = item?.date ? String(item.date).trim() : '';
  return `${prefix}_row_${idx}_${date || Date.now()}`;
}

function normalizeSaleItem(item: any, idx: number): SaleItem {
  let base = parseNumber(item.base ?? item.baseAmount);
  let igv = parseNumber(item.igv ?? item.igvAmount);
  let total = parseNumber(item.total ?? item.totalAmount);

  // If user edited total in Google Sheets but didn't recalculate base/igv
  if (total > 0 && base === 0 && igv === 0) {
    base = parseFloat((total / 1.18).toFixed(2));
    igv = parseFloat((total - base).toFixed(2));
  } else if (total === 0 && (base > 0 || igv > 0)) {
    total = parseFloat((base + igv).toFixed(2));
  }

  const detractionRate = parseNumber(item.detractionRate);
  const detractionAmount = parseNumber(item.detractionAmount) || (detractionRate > 0 ? parseFloat(((total * detractionRate) / 100).toFixed(2)) : 0);
  const netPay = parseNumber(item.netPay) || (total - detractionAmount);
  const cost = parseNumber(item.cost);

  let series = String(item.series || '').trim();
  let number = String(item.number || '').trim();

  // Backward compatibility: split combined Serie-N° if separate columns were empty
  if ((!series || !number) && (item['serie-n°'] || item['serie-numero'] || item['serie/numero'] || item['tipo / serie-n°'])) {
    const combined = String(item['serie-n°'] || item['serie-numero'] || item['serie/numero'] || item['tipo / serie-n°'] || '');
    if (combined.includes('-')) {
      const parts = combined.split('-');
      if (!series) series = parts[0].trim().split(' ').pop() || parts[0].trim();
      if (!number) number = parts.slice(1).join('-').trim();
    }
  }

  const cleanType = String(item.type || '').trim();
  const validTypes = ['Factura', 'Boleta', 'Ticket'];
  const type = validTypes.includes(cleanType) ? cleanType : 'Factura';

  return {
    id: getStableId(item, 'sale', idx),
    date: parseDate(item.date),
    dueDate: item.dueDate ? parseDate(item.dueDate) : undefined,
    clientName: String(item.clientName || 'Cliente Varios').trim(),
    clientDocNumber: String(item.clientDocNumber || '00000000').trim(),
    type: type as any,
    series: series || 'F001',
    number: number || '000001',
    concept: String(item.concept || 'Venta de productos').trim(),
    base,
    igv,
    total,
    detractionRate,
    detractionAmount,
    netPay,
    cost,
    paymentMethod: String(item.paymentMethod || 'Contado').trim(),
    fileUrl: item.fileUrl ? String(item.fileUrl).trim() : undefined,
    fileName: item.fileName ? String(item.fileName).trim() : undefined,
    fileDrivePath: item.fileDrivePath ? String(item.fileDrivePath).trim() : undefined,
  };
}

function normalizeExpenseItem(item: any, idx: number): ExpenseItem {
  let base = parseNumber(item.base ?? item.baseAmount);
  let igv = parseNumber(item.igv ?? item.igvAmount);
  let total = parseNumber(item.total ?? item.totalAmount);

  if (total > 0 && base === 0 && igv === 0) {
    base = parseFloat((total / 1.18).toFixed(2));
    igv = parseFloat((total - base).toFixed(2));
  } else if (total === 0 && (base > 0 || igv > 0)) {
    total = parseFloat((base + igv).toFixed(2));
  }

  const detractionRate = parseNumber(item.detractionRate);
  const detractionAmount = parseNumber(item.detractionAmount) || (detractionRate > 0 ? parseFloat(((total * detractionRate) / 100).toFixed(2)) : 0);
  const retention4th = parseNumber(item.retention4th);
  const netPay = parseNumber(item.netPay) || (total - detractionAmount - retention4th);

  let series = String(item.series || '').trim();
  let number = String(item.number || '').trim();

  // Backward compatibility: split combined Serie-N° if separate columns were empty
  if ((!series || !number) && (item['serie-n°'] || item['serie-numero'] || item['serie/numero'] || item['tipo / serie-n°'])) {
    const combined = String(item['serie-n°'] || item['serie-numero'] || item['serie/numero'] || item['tipo / serie-n°'] || '');
    if (combined.includes('-')) {
      const parts = combined.split('-');
      if (!series) series = parts[0].trim().split(' ').pop() || parts[0].trim();
      if (!number) number = parts.slice(1).join('-').trim();
    }
  }

  const cleanType = String(item.type || '').trim();
  const validTypes = ['Factura', 'Boleta', 'RxH'];
  const type = validTypes.includes(cleanType) ? cleanType : 'Factura';

  return {
    id: getStableId(item, 'exp', idx),
    expenseCategory: String(item.expenseCategory || 'Otros Gastos').trim() as any,
    date: parseDate(item.date),
    dueDate: item.dueDate ? parseDate(item.dueDate) : undefined,
    supplierName: String(item.supplierName || 'Proveedor Varios').trim(),
    supplierDocNumber: String(item.supplierDocNumber || '00000000').trim(),
    type: type as any,
    series: series || 'F001',
    number: number || '000001',
    concept: String(item.concept || 'Gasto operativo').trim(),
    base,
    igv,
    total,
    detractionRate,
    detractionAmount,
    retention4th,
    netPay,
    paymentMethod: String(item.paymentMethod || 'Contado').trim(),
    fileUrl: item.fileUrl ? String(item.fileUrl).trim() : undefined,
    fileName: item.fileName ? String(item.fileName).trim() : undefined,
    fileDrivePath: item.fileDrivePath ? String(item.fileDrivePath).trim() : undefined,
  };
}

export interface DriveUploadResponse {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  downloadUrl?: string;
  folderPath?: string;
  fileName?: string;
  error?: string;
}

export async function uploadVoucherToGoogleDrive(params: {
  fileBase64: string;
  fileName: string;
  mimeType: string;
  folderType: 'Ventas' | 'Gastos';
  monthYear: string; // e.g. "2026-08"
  parentFolderId?: string;
  url?: string;
}): Promise<DriveUploadResponse> {
  const targetUrl = (params.url || getAppsScriptUrl()).trim();
  
  // Determinar carpeta efectiva (si el usuario configuró una carpeta específica o la raíz)
  let effectiveFolderId = params.parentFolderId;
  if (!effectiveFolderId) {
    if (params.folderType === 'Ventas') {
      const salesConfig = getSalesDriveFolderConfig();
      effectiveFolderId = salesConfig.customId ? salesConfig.effectiveId : getGoogleDriveFolderId();
    } else {
      const expConfig = getExpensesDriveFolderConfig();
      effectiveFolderId = expConfig.customId ? expConfig.effectiveId : getGoogleDriveFolderId();
    }
  }
  const parentFolderId = effectiveFolderId || getGoogleDriveFolderId();

  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
    // Return a dummy link if no Apps Script configured so user can still preview
    return {
      success: false,
      error: 'Google Apps Script no configurado. Se requiere URL del script para subir a Google Drive.'
    };
  }

  const payloadData = {
    action: 'upload_voucher',
    parentFolderId,
    folderType: params.folderType,
    monthYear: params.monthYear,
    fileName: params.fileName,
    mimeType: params.mimeType,
    fileBase64: params.fileBase64,
  };

  // 1. Intentar primero a través del proxy del backend (resuelve problemas de CORS / redirecciones 302 en iframes y navegadores)
  try {
    const proxyRes = await fetch('/api/google-apps-script/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        payload: payloadData,
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.success) {
        return {
          success: true,
          fileId: data.fileId,
          fileUrl: data.fileUrl,
          downloadUrl: data.downloadUrl,
          folderPath: data.folderPath || `${params.folderType} / ${params.monthYear}`,
          fileName: data.fileName || params.fileName,
        };
      } else if (data && data.error) {
        return {
          success: false,
          error: data.error,
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy de subida a Drive no disponible, intentando conexión directa:', proxyErr);
  }

  // 2. Respaldo directo en caso de modo cliente puro
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payloadData),
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'URL de Google Apps Script no encontrada (HTTP 404). Por favor verifica que la aplicación web esté implementada en Google Sheets.'
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    if (data && data.success) {
      return {
        success: true,
        fileId: data.fileId,
        fileUrl: data.fileUrl,
        downloadUrl: data.downloadUrl,
        folderPath: data.folderPath || `${params.folderType} / ${params.monthYear}`,
        fileName: data.fileName || params.fileName,
      };
    } else {
      return {
        success: false,
        error: data?.error || 'Error al guardar archivo en Google Drive'
      };
    }
  } catch (err: any) {
    console.warn('Advertencia al subir archivo a Google Drive:', err);
    return {
      success: false,
      error: err?.message || 'Error de conexión con Google Drive'
    };
  }
}

export interface CloudSyncResult {
  sales: SaleItem[];
  expenses: ExpenseItem[];
  config?: Record<string, any>;
  appliedConfig?: {
    companyName?: string;
    companyRuc?: string;
    spreadsheetUrl?: string;
    driveFolderId?: string;
    driveFolderUrl?: string;
    appScriptUrl?: string;
  };
}

/**
 * Aplica los parámetros de configuración leídos desde la pestaña "Configuracion_Conexion"
 * de Google Sheets hacia el almacenamiento local y notifica al aplicativo.
 */
export function applyConfigFromSheets(rawConfig: Record<string, any>): {
  companyName?: string;
  companyRuc?: string;
  spreadsheetUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  appScriptUrl?: string;
} {
  if (!rawConfig || typeof rawConfig !== 'object') return {};

  const lowerMap = new Map<string, any>();
  Object.keys(rawConfig).forEach(key => {
    lowerMap.set(key.toLowerCase().trim(), rawConfig[key]);
  });

  const getVal = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const match = lowerMap.get(k.toLowerCase().trim());
      if (match !== undefined && match !== null && String(match).trim() !== '') {
        return String(match).trim();
      }
    }
    return undefined;
  };

  const results: {
    companyName?: string;
    companyRuc?: string;
    spreadsheetUrl?: string;
    driveFolderId?: string;
    driveFolderUrl?: string;
    appScriptUrl?: string;
  } = {};

  // 1. Nombre de Empresa / Razón Social
  const companyVal = getVal(
    'empresa / organización',
    'empresa / organizacion',
    'empresa',
    'razón social',
    'razon social',
    'company',
    'companyname',
    'empresa / razon social'
  );
  if (companyVal) {
    setCompanyName(companyVal);
    results.companyName = companyVal;
  }

  // 2. RUC de la Empresa
  const rucVal = getVal(
    'ruc de la empresa',
    'ruc',
    'companyruc',
    'ruc empresa',
    'numero ruc'
  );
  if (rucVal) {
    setCompanyRuc(rucVal);
    results.companyRuc = rucVal;
  }

  // 3. Enlace Hoja Google Sheets
  const sheetUrlVal = getVal(
    'enlace hoja google sheets',
    'hoja google sheets',
    'spreadsheeturl',
    'enlace hoja',
    'spreadsheet url',
    'url google sheets'
  );
  if (sheetUrlVal && sheetUrlVal.includes('docs.google.com/spreadsheets')) {
    setSpreadsheetUrl(sheetUrlVal);
    results.spreadsheetUrl = sheetUrlVal;
  }

  // 4. Carpeta Principal Google Drive
  const driveIdVal = getVal(
    'id carpeta principal drive',
    'carpeta principal drive',
    'id carpeta drive',
    'drivefolderid',
    'enlace carpeta google drive',
    'drivefolderurl',
    'carpeta drive'
  );
  if (driveIdVal) {
    const cleanedDriveId = extractDriveFolderId(driveIdVal);
    setGoogleDriveFolderId(cleanedDriveId);
    results.driveFolderId = cleanedDriveId;
    results.driveFolderUrl = getGoogleDriveFolderUrl(cleanedDriveId);
  }

  // 5. URL Google Apps Script (siempre que sea válida)
  const scriptUrlVal = getVal(
    'url google apps script (web app)',
    'url apps script',
    'appscripturl',
    'apps script'
  );
  if (scriptUrlVal && scriptUrlVal.startsWith('https://script.google.com/')) {
    setAppsScriptUrl(scriptUrlVal);
    results.appScriptUrl = scriptUrlVal;
  }

  try {
    window.dispatchEvent(new CustomEvent('app-config-synced-from-sheets', { detail: results }));
  } catch (e) {}

  return results;
}

function isNonEmptySaleItem(s: any): boolean {
  if (!s) return false;
  const total = Number(s.total) || 0;
  const base = Number(s.base) || 0;
  const hasClient = s.clientName && String(s.clientName).trim() !== '' && String(s.clientName).trim() !== 'Cliente Varios';
  const hasDoc = s.clientDocNumber && String(s.clientDocNumber).trim() !== '' && String(s.clientDocNumber).trim() !== '00000000';
  const hasConcept = s.concept && String(s.concept).trim() !== '' && String(s.concept).trim() !== 'Venta de productos';
  const hasFile = s.fileUrl && String(s.fileUrl).trim() !== '';
  const hasDate = s.date && String(s.date).trim() !== '';
  const hasCustomSeriesOrNum = (s.series && String(s.series).trim() !== '' && String(s.series).trim() !== 'F001') ||
                                (s.number && String(s.number).trim() !== '' && String(s.number).trim() !== '000001');

  return total > 0 || base > 0 || hasClient || hasDoc || (hasConcept && hasDate) || hasFile || hasCustomSeriesOrNum;
}

function isNonEmptyExpenseItem(e: any): boolean {
  if (!e) return false;
  const total = Number(e.total) || 0;
  const base = Number(e.base) || 0;
  const hasSupplier = e.supplierName && String(e.supplierName).trim() !== '' && String(e.supplierName).trim() !== 'Proveedor Varios';
  const hasDoc = e.supplierDocNumber && String(e.supplierDocNumber).trim() !== '' && String(e.supplierDocNumber).trim() !== '00000000';
  const hasConcept = e.concept && String(e.concept).trim() !== '' && String(e.concept).trim() !== 'Gasto operativo';
  const hasFile = e.fileUrl && String(e.fileUrl).trim() !== '';
  const hasDate = e.date && String(e.date).trim() !== '';
  const hasCustomSeriesOrNum = (e.series && String(e.series).trim() !== '' && String(e.series).trim() !== 'F001') ||
                                (e.number && String(e.number).trim() !== '' && String(e.number).trim() !== '000001');

  return total > 0 || base > 0 || hasSupplier || hasDoc || (hasConcept && hasDate) || hasFile || hasCustomSeriesOrNum;
}

export async function loadFromGoogleSheets(url?: string): Promise<CloudSyncResult | null> {
  const targetUrl = (url || getAppsScriptUrl()).trim();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) return null;

  // 1. Intentar a través del proxy del backend
  try {
    const proxyRes = await fetch(`/api/google-apps-script/load?url=${encodeURIComponent(targetUrl)}`);
    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.success && Array.isArray(data.sales) && Array.isArray(data.expenses)) {
        const rawSales = data.sales.map((s: any, i: number) => normalizeSaleItem(s, i));
        const rawExpenses = data.expenses.map((e: any, i: number) => normalizeExpenseItem(e, i));
        const normalizedSales = rawSales.filter(isNonEmptySaleItem);
        const normalizedExpenses = rawExpenses.filter(isNonEmptyExpenseItem);

        let appliedConfig: any = undefined;
        if (data.config && typeof data.config === 'object') {
          appliedConfig = applyConfigFromSheets(data.config);
        }

        return {
          sales: normalizedSales,
          expenses: normalizedExpenses,
          config: data.config,
          appliedConfig
        };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy de carga de Sheets no disponible, intentando conexión directa:', proxyErr);
  }

  // 2. Respaldo directo en caso de modo cliente puro
  try {
    const delimiter = targetUrl.includes('?') ? '&' : '?';
    const reqUrl = `${targetUrl}${delimiter}action=load&_t=${Date.now()}`;
    const res = await fetch(reqUrl, {
      method: 'GET',
      redirect: 'follow',
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.warn('Google Sheets Sync: La URL de Apps Script respondió HTTP 404 (No encontrada). Verifica que la implementación web esté activa.');
        return null;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();

    if (data && data.success && Array.isArray(data.sales) && Array.isArray(data.expenses)) {
      const rawSales = data.sales.map((s: any, i: number) => normalizeSaleItem(s, i));
      const rawExpenses = data.expenses.map((e: any, i: number) => normalizeExpenseItem(e, i));

      // Filter out empty rows (e.g. rows deleted or cleared in Google Sheets)
      const normalizedSales = rawSales.filter(isNonEmptySaleItem);
      const normalizedExpenses = rawExpenses.filter(isNonEmptyExpenseItem);

      // Extraer y procesar automáticamente los parámetros de conexión desde la pestaña "Configuracion_Conexion"
      let appliedConfig: any = undefined;
      if (data.config && typeof data.config === 'object') {
        appliedConfig = applyConfigFromSheets(data.config);
      }

      return {
        sales: normalizedSales,
        expenses: normalizedExpenses,
        config: data.config,
        appliedConfig
      };
    }
    return null;
  } catch (err: any) {
    if (err?.name === 'TypeError' && err?.message === 'Failed to fetch') {
      console.warn('Google Sheets Sync: No se pudo conectar con Apps Script. Asegúrate de haber publicado con acceso "Cualquier persona" (Anyone).');
    } else {
      console.warn('Google Sheets Sync (usando almacenamiento local):', err?.message || err);
    }
    return null;
  }
}

export async function syncToGoogleSheets(
  sales: SaleItem[],
  expenses: ExpenseItem[],
  url?: string,
  extraConfig?: {
    spreadsheetUrl?: string;
    driveFolderId?: string;
    company?: string;
    companyRuc?: string;
    eventName?: string;
  }
): Promise<boolean> {
  const targetUrl = (url || getAppsScriptUrl()).trim();
  if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) return false;

  const currentSpreadsheet = extraConfig?.spreadsheetUrl || getSpreadsheetUrl();
  const currentDriveId = extraConfig?.driveFolderId || getGoogleDriveFolderId();
  const currentDriveUrl = getGoogleDriveFolderUrl(currentDriveId);
  const currentCompany = (extraConfig?.company || getCompanyName()).trim() || DEFAULT_COMPANY_NAME;
  const currentRuc = (extraConfig?.companyRuc || getCompanyRuc()).trim() || DEFAULT_COMPANY_RUC;

  // Clean data to send only tabular metadata (strip heavy base64 cache)
  const cleanSales = sales.map(({ storedBase64, storedMimeType, ...rest }) => rest);
  const cleanExpenses = expenses.map(({ storedBase64, storedMimeType, ...rest }) => rest);

  const payload = {
    action: 'sync',
    sales: cleanSales,
    expenses: cleanExpenses,
    config: {
      appScriptUrl: targetUrl,
      spreadsheetUrl: currentSpreadsheet,
      driveFolderId: currentDriveId,
      driveFolderUrl: currentDriveUrl,
      company: currentCompany,
      companyRuc: currentRuc,
      salesCount: cleanSales.length,
      expensesCount: cleanExpenses.length,
      syncTimestamp: new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' }),
      eventName: extraConfig?.eventName || 'Sincronización Completa de Datos'
    }
  };

  // 1. Intentar a través del proxy del backend
  try {
    const proxyRes = await fetch('/api/google-apps-script/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: targetUrl,
        payload,
      }),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.success) return true;
    }
  } catch (proxyErr) {
    console.warn('Proxy de sincronización de Sheets no disponible, intentando conexión directa:', proxyErr);
  }

  // 2. Respaldo directo en caso de modo cliente puro
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('Google Sheets Sync: La URL de Apps Script respondió HTTP 404 al guardar.');
        return false;
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    return !!(data && data.success);
  } catch (err: any) {
    if (err?.name === 'TypeError' && err?.message === 'Failed to fetch') {
      console.warn('Google Sheets Sync: No se pudo guardar en Apps Script directamente.');
    } else {
      console.warn('Google Sheets Sync:', err?.message || err);
    }
    return false;
  }
}

export function generateAppsScriptCode(folderId?: string, companyName?: string): string {
  const rootId = folderId || getGoogleDriveFolderId();
  const company = (companyName || getCompanyName()).trim() || DEFAULT_COMPANY_NAME;
  return `/**
 * GOOGLE APPS SCRIPT - BASE DE DATOS Y GESTOR DE GOOGLE DRIVE PARA ${company}
 * Copia y pega este código en Extensiones > Apps Script de tu Google Sheets.
 * 
 * HOJAS DEL SISTEMA:
 * 1. "Ventas" -> Registro completo de ventas emitidas
 * 2. "Gastos" -> Registro completo de gastos y compras
 * 3. "Configuracion_Conexion" -> Única hoja de configuración de datos de la empresa y enlaces
 * 
 * Raíz de Carpetas Drive: ${rootId}
 */

var DRIVE_ROOT_FOLDER_ID = "${rootId}";
var COMPANY_NAME = "${company}";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var output = { success: false };
  try {
    var action = "load";
    var postData = null;

    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
        action = postData.action || "sync";
      } catch(err) {}
    } 
    
    if (e && e.parameter && e.parameter.action) {
      action = e.parameter.action;
    }

    // ACCIÓN: Subir archivo a Google Drive en Ventas/Gastos > Mes-Año
    if (action === "upload_voucher" && postData) {
      output = handleVoucherUpload(postData);
      return ContentService.createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ACCIÓN: Obtener archivo en base64 desde Google Drive por ID o enlace
    if (action === "get_file_base64" && postData) {
      output = handleGetFileBase64(postData);
      return ContentService.createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var salesSheet = getOrCreateSheet(ss, "Ventas", getSalesHeaders(), "#059669");
    var expensesSheet = getOrCreateSheet(ss, "Gastos", getExpensesHeaders(), "#0284C7");
    var configSheet = getOrCreateConfigSheet(ss, "Configuracion_Conexion");

    if (action === "sync" && postData) {
      if (postData.sales && Array.isArray(postData.sales)) {
        saveSheetData(salesSheet, postData.sales, getSalesHeaders(), getSalesKeyMapping());
      }
      if (postData.expenses && Array.isArray(postData.expenses)) {
        saveSheetData(expensesSheet, postData.expenses, getExpensesHeaders(), getExpensesKeyMapping());
      }
      
      // Guardar datos de configuración en la única hoja de configuración limpia y práctica
      if (postData.config) {
        saveConfigData(configSheet, postData.config);
      }

      // Forzar escritura inmediata en disco para que otros dispositivos lean datos actualizados al instante
      SpreadsheetApp.flush();

      output = { 
        success: true, 
        message: "Datos y configuración guardados correctamente en Google Sheets",
        timestamp: new Date().toISOString(),
        salesCount: postData.sales ? postData.sales.length : 0,
        expensesCount: postData.expenses ? postData.expenses.length : 0
      };
    } else {
      var sales = loadSheetData(salesSheet, getSalesKeyMapping());
      var expenses = loadSheetData(expensesSheet, getExpensesKeyMapping());
      var configData = loadConfigData(configSheet);
      output = { 
        success: true, 
        sales: sales, 
        expenses: expenses,
        config: configData,
        timestamp: new Date().toISOString()
      };
    }
  } catch (err) {
    output = { success: false, error: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleVoucherUpload(data) {
  var rootId = data.parentFolderId || DRIVE_ROOT_FOLDER_ID;
  var folderType = data.folderType || "Ventas"; // "Ventas" o "Gastos"
  
  // Extraer año y mes automáticamente (ej: "2026-09" o desde fecha "2026-09-15")
  var monthYear = "";
  if (data.monthYear && String(data.monthYear).trim() !== "") {
    var myStr = String(data.monthYear).trim();
    if (myStr.length >= 7 && myStr.indexOf("-") === 4) {
      monthYear = myStr.substring(0, 7); // ej: "2026-09"
    } else {
      monthYear = myStr;
    }
  } else if (data.date) {
    var dStr = String(data.date).trim();
    if (dStr.length >= 7 && dStr.indexOf("-") === 4) {
      monthYear = dStr.substring(0, 7);
    }
  }
  
  if (!monthYear || monthYear === "") {
    monthYear = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  }

  var fileName = data.fileName || ("Comprobante_" + Date.now());
  var mimeType = data.mimeType || "application/pdf";
  var base64Data = data.fileBase64;

  if (!base64Data) {
    return { success: false, error: "No se enviaron datos base64 del archivo" };
  }

  var rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(rootId);
  } catch (e) {
    rootFolder = DriveApp.getRootFolder();
  }

  // 1. Obtener o crear carpeta principal del módulo (Ventas o Gastos)
  var moduleFolder = getOrCreateSubFolder(rootFolder, folderType);

  // 2. Obtener o crear subcarpeta de Mes-Año automáticamente (ej: 2026-08, 2026-09)
  var monthFolder = getOrCreateSubFolder(moduleFolder, monthYear);

  // 3. Crear archivo desde base64 dentro de la subcarpeta creada
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  var file = monthFolder.createFile(blob);

  // Intentar habilitar acceso de lectura pública con enlace
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  return {
    success: true,
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    downloadUrl: file.getDownloadUrl(),
    folderPath: folderType + " / " + monthYear,
    fileName: file.getName(),
    folderUrl: monthFolder.getUrl()
  };
}

function handleGetFileBase64(data) {
  var fileId = data.fileId;
  if (!fileId && data.fileUrl) {
    var str = String(data.fileUrl);
    var match = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || str.match(/[?&]id=([a-zA-Z0-9_-]+)/) || str.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) fileId = match[1];
  }
  if (!fileId) {
    return { success: false, error: "No se proporcionó ID de archivo de Google Drive" };
  }
  try {
    var file = DriveApp.getFileById(fileId);
    var blob = file.getBlob();
    var bytes = blob.getBytes();
    var base64 = Utilities.base64Encode(bytes);
    return {
      success: true,
      fileId: fileId,
      fileName: file.getName(),
      mimeType: blob.getContentType() || "application/pdf",
      base64: base64
    };
  } catch (err) {
    return { success: false, error: "Error al leer archivo de Drive: " + err.toString() };
  }
}

function getOrCreateSubFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(folderName);
}

function getOrCreateSheet(ss, sheetName, headers, headerColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var color = headerColor || "#059669";
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(color);
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

// HOJA: Configuracion_Conexion
function getOrCreateConfigSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  var headers = ["Parámetro de Configuración", "Valor Registrado", "Descripción / Notas", "Última Actualización"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0F172A"); // Azul Medianoche Ejecutivo
  headerRange.setFontColor("#38BDF8"); // Celeste Brillante
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function saveConfigData(sheet, cfg) {
  var now = cfg.syncTimestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  
  var existingConfig = loadConfigData(sheet);
  var company = existingConfig["Empresa / Organización"] || cfg.company || COMPANY_NAME || "SALAS IMPORTACIONES & EXPORTACIONES S.A.C.";
  var ruc = existingConfig["RUC de la Empresa"] || cfg.companyRuc || "20608512345";
  var scriptUrl = cfg.appScriptUrl || existingConfig["URL Google Apps Script (Web App)"] || "";
  var sheetUrl = cfg.spreadsheetUrl || existingConfig["Enlace Hoja Google Sheets"] || "";
  var driveId = cfg.driveFolderId || existingConfig["ID Carpeta Principal Drive"] || DRIVE_ROOT_FOLDER_ID;

  var rows = [
    ["Empresa / Organización", company, "Razón Social registrada (editable)", now],
    ["RUC de la Empresa", ruc, "Número de Registro Único de Contribuyente (editable)", now],
    ["URL Google Apps Script (Web App)", scriptUrl, "Motor API de enlace con la aplicación web", now],
    ["Enlace Hoja Google Sheets", sheetUrl, "Hoja de cálculo donde se almacenan los datos", now],
    ["ID Carpeta Principal Drive", driveId, "Identificador de carpeta raíz en Google Drive", now],
    ["Enlace Carpeta Google Drive", cfg.driveFolderUrl || ("https://drive.google.com/drive/folders/" + driveId + "?usp=sharing"), "Acceso directo a carpeta en la nube", now],
    ["Estructura de Carpetas Drive", "Automática por Módulo (Ventas/Gastos) y Mes (AAAA-MM)", "Creación dinámica de comprobantes", now],
    ["Total Ventas Registradas", cfg.salesCount !== undefined ? cfg.salesCount : 0, "Cantidad de comprobantes de venta sincronizados", now],
    ["Total Gastos Registrados", cfg.expensesCount !== undefined ? cfg.expensesCount : 0, "Cantidad de comprobantes de gasto sincronizados", now],
    ["Estado de Conexión", "CONECTADO Y ACTIVO", "Verificado por el aplicativo web", now]
  ];
  
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  sheet.autoResizeColumns(1, 4);
}

function loadConfigData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var values = sheet.getRange(1, 1, lastRow, Math.max(2, sheet.getLastColumn())).getValues();
  var config = {};
  for (var i = 1; i < values.length; i++) {
    var key = String(values[i][0]).trim();
    var val = values[i][1];
    if (key) config[key] = val;
  }
  return config;
}

function getSalesHeaders() {
  return [
    "Enlace Comprobante Drive",
    "Fecha Emisión",
    "Fecha Vencimiento",
    "Cliente / Razón Social",
    "RUC / DNI Cliente",
    "Tipo Comprobante",
    "Serie",
    "Número Correlativo",
    "Concepto / Descripción",
    "Base Imponible (S/)",
    "IGV (18%) (S/)",
    "Monto Total (S/)",
    "% Detracción",
    "Monto Detracción (S/)",
    "Neto a Cobrar (S/)",
    "Costo de Ventas (S/)",
    "Forma de Pago",
    "ID Comprobante"
  ];
}

function getSalesKeyMapping() {
  return [
    { key: "fileUrl", label: "Enlace Comprobante Drive", aliases: ["fileurl", "enlace comprobante drive", "enlace drive", "comprobante drive", "url drive", "drive"] },
    { key: "date", label: "Fecha Emisión", aliases: ["date", "fecha", "fecha emision", "fecha emisión", "f. emisión", "f. emision"] },
    { key: "dueDate", label: "Fecha Vencimiento", aliases: ["duedate", "vencimiento", "fecha vencimiento", "f. venc.", "f. vencimiento"] },
    { key: "clientName", label: "Cliente / Razón Social", aliases: ["clientname", "cliente", "razon social", "razón social", "cliente / razón social"] },
    { key: "clientDocNumber", label: "RUC / DNI Cliente", aliases: ["clientdocnumber", "ruc", "dni", "ruc client", "ruc/dni", "ruc / dni", "ruc / dni cliente"] },
    { key: "type", label: "Tipo Comprobante", aliases: ["type", "tipo", "tipo comprobante", "tipo documento"] },
    { key: "series", label: "Serie", aliases: ["series", "serie", "serie comprobante"] },
    { key: "number", label: "Número Correlativo", aliases: ["number", "numero", "número", "numero correlativo", "número correlativo", "correlativo", "n°", "nro"] },
    { key: "concept", label: "Concepto / Descripción", aliases: ["concept", "concepto", "descripcion", "descripción", "concepto / descripción"] },
    { key: "base", label: "Base Imponible (S/)", aliases: ["base", "baseamount", "base imponible", "base imp.", "subtotal"] },
    { key: "igv", label: "IGV (18%) (S/)", aliases: ["igv", "igvamount", "igv (18%)", "igv"] },
    { key: "total", label: "Monto Total (S/)", aliases: ["total", "totalamount", "monto total", "total (s/)"] },
    { key: "detractionRate", label: "% Detracción", aliases: ["detractionrate", "% detraccion", "% detracción", "det. %", "tasa detracción %"] },
    { key: "detractionAmount", label: "Monto Detracción (S/)", aliases: ["detractionamount", "monto detraccion", "monto detracción", "monto det."] },
    { key: "netPay", label: "Neto a Cobrar (S/)", aliases: ["netpay", "neto", "neto a cobrar", "neto cobrar"] },
    { key: "cost", label: "Costo de Ventas (S/)", aliases: ["cost", "costo", "costo de ventas", "costo venta"] },
    { key: "paymentMethod", label: "Forma de Pago", aliases: ["paymentmethod", "forma de pago", "forma cobro", "pago", "condicion pago"] },
    { key: "id", label: "ID Comprobante", aliases: ["id", "id comprobante", "identificador"] }
  ];
}

function getExpensesHeaders() {
  return [
    "Enlace Comprobante Drive",
    "Categoría Gasto",
    "Fecha Emisión",
    "Fecha Vencimiento",
    "Proveedor / Razón Social",
    "RUC / DNI Proveedor",
    "Tipo Comprobante",
    "Serie",
    "Número Correlativo",
    "Concepto / Descripción",
    "Base Imponible (S/)",
    "IGV (18%) (S/)",
    "Monto Total (S/)",
    "% Detracción",
    "Monto Detracción (S/)",
    "Retención 4ta (S/)",
    "Neto a Pagar (S/)",
    "Forma de Pago",
    "ID Comprobante"
  ];
}

function getExpensesKeyMapping() {
  return [
    { key: "fileUrl", label: "Enlace Comprobante Drive", aliases: ["fileurl", "enlace comprobante drive", "enlace drive", "comprobante drive", "url drive", "drive"] },
    { key: "expenseCategory", label: "Categoría Gasto", aliases: ["expensecategory", "categoria", "categoría", "categoria gasto", "categoría gasto", "categoría gastos"] },
    { key: "date", label: "Fecha Emisión", aliases: ["date", "fecha", "fecha emision", "fecha emisión", "f. emisión", "f. emision"] },
    { key: "dueDate", label: "Fecha Vencimiento", aliases: ["duedate", "vencimiento", "fecha vencimiento", "f. venc.", "f. vencimiento"] },
    { key: "supplierName", label: "Proveedor / Razón Social", aliases: ["suppliername", "proveedor", "razon social", "razón social", "proveedor / razón social"] },
    { key: "supplierDocNumber", label: "RUC / DNI Proveedor", aliases: ["supplierdocnumber", "ruc", "dni", "ruc proveedor", "ruc/dni", "ruc / dni", "ruc / dni proveedor"] },
    { key: "type", label: "Tipo Comprobante", aliases: ["type", "tipo", "tipo comprobante", "tipo documento"] },
    { key: "series", label: "Serie", aliases: ["series", "serie", "serie comprobante"] },
    { key: "number", label: "Número Correlativo", aliases: ["number", "numero", "número", "numero correlativo", "número correlativo", "correlativo", "n°", "nro"] },
    { key: "concept", label: "Concepto / Descripción", aliases: ["concept", "concepto", "descripcion", "descripción", "concepto / descripción"] },
    { key: "base", label: "Base Imponible (S/)", aliases: ["base", "baseamount", "base imponible", "base imp.", "subtotal"] },
    { key: "igv", label: "IGV (18%) (S/)", aliases: ["igv", "igvamount", "igv (18%)", "igv"] },
    { key: "total", label: "Monto Total (S/)", aliases: ["total", "totalamount", "monto total", "total (s/)"] },
    { key: "detractionRate", label: "% Detracción", aliases: ["detractionrate", "% detraccion", "% detracción", "det. %", "tasa detracción %"] },
    { key: "detractionAmount", label: "Monto Detracción (S/)", aliases: ["detractionamount", "monto detraccion", "monto detracción", "monto det."] },
    { key: "retention4th", label: "Retención 4ta (S/)", aliases: ["retention4th", "retencion 4ta", "retención 4ta", "ret. 4ta", "4ta categoria"] },
    { key: "netPay", label: "Neto a Pagar (S/)", aliases: ["netpay", "neto", "neto a pagar", "neto pagado"] },
    { key: "paymentMethod", label: "Forma de Pago", aliases: ["paymentmethod", "forma de pago", "forma cobro", "pago", "condicion pago"] },
    { key: "id", label: "ID Comprobante", aliases: ["id", "id comprobante", "identificador"] }
  ];
}

function saveSheetData(sheet, items, headers, keyMapping) {
  var maxRows = sheet.getMaxRows();
  var maxCols = Math.max(headers.length, sheet.getMaxColumns() || 1);
  if (maxRows > 1) {
    sheet.getRange(2, 1, maxRows - 1, maxCols).clearContent();
  }
  
  // Escribir encabezados en español en la Fila 1
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#059669");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);

  if (!items || items.length === 0) return;

  var rows = items.map(function(item) {
    return keyMapping.map(function(mapping) {
      var val = item[mapping.key];
      return val !== undefined && val !== null ? val : "";
    });
  });

  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function loadSheetData(sheet, keyMapping) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var headersInSheet = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  var cleanRows = [];
  for (var r = 0; r < values.length; r++) {
    var row = values[r];
    
    // Check if the row has any non-empty cell
    var hasContent = false;
    for (var c = 0; c < row.length; c++) {
      var cell = row[c];
      if (cell !== "" && cell !== null && cell !== undefined && String(cell).trim() !== "") {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;

    var obj = {};
    headersInSheet.forEach(function(headerName, colIdx) {
      var cleanHeader = String(headerName).toLowerCase().trim();
      var mappedKey = null;

      for (var i = 0; i < keyMapping.length; i++) {
        var m = keyMapping[i];
        if (m.label.toLowerCase() === cleanHeader || m.aliases.indexOf(cleanHeader) !== -1) {
          mappedKey = m.key;
          break;
        }
      }

      if (!mappedKey) {
        mappedKey = headerName;
      }

      var cellValue = row[colIdx];
      if (cellValue instanceof Date) {
        cellValue = Utilities.formatDate(cellValue, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      obj[mappedKey] = cellValue;
    });

    // Compatibilidad retroactiva: si existe una columna combinada antigua 'serie-n°' o 'serie-numero'
    if ((!obj.series || !obj.number) && (obj['serie-n°'] || obj['serie-numero'] || obj['serie/numero'] || obj['tipo / serie-n°'])) {
      var comb = String(obj['serie-n°'] || obj['serie-numero'] || obj['serie/numero'] || obj['tipo / serie-n°'] || '').trim();
      if (comb.indexOf('-') !== -1) {
        var parts = comb.split('-');
        if (!obj.series) {
          var serieCandidate = parts[0].trim().split(' ').pop();
          obj.series = serieCandidate || parts[0].trim();
        }
        if (!obj.number) obj.number = parts.slice(1).join('-').trim();
      }
    }

    cleanRows.push(obj);
  }

  return cleanRows;
}
`;
}

export const APPSCRIPT_CODE_TEMPLATE = generateAppsScriptCode();


