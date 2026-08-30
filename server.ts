import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_GEMINI_KEYS = [
  'AQ.Ab8RN6IsmxIr12LhUJZCrL9BykLKVycWkFvgrC0teTfzZfQ8WA',
  'AQ.Ab8RN6JywmfbMR0hwahQdH6NuDNO3xlmdODChD40hkJEX7FG2Q'
];

// Helper: Clean and sanitize base64 string
function sanitizeBase64(raw: string): string {
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

// Helper: Detect valid IANA MIME type for Gemini API from magic bytes or header
function detectValidMimeType(base64: string, fallbackMime?: string): string {
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

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Body parser middleware with large limit for scanned documents & high-res invoices
  app.use(express.json({ limit: '30mb' }));
  app.use(express.urlencoded({ extended: true, limit: '30mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'ControlVentas-Gastos-AI',
      timestamp: new Date().toISOString()
    });
  });

  // API Route: Google Apps Script Proxy for Google Drive uploads & Sheets sync
  app.post('/api/google-apps-script/proxy', async (req, res) => {
    try {
      const { url, payload } = req.body;
      const targetUrl = (url || '').trim() || 'https://script.google.com/macros/s/AKfycbxMC-UAUbUrEn6WZthpgJN_RRLSqoJVza64fMY5DvzoahtrlaV0SE1RSI1-6FX-7aIb/exec';

      if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
        return res.status(400).json({ success: false, error: 'URL de Google Apps Script no válida o no configurada.' });
      }

      const bodyData = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      const scriptRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: bodyData,
        redirect: 'follow'
      });

      const responseText = await scriptRes.text();
      try {
        const jsonData = JSON.parse(responseText);
        return res.status(200).json(jsonData);
      } catch {
        return res.status(200).json({
          success: scriptRes.ok,
          text: responseText,
          status: scriptRes.status
        });
      }
    } catch (err: any) {
      console.error('Error in Google Apps Script Proxy (POST):', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error de conexión con Google Apps Script'
      });
    }
  });

  // API Route: Google Apps Script Load Proxy (GET)
  app.get('/api/google-apps-script/load', async (req, res) => {
    try {
      const targetUrl = (req.query.url as string || '').trim() || 'https://script.google.com/macros/s/AKfycbxMC-UAUbUrEn6WZthpgJN_RRLSqoJVza64fMY5DvzoahtrlaV0SE1RSI1-6FX-7aIb/exec';

      if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
        return res.status(400).json({ success: false, error: 'URL de Google Apps Script no válida.' });
      }

      const delimiter = targetUrl.includes('?') ? '&' : '?';
      const reqUrl = `${targetUrl}${delimiter}action=load&_t=${Date.now()}`;

      const scriptRes = await fetch(reqUrl, {
        method: 'GET',
        redirect: 'follow'
      });

      const responseText = await scriptRes.text();
      try {
        const jsonData = JSON.parse(responseText);
        return res.status(200).json(jsonData);
      } catch {
        return res.status(200).json({
          success: scriptRes.ok,
          text: responseText,
          status: scriptRes.status
        });
      }
    } catch (err: any) {
      console.error('Error in Google Apps Script Proxy (GET):', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error al obtener datos de Google Sheets'
      });
    }
  });

  // Helper: Extract Google Drive File ID from URL
  function extractDriveFileId(urlOrId?: string): string | null {
    if (!urlOrId) return null;
    const trimmed = String(urlOrId).trim();
    const m1 = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m1 && m1[1]) return m1[1];
    const m2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2 && m2[1]) return m2[1];
    const m3 = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m3 && m3[1]) return m3[1];
    const m4 = trimmed.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
    if (m4 && m4[1]) return m4[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
    return null;
  }

  // In-memory cache for fast repeat reads (5-minute TTL)
  const serverDriveCache = new Map<string, { base64: string; mimeType: string; fileName?: string; expiry: number }>();

  // Helper: Fetch file from Google Drive ultra-fast (races direct Drive streams and Apps Script proxy)
  async function resolveFileBase64(fileUrl?: string, fileIdInput?: string, targetAppsScriptUrl?: string): Promise<{ base64: string; mimeType: string; fileName?: string }> {
    const fileId = fileIdInput || extractDriveFileId(fileUrl);
    const cacheKey = fileId || fileUrl || '';

    // Check fast in-memory cache first (< 1ms)
    if (cacheKey && serverDriveCache.has(cacheKey)) {
      const cached = serverDriveCache.get(cacheKey)!;
      if (Date.now() < cached.expiry) {
        return { base64: cached.base64, mimeType: cached.mimeType, fileName: cached.fileName };
      }
      serverDriveCache.delete(cacheKey);
    }

    const scriptUrl = (targetAppsScriptUrl || '').trim() || 'https://script.google.com/macros/s/AKfycbxMC-UAUbUrEn6WZthpgJN_RRLSqoJVza64fMY5DvzoahtrlaV0SE1RSI1-6FX-7aIb/exec';

    // Direct download helper
    async function fetchFromUrl(url: string): Promise<{ base64: string; mimeType: string }> {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/jpeg,image/png,image/webp,application/pdf,*/*'
        },
        redirect: 'follow'
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buffer = await resp.arrayBuffer();
      if (!buffer || buffer.byteLength < 80) throw new Error('Empty response');

      // Check if response is HTML error / login page
      const headStr = Buffer.from(buffer.slice(0, 100)).toString('utf-8').toLowerCase();
      if (headStr.includes('<!doctype') || headStr.includes('<html') || headStr.includes('<script')) {
        throw new Error('Google Drive returned HTML preview/login page instead of binary content');
      }

      const rawType = resp.headers.get('content-type') || '';
      let detectedMime = 'application/pdf';

      if (rawType.includes('image/png')) detectedMime = 'image/png';
      else if (rawType.includes('image/jpeg') || rawType.includes('image/jpg')) detectedMime = 'image/jpeg';
      else if (rawType.includes('image/webp')) detectedMime = 'image/webp';
      else if (rawType.includes('application/pdf')) detectedMime = 'application/pdf';
      else {
        const bytes = new Uint8Array(buffer.slice(0, 8));
        if (bytes[0] === 0x25 && bytes[1] === 0x40 && bytes[2] === 0x44 && bytes[3] === 0x46) {
          detectedMime = 'application/pdf';
        } else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
          detectedMime = 'image/jpeg';
        } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
          detectedMime = 'image/png';
        }
      }

      const base64Str = Buffer.from(buffer).toString('base64');
      return { base64: base64Str, mimeType: detectedMime };
    }

    // Apps Script proxy helper
    async function fetchFromAppsScript(): Promise<{ base64: string; mimeType: string; fileName?: string }> {
      if (!fileId || !scriptUrl) throw new Error('No fileId or scriptUrl');
      const scriptRes = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'get_file_base64',
          fileId,
          fileUrl
        }),
        redirect: 'follow'
      });

      if (!scriptRes.ok) throw new Error(`Apps Script HTTP ${scriptRes.status}`);
      const json = await scriptRes.json();
      if (json && json.success && json.base64) {
        return {
          base64: json.base64,
          mimeType: json.mimeType || 'application/pdf',
          fileName: json.fileName
        };
      }
      throw new Error(json?.error || 'Apps script returned unsuccessful');
    }

    // Candidate direct streams
    const candidateDirectUrls: string[] = [];
    if (fileId) {
      candidateDirectUrls.push(
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w2500`,
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
        `https://docs.google.com/uc?export=download&id=${fileId}&confirm=t`,
        `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
        `https://drive.google.com/uc?id=${fileId}&export=download`
      );
    }
    if (fileUrl && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
      candidateDirectUrls.push(fileUrl);
    }

    const downloadPromises: Promise<{ base64: string; mimeType: string; fileName?: string }>[] = candidateDirectUrls.map(url => fetchFromUrl(url));

    if (fileId && scriptUrl) {
      downloadPromises.push(fetchFromAppsScript());
    }

    try {
      // Race for fastest successful download
      const result = await Promise.any(downloadPromises);
      if (result && result.base64) {
        if (cacheKey) {
          serverDriveCache.set(cacheKey, { ...result, expiry: Date.now() + 5 * 60 * 1000 });
        }
        return result;
      }
    } catch (raceErr) {
      console.warn('Fast race failed, trying sequential Apps Script fallback:', raceErr);
      try {
        const fallback = await fetchFromAppsScript();
        if (cacheKey) {
          serverDriveCache.set(cacheKey, { ...fallback, expiry: Date.now() + 5 * 60 * 1000 });
        }
        return fallback;
      } catch (fbErr) {
        console.error('All Drive download methods failed:', fbErr);
      }
    }

    throw new Error(`No se pudo obtener el archivo desde el enlace de Google Drive: ${fileUrl || fileId}`);
  }

  // API Route: Download file from Google Drive as base64
  app.post('/api/drive/fetch-file', async (req, res) => {
    try {
      const { fileUrl, fileId, appsScriptUrl } = req.body;
      if (!fileUrl && !fileId) {
        return res.status(400).json({ success: false, error: 'Se requiere URL o ID del archivo de Google Drive.' });
      }

      const fileData = await resolveFileBase64(fileUrl, fileId, appsScriptUrl);
      return res.status(200).json({
        success: true,
        base64: fileData.base64,
        mimeType: fileData.mimeType,
        fileName: fileData.fileName
      });
    } catch (err: any) {
      console.error('Error fetching file from Drive:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Error al obtener el archivo desde Google Drive'
      });
    }
  });

  // API Route: Analyze Voucher with Gemini AI
  app.post('/api/gemini/analyze-voucher', async (req, res) => {
    try {
      let { fileBase64, mimeType, fileUrl, fileId, appsScriptUrl, type, apiKey: clientKey, model: userModel } = req.body;

      // If fileBase64 is not provided, fetch it directly from the Google Drive link
      if (!fileBase64 && (fileUrl || fileId)) {
        try {
          const resolved = await resolveFileBase64(fileUrl, fileId, appsScriptUrl);
          fileBase64 = resolved.base64;
          if (!mimeType || mimeType === 'application/octet-stream') {
            mimeType = resolved.mimeType;
          }
        } catch (fetchErr: any) {
          console.error('Error resolving Drive voucher for Gemini analysis:', fetchErr);
          return res.status(500).json({
            error: {
              message: `No se pudo descargar el archivo desde Google Drive (${fileUrl || fileId}): ${fetchErr.message}`
            }
          });
        }
      }

      if (!fileBase64) {
        return res.status(400).json({ error: { message: 'Se requiere el archivo (base64 o enlace de Google Drive).' } });
      }

      const cleanBase64 = sanitizeBase64(fileBase64);
      const cleanMimeType = detectValidMimeType(cleanBase64, mimeType);

      if (!cleanBase64 || cleanBase64.length < 10) {
        return res.status(400).json({ error: { message: 'El contenido del archivo es inválido o está vacío.' } });
      }

      const cleanClientKey = clientKey ? (clientKey.startsWith('Q.Ab8') ? 'A' + clientKey : clientKey) : null;
      
      const candidateKeys = Array.from(new Set([
        process.env.GEMINI_API_KEY,
        cleanClientKey,
        ...DEFAULT_GEMINI_KEYS
      ])).filter(Boolean) as string[];

      const selectedModel = userModel || 'gemini-3.1-flash-lite';
      const candidateModels = Array.from(new Set([
        selectedModel,
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite'
      ])).filter(Boolean) as string[];

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

      let lastError: any = null;

      for (const modelToTry of candidateModels) {
        for (const currentKey of candidateKeys) {
          if (!currentKey) continue;
          try {
            const ai = new GoogleGenAI({
              apiKey: currentKey,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });

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

            return res.status(200).json({ text: response.text, usedModel: modelToTry });
          } catch (err: any) {
            lastError = err;
            const isUnavailableOrBusy = err?.status === 'UNAVAILABLE' || err?.code === 503 || (err?.message && err.message.includes('503'));
            const isQuotaExceeded = err?.status === 'RESOURCE_EXHAUSTED' || err?.code === 429 || (err?.message && err.message.includes('429'));
            if (isUnavailableOrBusy) {
              console.warn(`Model ${modelToTry} is busy (503), switching to backup...`);
            } else if (isQuotaExceeded) {
              console.warn(`Quota reached on ${modelToTry}, trying backup...`);
            } else {
              console.warn(`Attempt failed on ${modelToTry}:`, err?.message || err);
            }
          }
        }
      }

      return res.status(500).json({ error: { message: lastError?.message || 'Error procesando el comprobante con Gemini.' } });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Error procesando el comprobante con Gemini.' } });
    }
  });

  // API Route: Financial Insights with Gemini AI
  app.post('/api/gemini/financial-insights', async (req, res) => {
    try {
      const { dataSummary, apiKey: clientKey, model: userModel } = req.body;
      const cleanClientKey = clientKey ? (clientKey.startsWith('Q.Ab8') ? 'A' + clientKey : clientKey) : null;
      
      const candidateKeys = Array.from(new Set([
        process.env.GEMINI_API_KEY,
        cleanClientKey,
        ...DEFAULT_GEMINI_KEYS
      ])).filter(Boolean) as string[];

      const selectedModel = userModel || 'gemini-3.1-flash-lite';
      const candidateModels = Array.from(new Set([
        selectedModel,
        'gemini-3.1-flash-lite',
        'gemini-3.7-flash',
        'gemini-flash-latest',
        'gemini-3.6-flash',
        'gemini-3.5-flash-lite'
      ])).filter(Boolean) as string[];

      const prompt = `
        Eres el Director Financiero (CFO) y Asesor Tributario de la empresa ${dataSummary?.empresa || 'SALAS IMPORTACIONES & EXPORTACIONES S.A.C.'}.
        Tu misión es entregar un Informe Ejecutivo Financiero visual, conciso, ultra amigable y directo al grano (sin rodeos ni bloques gigantes de texto).
        
        Analiza estos datos consolidados:
        ${JSON.stringify(dataSummary, null, 2)}

        Responde ESTRICTAMENTE con un objeto JSON válido con esta estructura exacta:
        {
          "headline": "Frase de impacto gerencial de 1 sola línea resumiendo la situación del negocio",
          "healthStatus": "Excelente" | "Saludable" | "Atención Requerida" | "Crítico",
          "healthScore": 85,
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

      let lastError: any = null;

      for (const modelToTry of candidateModels) {
        for (const currentKey of candidateKeys) {
          if (!currentKey) continue;
          try {
            const ai = new GoogleGenAI({
              apiKey: currentKey,
              httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
            });

            const config: any = {
              responseMimeType: 'application/json',
              temperature: 0.2
            };

            const response = await ai.models.generateContent({
              model: modelToTry,
              contents: prompt,
              config
            });

            return res.status(200).json({ text: response.text, usedModel: modelToTry });
          } catch (err: any) {
            lastError = err;
            const isQuotaExceeded = err?.status === 'RESOURCE_EXHAUSTED' || err?.code === 429 || (err?.message && err.message.includes('429'));
            if (isQuotaExceeded) {
              console.warn(`Financial insights quota reached on ${modelToTry}, trying backup...`);
            } else {
              console.warn(`Financial insights attempt failed on ${modelToTry}:`, err?.message || err);
            }
          }
        }
      }

      return res.status(500).json({ error: { message: lastError?.message || 'Error generando diagnóstico financiero.' } });
    } catch (err: any) {
      return res.status(500).json({ error: { message: err?.message || 'Error generando diagnóstico financiero.' } });
    }
  });

  // Vite development middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
