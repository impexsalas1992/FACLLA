import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getCompanyName } from './googleSheetsSync';

export interface VoucherAnalysisResult {
  date?: string;
  dueDate?: string;
  clientName?: string;
  clientDocNumber?: string;
  supplierName?: string;
  supplierDocNumber?: string;
  expenseCategory?: string;
  type?: string;
  series?: string;
  number?: string;
  concept?: string;
  baseAmount?: number;
  igvAmount?: number;
  totalAmount?: number;
  detractionRate?: number;
  detractionAmount?: number;
  retention4th?: number;
  netPay?: number;
  paymentMethod?: string;
}

export function sanitizeBase64(raw?: string): string {
  if (!raw) return '';
  let cleaned = String(raw).trim();
  if (cleaned.includes(',')) {
    cleaned = cleaned.split(',')[1] || cleaned;
  }
  if (cleaned.includes('%')) {
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {}
  }
  cleaned = cleaned.replace(/[\r\n\s\t]+/g, '');
  while (cleaned.length % 4 !== 0) {
    cleaned += '=';
  }
  return cleaned;
}

export function detectValidMimeType(base64?: string, fallbackMime?: string): string {
  if (base64 && base64.length >= 8) {
    const prefix = base64.slice(0, 16);
    if (prefix.startsWith('JVBERi0')) return 'application/pdf';
    if (prefix.startsWith('/9j/')) return 'image/jpeg';
    if (prefix.startsWith('iVBORw0KGgo')) return 'image/png';
    if (prefix.startsWith('UklGR')) return 'image/webp';
    if (prefix.startsWith('R0lGOD')) return 'image/gif';
  }

  if (fallbackMime) {
    const clean = fallbackMime.toLowerCase().trim().split(';')[0].trim();
    if (clean === 'image/jpg' || clean === 'image/pjpeg') return 'image/jpeg';
    if (['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(clean)) {
      return clean;
    }
  }

  return 'application/pdf';
}

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'application/octet-stream' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Redimensiona y comprime la imagen en el cliente usando HTML Canvas:
 * - Ancho máximo: 1200px (mantiene relación de aspecto)
 * - Formato: JPEG
 * - Calidad: 0.75
 * Garantiza velocidad de subida ultra rápida (< 2 segundos).
 */
export function compressFileToBase64(
  file: File,
  maxWidth = 900,
  quality = 0.65
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        resolve({ base64, mimeType: file.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, width, height);
        }

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const DEFAULT_GEMINI_API_KEYS = [
  'AQ.Ab8RN6IsmxIr12LhUJZCrL9BykLKVycWkFvgrC0teTfzZfQ8WA',
  'AQ.Ab8RN6JywmfbMR0hwahQdH6NuDNO3xlmdODChD40hkJEX7FG2Q'
];

export function normalizeGeminiApiKey(key?: string): string {
  if (!key) return '';
  const trimmed = key.trim();
  if (trimmed.startsWith('Q.Ab8')) {
    return 'A' + trimmed;
  }
  return trimmed;
}

export const PRIMARY_GEMINI_KEY = DEFAULT_GEMINI_API_KEYS[0];
export const SECONDARY_GEMINI_KEY = DEFAULT_GEMINI_API_KEYS[1];

/**
 * Extrae y parsea JSON de manera segura, tolerando markdown o bloques de código
 */
export function cleanAndParseJson(text: string): any {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const firstOpen = cleaned.indexOf('{');
      const lastClose = cleaned.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        const jsonSubstring = cleaned.substring(firstOpen, lastClose + 1);
        return JSON.parse(jsonSubstring);
      }
      throw new Error('No se pudo interpretar el formato JSON devuelto por la IA.');
    }
  }
}

// Fast client-side cache for analyzed vouchers (5-min TTL)
const clientVoucherCache = new Map<string, { data: VoucherAnalysisResult; expiry: number }>();

export async function analyzeVoucherWithAI(
  fileOrPayload: File | { base64?: string; mimeType?: string; fileUrl?: string; fileName?: string },
  type: 'sale' | 'expense',
  clientApiKey?: string,
  selectedModel: string = 'gemini-3.7-flash',
  appsScriptUrl?: string
): Promise<VoucherAnalysisResult> {
  let base64: string | undefined;
  let mimeType: string | undefined;
  let fileUrl: string | undefined;

  if (fileOrPayload instanceof File) {
    const compressed = await compressFileToBase64(fileOrPayload, 850, 0.65);
    base64 = compressed.base64;
    mimeType = compressed.mimeType;
  } else {
    base64 = fileOrPayload.base64;
    mimeType = fileOrPayload.mimeType;
    fileUrl = fileOrPayload.fileUrl;
  }

  // Check client memory cache if fileUrl is available
  const cacheKey = fileUrl || (base64 ? base64.slice(0, 100) : '');
  if (cacheKey && clientVoucherCache.has(cacheKey)) {
    const cached = clientVoucherCache.get(cacheKey)!;
    if (Date.now() < cached.expiry) {
      return cached.data;
    }
    clientVoucherCache.delete(cacheKey);
  }

  const cleanClientKey = normalizeGeminiApiKey(clientApiKey);

  // 1. Try server route first (can fetch directly from Google Drive if fileUrl is supplied)
  try {
    const res = await fetch('/api/gemini/analyze-voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: base64,
        mimeType: mimeType || 'application/pdf',
        fileUrl,
        appsScriptUrl,
        type,
        apiKey: cleanClientKey,
        model: selectedModel
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.text) {
        const parsed = cleanAndParseJson(result.text);
        if (cacheKey && parsed && Object.keys(parsed).length > 0) {
          clientVoucherCache.set(cacheKey, { data: parsed, expiry: Date.now() + 5 * 60 * 1000 });
        }
        return parsed;
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (errJson?.error?.message) {
        console.warn('Server analyze-voucher response error:', errJson.error.message);
      }
    }
  } catch (serverErr) {
    console.warn('Server endpoint error, attempting client-side fallback:', serverErr);
  }

  // If base64 wasn't available and server failed, try resolving base64 from Drive first
  if (!base64 && fileUrl) {
    try {
      const driveFetchRes = await fetch('/api/drive/fetch-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileUrl, appsScriptUrl })
      });
      if (driveFetchRes.ok) {
        const driveData = await driveFetchRes.json();
        if (driveData && driveData.base64) {
          base64 = driveData.base64;
          mimeType = driveData.mimeType || 'application/pdf';
        }
      }
    } catch (e) {
      console.warn('Could not fetch file from Drive for client-side fallback:', e);
    }
  }

  if (!base64) {
    throw new Error('No se pudo obtener el archivo del comprobante desde Google Drive para el análisis.');
  }

  // 2. Fallback to client-side GoogleGenAI with multi-key rotation and multi-model resilience
  const candidateKeys = cleanClientKey
    ? [cleanClientKey, ...DEFAULT_GEMINI_API_KEYS]
    : [
        (import.meta as any).env?.VITE_GEMINI_API_KEY,
        (window as any).GEMINI_API_KEY,
        ...DEFAULT_GEMINI_API_KEYS
      ].filter(Boolean);

  const promptText = type === 'expense'
    ? `Eres un experto contador y auditor tributario peruano (SUNAT).
Analiza detalladamente este comprobante de GASTO / COMPRA (Factura Electrónica, Boleta de Venta, Recibo por Honorarios, Ticket o Nota de Venta) y extrae TODOS los datos posibles con máxima precisión.
Si hay un código QR SUNAT en la parte inferior o texto estructurado, utilízalo para verificar los datos.

Reglas tributarias peruanas:
1. "type": Identifica si es "Factura", "Boleta", "RxH" o "Ticket". (Si serie empieza con F o dice Factura -> "Factura"; si empieza con B o dice Boleta -> "Boleta"; si es Recibo por Honorarios o serie E -> "RxH"; tickets/vales -> "Ticket").
2. "series": Serie del comprobante (ej: F001, E001, B001, EB01, FF01, T001). Limpio, mayúsculas.
3. "number": Número correlativo de la factura/comprobante (ej: 00012345, 12345, 8940). Sin serie.
4. "date": Fecha de Emisión en formato YYYY-MM-DD estricto (ej: 2026-08-28).
5. "dueDate": Fecha de Vencimiento en formato YYYY-MM-DD si figura en el comprobante, o null.
6. "supplierDocNumber": RUC (11 dígitos) o DNI (8 dígitos) de la empresa o persona que EMITE el comprobante (proveedor/vendedor).
7. "supplierName": Razón Social completa o Nombre comercial del PROVEEDOR/EMISOR. Limpia prefijos como "SEÑOR(ES):", "RAZÓN SOCIAL:", etc.
8. "concept": Glosa o descripción clara de los productos/servicios adquiridos (ej: "COMPRA DE FERTILIZANTES Y UREA", "SERVICIO DE TRANSPORTE DE CARGA", "ALQUILER DE LOCAL", "ASESORÍA CONTABLE"). Máximo 100 caracteres.
9. "baseAmount": Subtotal / Base Imponible / Operaciones Gravadas en número (ej: 100.00). Si es RxH, la base es igual al total.
10. "igvAmount": Monto de IGV (18%) en número (ej: 18.00). Si es RxH o ticket inafecto, 0.
11. "totalAmount": Importe Total a pagar en número (ej: 118.00).
12. "detractionRate": Porcentaje de detracción SPOT si el comprobante indica estar sujeto a detracción (ej: 4, 9, 10, 12). Si no aplica, 0.
13. "detractionAmount": Monto de detracción en soles (ej: total * detractionRate / 100).
14. "retention4th": Retención de 4ta categoría si es RxH (8% si supera S/ 1,500 o figura retención), sino 0.
15. "netPay": Monto neto a pagar (total - detractionAmount - retention4th).
16. "paymentMethod": "Contado" o "Crédito".
17. "expenseCategory": Clasifica obligatoriamente en UNA de estas 6 categorías exactas:
    - "Mercadería / Insumos" (compras de productos, materia prima, insumos agrícolas, fertilizantes, mercadería para reventa)
    - "Servicios Básicos (Luz/Agua)" (Luz del Sur, Enel, Sedapal, Agua, telefonía, internet, Claro, Movistar, Entel)
    - "Honorarios Profesionales" (Recibos por honorarios, asesorías legales, contables, técnicas, ingenieros)
    - "Alquileres" (alquiler de oficinas, locales, almacenes, maquinaria pesada)
    - "Gastos Administrativos" (útiles de oficina, papelería, software, trámites notariales, licencias)
    - "Otros Gastos" (combustible, peajes, viáticos, mantenimiento, fletes, reparaciones, gastos varios)

Responde ÚNICAMENTE en JSON válido con esta estructura:
{
  "expenseCategory": "Mercadería / Insumos" | "Servicios Básicos (Luz/Agua)" | "Honorarios Profesionales" | "Alquileres" | "Gastos Administrativos" | "Otros Gastos",
  "type": "Factura" | "Boleta" | "RxH" | "Ticket",
  "series": "Serie",
  "number": "Número correlativo",
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD o null",
  "supplierDocNumber": "RUC 11 dígitos o DNI 8 dígitos emisor",
  "supplierName": "Razón Social del Proveedor",
  "concept": "Descripción del gasto/compra",
  "baseAmount": número base imponible,
  "igvAmount": número IGV,
  "totalAmount": número total,
  "detractionRate": número porcentaje detracción o 0,
  "detractionAmount": número monto detracción o 0,
  "retention4th": número retención 4ta si es RxH o 0,
  "netPay": número neto a pagar,
  "paymentMethod": "Contado" | "Crédito"
}`
    : `Eres un experto contador y auditor tributario peruano (SUNAT).
Analiza detalladamente este comprobante de VENTA (Factura Electrónica, Boleta de Venta o Ticket) y extrae TODOS los datos posibles con máxima precisión.
Si hay un código QR SUNAT en la parte inferior o texto estructurado, utilízalo para verificar los datos.

Reglas tributarias peruanas:
1. "type": Identifica si es "Factura", "Boleta" o "Ticket". (Serie F -> "Factura", Serie B -> "Boleta", tickets -> "Ticket").
2. "series": Serie del comprobante (ej: F001, B001, EB01, FF01, T001). Limpio, mayúsculas.
3. "number": Número correlativo de la venta (ej: 00012345, 12345, 000456). Sin serie.
4. "date": Fecha de Emisión en formato YYYY-MM-DD estricto (ej: 2026-08-28).
5. "dueDate": Fecha de Vencimiento en formato YYYY-MM-DD si figura, o null.
6. "clientDocNumber": RUC (11 dígitos) o DNI (8 dígitos) del CLIENTE / ADQUIRIENTE.
7. "clientName": Razón Social completa o Nombre y Apellidos del CLIENTE / COMPRADOR. Limpia prefijos como "SEÑOR(ES):", "CLIENTE:", etc.
8. "concept": Glosa o descripción clara de los productos/servicios vendidos (ej: "VENTA DE MERCADERÍA", "SERVICIO DE TRANSPORTE Y FLETE", etc.). Máximo 100 caracteres.
9. "baseAmount": Subtotal / Base Imponible / Operaciones Gravadas en número (ej: 1000.00).
10. "igvAmount": Monto de IGV (18%) en número (ej: 180.00).
11. "totalAmount": Importe Total de la venta en número (ej: 1180.00).
12. "detractionRate": Porcentaje de detracción SPOT si aplica (ej: 4, 9, 10, 12). Si no aplica, 0.
13. "detractionAmount": Monto de detracción en soles (ej: total * detractionRate / 100).
14. "netPay": Monto neto a cobrar en soles (total - detractionAmount).
15. "paymentMethod": "Contado" o "Crédito".

Responde ÚNICAMENTE en JSON válido con esta estructura:
{
  "date": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD o null",
  "clientName": "Razón Social o Nombre del cliente",
  "clientDocNumber": "RUC o DNI del cliente",
  "type": "Factura" | "Boleta" | "Ticket",
  "series": "Serie",
  "number": "Número correlativo",
  "concept": "Descripción de la venta",
  "baseAmount": número base imponible,
  "igvAmount": número IGV,
  "totalAmount": número total,
  "detractionRate": número porcentaje detracción o 0,
  "detractionAmount": número monto de detracción o 0,
  "netPay": número neto a cobrar,
  "paymentMethod": "Contado" | "Crédito"
}`;

  const cleanBase64 = sanitizeBase64(base64);
  const cleanMimeType = detectValidMimeType(cleanBase64, mimeType);

  const candidateModels = Array.from(new Set([
    selectedModel,
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
  ])).filter(Boolean) as string[];

  let lastError: any = null;
  for (const modelToTry of candidateModels) {
    for (const currentKey of candidateKeys) {
      if (!currentKey) continue;
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const imagePart = {
          inlineData: {
            mimeType: cleanMimeType,
            data: cleanBase64
          }
        };
        const textPart = {
          text: promptText
        };

        const response = await ai.models.generateContent({
          model: modelToTry,
          contents: {
            parts: [imagePart, textPart]
          },
          config: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        const parsed = cleanAndParseJson(response.text || '{}');
        if (cacheKey && parsed && Object.keys(parsed).length > 0) {
          clientVoucherCache.set(cacheKey, { data: parsed, expiry: Date.now() + 5 * 60 * 1000 });
        }
        return parsed;
      } catch (err: any) {
        lastError = err;
        const isUnavailableOrBusy = err?.status === 'UNAVAILABLE' || err?.code === 503 || (err?.message && err.message.includes('503'));
        const isQuotaExceeded = err?.status === 'RESOURCE_EXHAUSTED' || err?.code === 429 || (err?.message && err.message.includes('429'));
        if (isUnavailableOrBusy) {
          console.warn(`Model ${modelToTry} is experiencing high demand (503), switching automatically to backup model...`);
        } else if (isQuotaExceeded) {
          console.warn(`Client quota reached on ${modelToTry}, trying backup model/key...`);
        } else {
          console.warn(`Client attempt failed on ${modelToTry}:`, err?.message || err);
        }
      }
    }
  }

  throw new Error(lastError?.message || 'No se pudo procesar el comprobante con ninguna de las API Keys configuradas.');
}

export interface ExecutiveAiReport {
  headline: string;
  healthStatus: 'Excelente' | 'Saludable' | 'Atención Requerida' | 'Crítico';
  healthScore: number;
  commercialInsight: string;
  taxInsight: {
    status: string;
    amountText: string;
    advice: string;
  };
  costInsight: {
    mainDriver: string;
    alert: string;
  };
  keyActions: Array<{
    priority: 'Alta' | 'Media' | 'Inmediata';
    title: string;
    description: string;
  }>;
  rawMarkdown?: string;
}

export function parseExecutiveReport(rawText: string, dataSummary: any): ExecutiveAiReport {
  try {
    const parsed = cleanAndParseJson(rawText);
    if (parsed.headline && parsed.keyActions && Array.isArray(parsed.keyActions)) {
      return {
        ...parsed,
        rawMarkdown: rawText
      };
    }
  } catch {
    // Continue to markdown/text fallback parser
  }

  // Fallback heuristic parser if raw markdown or text is returned
  const defaultUtilidad = dataSummary?.resultados?.utilidadBrutaEstadistica ?? 0;
  const isHealthy = defaultUtilidad >= 0;

  return {
    headline: isHealthy 
      ? `Desempeño financiero positivo con margen neto de ${dataSummary?.resultados?.margenPorcentaje || '0%'}.`
      : `Se registra un déficit operativo en el período analizado. Requiere control de gastos.`,
    healthStatus: isHealthy ? 'Saludable' : 'Atención Requerida',
    healthScore: isHealthy ? 85 : 45,
    commercialInsight: `Ventas totales de S/ ${(dataSummary?.ventas?.totalBruto || 0).toFixed(2)} con ${dataSummary?.ventas?.comprobantesCount || 0} comprobantes emitidos.`,
    taxInsight: {
      status: dataSummary?.resultados?.balanceIgvSunat?.includes('pagar') ? 'IGV por Pagar' : 'Crédito Fiscal a Favor',
      amountText: dataSummary?.resultados?.balanceIgvSunat || 'S/ 0.00',
      advice: 'Revisar que todos los comprobantes de compras cumplan con los requisitos de bancarización y detracción para garantizar el 100% del crédito fiscal.'
    },
    costInsight: {
      mainDriver: 'Gastos de Operación y Mercadería',
      alert: `Gastos totales de S/ ${(dataSummary?.gastos?.totalBruto || 0).toFixed(2)}. Mantener vigilancia sobre gastos administrativos.`
    },
    keyActions: [
      {
        priority: 'Inmediata',
        title: 'Verificación Tributaria SUNAT',
        description: 'Conciliar el Débito vs Crédito fiscal antes del cierre mensual de la declaración jurada.'
      },
      {
        priority: 'Alta',
        title: 'Gestión de Cobranzas',
        description: 'Monitorear la rotación de cuentas por cobrar de los clientes principales.'
      },
      {
        priority: 'Media',
        title: 'Control de Costos de Ventas',
        description: 'Negociar mejores términos de compra con proveedores frecuentes.'
      }
    ],
    rawMarkdown: rawText
  };
}

export async function generateFinancialReportAI(
  dataSummary: any,
  clientApiKey?: string,
  selectedModel: string = 'gemini-3.7-flash'
): Promise<ExecutiveAiReport> {
  const company = dataSummary?.empresa || getCompanyName();

  const cleanClientKey = normalizeGeminiApiKey(clientApiKey);

  // 1. Try server endpoint
  try {
    const res = await fetch('/api/gemini/financial-insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataSummary,
        apiKey: cleanClientKey,
        model: selectedModel
      })
    });

    if (res.ok) {
      const result = await res.json();
      if (result.report) {
        return result.report;
      }
      if (result.text) {
        return parseExecutiveReport(result.text, dataSummary);
      }
    }
  } catch (serverErr) {
    console.warn('Server insights route failed, falling back to client call:', serverErr);
  }

  // 2. Client fallback with multi-key rotation
  const candidateKeys = cleanClientKey
    ? [cleanClientKey, ...DEFAULT_GEMINI_API_KEYS]
    : [
        (import.meta as any).env?.VITE_GEMINI_API_KEY,
        (window as any).GEMINI_API_KEY,
        ...DEFAULT_GEMINI_API_KEYS
      ].filter(Boolean);

  const prompt = `
    Eres el Director Financiero (CFO) y Asesor Tributario de la empresa "${company}".
    Tu misión es entregar un Informe Ejecutivo Financiero visual, conciso, ultra amigable y directo al grano (sin rodeos ni bloques gigantes de texto).
    
    Analiza estos datos consolidados:
    ${JSON.stringify(dataSummary, null, 2)}

    Responde ESTRICTAMENTE con un objeto JSON válido con esta estructura exacta:
    {
      "headline": "Frase de impacto gerencial de 1 sola línea resumiendo la situación del negocio",
      "healthStatus": "Excelente" | "Saludable" | "Atención Requerida" | "Crítico",
      "healthScore": 85 (número entero entre 0 y 100),
      "commercialInsight": "Máximo 2 oraciones con el análisis de ventas, rentabilidad y volumen",
      "taxInsight": {
        "status": "Crédito Fiscal a Favor" | "IGV por Pagar",
        "amountText": "S/ XXX.XX",
        "advice": "Consejo puntual y práctico de 1 a 2 líneas sobre SUNAT e IGV"
      },
      "costInsight": {
        "mainDriver": "Nombre de la categoría de gasto con mayor peso",
        "alert": "Recomendación concisa de 1 a 2 líneas para optimizar costos"
      },
      "keyActions": [
        {
          "priority": "Inmediata" | "Alta" | "Media",
          "title": "Título corto de la acción (máx 5 palabras)",
          "description": "Explicación directa de 1 frase accionable"
        },
        {
          "priority": "Inmediata" | "Alta" | "Media",
          "title": "Título corto de la acción",
          "description": "Explicación directa de 1 frase accionable"
        },
        {
          "priority": "Inmediata" | "Alta" | "Media",
          "title": "Título corto de la acción",
          "description": "Explicación directa de 1 frase accionable"
        }
      ]
    }
  `;

  const reportCandidateModels = Array.from(new Set([
    selectedModel,
    'gemini-3.1-flash-lite',
    'gemini-3.7-flash',
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
  ])).filter(Boolean) as string[];

  let lastError: any = null;
  for (const modelToTry of reportCandidateModels) {
    for (const currentKey of candidateKeys) {
      if (!currentKey) continue;
      try {
        const ai = new GoogleGenAI({ apiKey: currentKey });
        const config: any = {
          responseMimeType: 'application/json',
          temperature: 0.2
        };

        const response = await ai.models.generateContent({
          model: modelToTry,
          contents: prompt,
          config
        });

        const text = response.text || '{}';
        return parseExecutiveReport(text, dataSummary);
      } catch (err: any) {
        lastError = err;
        const isUnavailableOrBusy = err?.status === 'UNAVAILABLE' || err?.code === 503 || (err?.message && err.message.includes('503'));
        const isQuotaExceeded = err?.status === 'RESOURCE_EXHAUSTED' || err?.code === 429 || (err?.message && err.message.includes('429'));
        if (isUnavailableOrBusy) {
          console.warn(`Financial report model ${modelToTry} is busy (503), switching to backup model...`);
        } else if (isQuotaExceeded) {
          console.warn(`Financial report quota reached on ${modelToTry}, trying backup model/key...`);
        } else {
          console.warn(`Financial report attempt failed on ${modelToTry}:`, err?.message || err);
        }
      }
    }
  }

  // Si falló por completo la IA, generar un informe ejecutivo analítico calculado localmente
  return parseExecutiveReport('', dataSummary);
}
