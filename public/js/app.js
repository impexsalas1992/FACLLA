/**
 * CONTROL DE VENTAS & GASTOS .AI - APLICACIÓN WEB ESTÁTICA AUTÓNOMA
 * 100% JavaScript Clásico Estándar (Sin TypeScript, Sin React, Sin Node.js)
 * Compatible con Cloudflare Pages, Netlify, Vercel o ejecución directa en navegador.
 */

// =============================================================================
// 1. CONFIGURACIÓN, CONSTANTES Y ESTADO GLOBAL
// =============================================================================
const CONFIG_KEYS = {
  COMPANY_NAME: 'agricarl_company_name',
  COMPANY_RUC: 'agricarl_company_ruc',
  APPSCRIPT_URL: 'agricarl_appscript_url',
  SPREADSHEET_URL: 'agricarl_spreadsheet_url',
  DRIVE_FOLDER_ID: 'agricarl_drive_folder_id',
  SESSION: 'agricarl_session_v1',
  SALES: 'agricarl_sales_data_v1',
  EXPENSES: 'agricarl_expenses_data_v1',
  LAST_SYNC: 'agricarl_last_sync_timestamp',
  GEMINI_API_KEY: 'gemini_api_key',
  SELECTED_MODEL: 'gemini_selected_model',
  DEEP_OCR_SALES: 'gemini_deep_ocr_sales',
  DEEP_OCR_EXPENSES: 'gemini_deep_ocr_expenses',
  DELETED_SALES: 'agricarl_deleted_sales_v1',
  DELETED_EXPENSES: 'agricarl_deleted_expenses_v1'
};

const DEFAULTS = {
  COMPANY_NAME: 'SALAS IMPORTACIONES & EXPORTACIONES S.A.C.',
  COMPANY_RUC: '20608512345',
  APPSCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxMC-UAUbUrEn6WZthpgJN_RRLSqoJVza64fMY5DvzoahtrlaV0SE1RSI1-6FX-7aIb/exec',
  SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1c4k_Hhz_JJwTjR9uYyz8nqHw6Ir50UXDKw0AfVv13cI/edit?gid=1773274751#gid=1773274751',
  DRIVE_FOLDER_ID: '1xTx8NU6oOA19RSO4X73Iimo-PvkHfmbJ',
  GEMINI_API_KEYS: [
    'AQ.Ab8RN6IsmxIr12LhUJZCrL9BykLKVycWkFvgrC0teTfzZfQ8WA',
    'AQ.Ab8RN6JywmfbMR0hwahQdH6NuDNO3xlmdODChD40hkJEX7FG2Q'
  ],
  GEMINI_MODELS_FAST: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'],
  GEMINI_MODELS_DEEP: ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-3.1-pro-preview']
};

// Global App State
const state = {
  isAuthenticated: false,
  activeModule: 'sales', // 'sales' | 'expenses' | 'reports'
  activeSalesTab: 'dashboard', // 'dashboard' | 'scanner' | 'new-sale' | 'customers'
  activeExpensesTab: 'dashboard', // 'dashboard' | 'scanner' | 'new-expense' | 'suppliers'
  activeReportsSubTab: 'sales', // 'sales' | 'expenses' | 'tax'
  sales: [],
  expenses: [],
  selectedSaleIds: new Set(),
  selectedExpenseIds: new Set(),
  isSyncing: false,
  pendingPush: false,
  lastSyncTime: '',
  lastLocalActionTime: 0,
  pendingDriveUploads: { sale: null, expense: null },
  charts: {
    comparison: null,
    categories: null,
    salesTrend: null
  },
  deleteAction: null
};

// =============================================================================
// 2. INICIALIZACIÓN DE LA APLICACIÓN
// =============================================================================
function initApp() {
  try {
    initIcons();
    loadStoredSettings();
    loadLocalData();
    checkAuth();
    
    // Set default dates on inputs
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    
    const saleDate = document.getElementById('saleFormDate');
    if (saleDate && !saleDate.value) saleDate.value = today;
    
    const expDate = document.getElementById('expenseFormDate');
    if (expDate && !expDate.value) expDate.value = today;

    const salesScanMY = document.getElementById('salesScanMonthYear');
    if (salesScanMY && !salesScanMY.value) salesScanMY.value = currentMonth;

    const expScanMY = document.getElementById('expensesScanMonthYear');
    if (expScanMY && !expScanMY.value) expScanMY.value = currentMonth;

    // Restore Deep OCR toggle state
    const salesDeepToggle = document.getElementById('salesDeepOcrToggle');
    if (salesDeepToggle) {
      salesDeepToggle.checked = localStorage.getItem(CONFIG_KEYS.DEEP_OCR_SALES) === 'true';
      salesDeepToggle.addEventListener('change', (e) => {
        localStorage.setItem(CONFIG_KEYS.DEEP_OCR_SALES, e.target.checked);
        if (e.target.checked) {
          showToast('Modo Alta Precisión activado: Se usará Gemini 3.7 Flash para ventas.', 'info');
        }
      });
    }

    const expDeepToggle = document.getElementById('expensesDeepOcrToggle');
    if (expDeepToggle) {
      expDeepToggle.checked = localStorage.getItem(CONFIG_KEYS.DEEP_OCR_EXPENSES) === 'true';
      expDeepToggle.addEventListener('change', (e) => {
        localStorage.setItem(CONFIG_KEYS.DEEP_OCR_EXPENSES, e.target.checked);
        if (e.target.checked) {
          showToast('Modo Alta Precisión activado: Se usará Gemini 3.7 Flash para gastos.', 'info');
        }
      });
    }

    // Auto sync with Google Sheets on load if online
    if (state.isAuthenticated && getAppsScriptUrl()) {
      fetchCloudData(false);
    }
  } catch (err) {
    console.error('Error during initApp:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Auto sync when tab regains focus or visibility (multi-device real-time sync)
window.addEventListener('focus', () => {
  const elapsedSinceLocalAction = Date.now() - (state.lastLocalActionTime || 0);
  if (state.isAuthenticated && getAppsScriptUrl() && !state.isSyncing && elapsedSinceLocalAction > 8000) {
    fetchCloudData(false);
  }
});

document.addEventListener('visibilitychange', () => {
  const elapsedSinceLocalAction = Date.now() - (state.lastLocalActionTime || 0);
  if (document.visibilityState === 'visible' && state.isAuthenticated && getAppsScriptUrl() && !state.isSyncing && elapsedSinceLocalAction > 8000) {
    fetchCloudData(false);
  }
});

// Background refresh every 60 seconds for active multi-device sync
setInterval(() => {
  const elapsedSinceLocalAction = Date.now() - (state.lastLocalActionTime || 0);
  if (state.isAuthenticated && getAppsScriptUrl() && !state.isSyncing && elapsedSinceLocalAction > 8000) {
    fetchCloudData(false);
  }
}, 60000);

function initIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' :
                  type === 'error' ? 'bg-red-950/90 border-red-500/50 text-red-200' :
                  type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-200' :
                  'bg-slate-900/90 border-slate-700 text-slate-200';

  toast.className = `px-4 py-3 rounded-xl border shadow-xl text-xs font-medium backdrop-blur-md flex items-center gap-2.5 pointer-events-auto transition-all transform duration-300 translate-y-2 opacity-0 ${bgClass}`;
  
  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
  
  container.appendChild(toast);
  initIcons();

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// =============================================================================
// 3. AUTENTICACIÓN Y SESIÓN
// =============================================================================
function checkAuth() {
  const isAuth = localStorage.getItem(CONFIG_KEYS.SESSION) === 'true' || localStorage.getItem('impexsalas_session_v1') === 'true';
  state.isAuthenticated = isAuth;

  const loginSection = document.getElementById('loginSection');
  if (isAuth) {
    loginSection.classList.add('hidden');
    renderCurrentModule();
  } else {
    loginSection.classList.remove('hidden');
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const user = (document.getElementById('loginUsername').value || '').trim().toUpperCase();
  const pass = (document.getElementById('loginPassword').value || '').trim();
  const errorEl = document.getElementById('loginError');

  const validUsers = ['IMPEXSALAS', 'SALAS', 'AGRICARL', 'ADMIN'];
  const validPass = ['impexsalas', 'IMPEXSALAS', 'lozada105', 'llauri1992', 'admin', 'salas2026'];

  if (validUsers.includes(user) && validPass.includes(pass)) {
    localStorage.setItem(CONFIG_KEYS.SESSION, 'true');
    state.isAuthenticated = true;
    errorEl.classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    showToast(`Bienvenido a ${getCompanyName()}`, 'success');
    renderCurrentModule();
    if (getAppsScriptUrl()) {
      triggerCloudSync(false);
    }
  } else {
    errorEl.classList.remove('hidden');
    document.getElementById('loginErrorMessage').textContent = 'Usuario o contraseña incorrectos.';
  }
}

function toggleLoginPassword() {
  const input = document.getElementById('loginPassword');
  const eye = document.getElementById('loginPasswordEye');
  if (input.type === 'password') {
    input.type = 'text';
    eye.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    eye.setAttribute('data-lucide', 'eye');
  }
  initIcons();
}

function handleLogout() {
  localStorage.removeItem(CONFIG_KEYS.SESSION);
  localStorage.removeItem('impexsalas_session_v1');
  state.isAuthenticated = false;
  document.getElementById('loginSection').classList.remove('hidden');
  document.getElementById('loginPassword').value = '';
  showToast('Sesión cerrada correctamente.', 'info');
}

// =============================================================================
// 4. CONFIGURACIÓN Y SINCRONIZACIÓN DE GOOGLE SHEETS & DRIVE
// =============================================================================
function getCompanyName() {
  const stored = localStorage.getItem(CONFIG_KEYS.COMPANY_NAME);
  if (stored && (stored === 'AGRICARL PERU S.A.C.' || stored === 'AGRICARL S.A.C.')) {
    localStorage.setItem(CONFIG_KEYS.COMPANY_NAME, DEFAULTS.COMPANY_NAME);
    return DEFAULTS.COMPANY_NAME;
  }
  return stored || DEFAULTS.COMPANY_NAME;
}

function getCompanyRuc() {
  const stored = localStorage.getItem(CONFIG_KEYS.COMPANY_RUC);
  if (!stored || stored === '20611291001' || stored === '20600000000') {
    localStorage.setItem(CONFIG_KEYS.COMPANY_RUC, DEFAULTS.COMPANY_RUC);
    return DEFAULTS.COMPANY_RUC;
  }
  return stored;
}

function getAppsScriptUrl() {
  const stored = localStorage.getItem(CONFIG_KEYS.APPSCRIPT_URL);
  if (stored && (
    stored.includes('AKfycbwHkiwyIThvFw1MUC1in6bbZV_J1NsDmE58cYIb_o3T9t1LZQjFeMQ4ZymwJz0YQNg') ||
    stored.includes('AKfycbyVVOF4yR8IYaMs3F9g8NySEIkeq3pZoTfoYmnoIyFS6daDjhBcN9QUMFqvTGYQUPOB') ||
    stored.includes('1IuGQDB_ytXcoaGwUp9jsLrDG3vA3joS1w7BxNMV7b0JUUMcvX7B39Rwb') ||
    stored.includes('AKfycbx_L3B-8W6NHzRy_RQathPe9WsqGXMzqBRzApywrnnnKKr8Zchj7Xsw6dXKgVQ8LyOUnA')
  )) {
    localStorage.setItem(CONFIG_KEYS.APPSCRIPT_URL, DEFAULTS.APPSCRIPT_URL);
    return DEFAULTS.APPSCRIPT_URL;
  }
  return stored || DEFAULTS.APPSCRIPT_URL;
}

function getSpreadsheetUrl() {
  const stored = localStorage.getItem(CONFIG_KEYS.SPREADSHEET_URL);
  if (stored && (
    stored.includes('19pKLOY12-LjG9CFHG-zlZ0fbX669fWxSJYQBZkdOmMI') ||
    stored.includes('126ZvjGVlEvPpMdZ4mZ-s-oeoBbjo3Vwy97wMtZeip0w') ||
    stored.includes('1R-nZ5rWFSrXLVblGdvToJ0au-l4r3DA2XLjVc0xHw4c') ||
    stored.includes('1dl58unxL0YfpyP3livdCpSLmYRoL4uvMsW8ip-hU3tc')
  )) {
    localStorage.setItem(CONFIG_KEYS.SPREADSHEET_URL, DEFAULTS.SPREADSHEET_URL);
    return DEFAULTS.SPREADSHEET_URL;
  }
  return stored || DEFAULTS.SPREADSHEET_URL;
}

function getDriveFolderId() {
  const stored = localStorage.getItem(CONFIG_KEYS.DRIVE_FOLDER_ID);
  if (
    !stored ||
    stored === '1e-YdQS3w3KsYWhX_JR0qQpO4FAs45A73' ||
    stored === '1e2ppxGA0EL38C-9aUhDLmtAIRJLRSnLV' ||
    stored === '1rsRjOifDCXQzkDiV0mD18CX4yntgIjRN' ||
    stored === '1S192VmTYb2jidhivUtu6AXzSgKg2471Q' ||
    stored === '1tz8reRLZs8yABCykbQIprVK9R7Rbc6Dd' ||
    stored === '1HH8LFBN56MHLu8xH3UztXvln9JH6CFhW'
  ) {
    localStorage.setItem(CONFIG_KEYS.DRIVE_FOLDER_ID, DEFAULTS.DRIVE_FOLDER_ID);
    return DEFAULTS.DRIVE_FOLDER_ID;
  }
  return stored;
}

function loadStoredSettings() {
  const company = getCompanyName();
  const ruc = getCompanyRuc();
  
  const compDisplay = document.getElementById('loginCompanyDisplay');
  if (compDisplay) {
    compDisplay.innerHTML = `<span class="text-yellow-400 font-bold tracking-wide">${company}</span>`;
  }

  const compFooter = document.getElementById('loginFooterCompany');
  if (compFooter) {
    compFooter.innerHTML = `<span class="text-yellow-400 font-bold">${company}</span>`;
  }

  const headerTitle = document.getElementById('headerCompanyTitle');
  if (headerTitle) {
    headerTitle.innerHTML = `<span class="text-yellow-400 font-bold">${company}</span> &bull; <span class="text-slate-500">RUC ${ruc}</span>`;
  }

  const driveBtn = document.getElementById('headerDriveBtn');
  if (driveBtn) {
    driveBtn.href = `https://drive.google.com/drive/folders/${getDriveFolderId()}?usp=sharing`;
  }

  const sheetsBtn = document.getElementById('headerSheetsBtn');
  if (sheetsBtn) {
    sheetsBtn.href = getSpreadsheetUrl();
  }

  const mobileSheetsBtn = document.getElementById('headerMobileSheetsBtn');
  if (mobileSheetsBtn) {
    mobileSheetsBtn.href = getSpreadsheetUrl();
  }
}

function openConfigModal() {
  document.getElementById('cfgInputCompanyName').value = getCompanyName();
  document.getElementById('cfgInputCompanyRuc').value = getCompanyRuc();
  document.getElementById('cfgInputAppScriptUrl').value = getAppsScriptUrl();
  document.getElementById('cfgInputSpreadsheetUrl').value = getSpreadsheetUrl();
  document.getElementById('cfgInputDriveFolderId').value = getDriveFolderId();
  
  // Set Apps Script code
  document.getElementById('appsScriptCodePre').textContent = generateAppsScriptCode();

  document.getElementById('configModal').classList.remove('hidden');
  switchConfigTab('sheets');
  initIcons();
}

function closeConfigModal() {
  document.getElementById('configModal').classList.add('hidden');
}

function switchConfigTab(tab) {
  const sheetsBtn = document.getElementById('cfgTabBtnSheets');
  const scriptBtn = document.getElementById('cfgTabBtnScript');
  const guideBtn = document.getElementById('cfgTabBtnGuide');

  const sheetsContent = document.getElementById('cfgTabContentSheets');
  const scriptContent = document.getElementById('cfgTabContentScript');
  const guideContent = document.getElementById('cfgTabContentGuide');

  [sheetsBtn, scriptBtn, guideBtn].forEach(btn => {
    btn.className = 'px-3 py-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer';
  });
  [sheetsContent, scriptContent, guideContent].forEach(c => c.classList.add('hidden'));

  if (tab === 'sheets') {
    sheetsBtn.className = 'px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg cursor-pointer';
    sheetsContent.classList.remove('hidden');
  } else if (tab === 'script') {
    scriptBtn.className = 'px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg cursor-pointer';
    scriptContent.classList.remove('hidden');
  } else if (tab === 'guide') {
    guideBtn.className = 'px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg cursor-pointer';
    guideContent.classList.remove('hidden');
  }
}

function saveCloudConfig() {
  const company = document.getElementById('cfgInputCompanyName').value.trim() || DEFAULTS.COMPANY_NAME;
  const ruc = document.getElementById('cfgInputCompanyRuc').value.trim() || DEFAULTS.COMPANY_RUC;
  const scriptUrl = document.getElementById('cfgInputAppScriptUrl').value.trim() || DEFAULTS.APPSCRIPT_URL;
  const sheetUrl = document.getElementById('cfgInputSpreadsheetUrl').value.trim() || DEFAULTS.SPREADSHEET_URL;
  const driveId = document.getElementById('cfgInputDriveFolderId').value.trim() || DEFAULTS.DRIVE_FOLDER_ID;

  localStorage.setItem(CONFIG_KEYS.COMPANY_NAME, company);
  localStorage.setItem(CONFIG_KEYS.COMPANY_RUC, ruc);
  localStorage.setItem(CONFIG_KEYS.APPSCRIPT_URL, scriptUrl);
  localStorage.setItem(CONFIG_KEYS.SPREADSHEET_URL, sheetUrl);
  localStorage.setItem(CONFIG_KEYS.DRIVE_FOLDER_ID, driveId);

  loadStoredSettings();
  closeConfigModal();
  showToast('Configuración guardada correctamente.', 'success');
  triggerCloudSync(true);
}

function copyAppsScriptCode() {
  const code = generateAppsScriptCode();
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btnCopyScriptText');
    btn.textContent = '¡Copiado!';
    showToast('Código Apps Script copiado al portapapeles.', 'success');
    setTimeout(() => { btn.textContent = 'Copiar Código'; }, 2000);
  });
}

function generateAppsScriptCode() {
  const company = getCompanyName();
  const rootId = getDriveFolderId();
  return `/**
 * GOOGLE APPS SCRIPT - BASE DE DATOS & GESTOR DE ARCHIVOS DRIVE
 * Empresa: ${company}
 * Copia y pega este código en Extensiones > Apps Script de tu Google Sheets.
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

    // 1. Subida directa de comprobante a Google Drive
    if (action === "upload_voucher" && postData) {
      output = handleVoucherUpload(postData);
      return ContentService.createTextOutput(JSON.stringify(output))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var salesSheet = getOrCreateSheet(ss, "Ventas", getSalesHeaders(), "#059669");
    var expensesSheet = getOrCreateSheet(ss, "Gastos", getExpensesHeaders(), "#0284C7");
    var configSheet = getOrCreateConfigSheet(ss, "Configuracion_Conexion");

    // 2. Acción: Guardar/Sincronizar datos enviados desde el aplicativo
    if (action === "sync" && postData) {
      if (postData.sales && Array.isArray(postData.sales)) {
        saveSheetData(salesSheet, postData.sales, getSalesHeaders(), getSalesKeyMapping());
      }
      if (postData.expenses && Array.isArray(postData.expenses)) {
        saveSheetData(expensesSheet, postData.expenses, getExpensesHeaders(), getExpensesKeyMapping());
      }
      if (postData.config) {
        saveConfigData(configSheet, postData.config);
      }
      SpreadsheetApp.flush();
      output = { 
        success: true, 
        message: "Base de datos en Google Sheets actualizada correctamente",
        salesCount: postData.sales ? postData.sales.length : 0,
        expensesCount: postData.expenses ? postData.expenses.length : 0,
        timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
      };
    } 
    // 3. Acción: Cargar datos desde Google Sheets al aplicativo
    else {
      var sales = loadSheetData(salesSheet, getSalesKeyMapping());
      var expenses = loadSheetData(expensesSheet, getExpensesKeyMapping());
      var configData = loadConfigData(configSheet);
      output = { 
        success: true, 
        sales: sales, 
        expenses: expenses, 
        config: configData,
        timestamp: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")
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
  var folderType = data.folderType || "Ventas";
  var monthYear = data.monthYear || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM");
  var fileName = data.fileName || ("Comprobante_" + Date.now());
  var mimeType = data.mimeType || "application/pdf";
  var base64Data = data.fileBase64;

  if (!base64Data) return { success: false, error: "Faltan datos base64 del archivo" };

  var rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(rootId);
  } catch (e) {
    rootFolder = DriveApp.getRootFolder();
  }

  var moduleFolder = getOrCreateSubFolder(rootFolder, folderType);
  var monthFolder = getOrCreateSubFolder(moduleFolder, monthYear);

  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, mimeType, fileName);
  var file = monthFolder.createFile(blob);

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

function getOrCreateSubFolder(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(folderName);
}

function getOrCreateSheet(ss, sheetName, headers, headerColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground(headerColor || "#059669");
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function getOrCreateConfigSheet(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var headers = ["Parámetro de Configuración", "Valor Registrado", "Descripción / Notas", "Última Actualización"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0F172A");
  headerRange.setFontColor("#38BDF8");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function saveConfigData(sheet, cfg) {
  var now = cfg.syncTimestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var rows = [
    ["Empresa / Organización", cfg.company || COMPANY_NAME, "Razón Social registrada", now],
    ["RUC de la Empresa", cfg.companyRuc || "20608512345", "RUC de la empresa", now],
    ["URL Google Apps Script (Web App)", cfg.appScriptUrl || "", "Motor API de enlace", now],
    ["Enlace Hoja Google Sheets", cfg.spreadsheetUrl || "", "Hoja de cálculo en la nube", now],
    ["ID Carpeta Principal Drive", cfg.driveFolderId || DRIVE_ROOT_FOLDER_ID, "Carpeta raíz de comprobantes", now]
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
    if (key) config[key] = values[i][1];
  }
  return config;
}

function getSalesHeaders() {
  return ["Enlace Comprobante Drive", "Fecha Emisión", "Fecha Vencimiento", "Cliente / Razón Social", "RUC / DNI Cliente", "Tipo Comprobante", "Serie", "Número Correlativo", "Concepto / Descripción", "Base Imponible (S/)", "IGV (18%) (S/)", "Monto Total (S/)", "% Detracción", "Monto Detracción (S/)", "Neto a Cobrar (S/)", "Costo de Ventas (S/)", "Forma de Pago", "ID Comprobante"];
}

function getSalesKeyMapping() {
  return [
    { key: "fileUrl", label: "Enlace Comprobante Drive" },
    { key: "date", label: "Fecha Emisión" },
    { key: "dueDate", label: "Fecha Vencimiento" },
    { key: "clientName", label: "Cliente / Razón Social" },
    { key: "clientDocNumber", label: "RUC / DNI Cliente" },
    { key: "type", label: "Tipo Comprobante" },
    { key: "series", label: "Serie" },
    { key: "number", label: "Número Correlativo" },
    { key: "concept", label: "Concepto / Descripción" },
    { key: "base", label: "Base Imponible (S/)" },
    { key: "igv", label: "IGV (18%) (S/)" },
    { key: "total", label: "Monto Total (S/)" },
    { key: "detractionRate", label: "% Detracción" },
    { key: "detractionAmount", label: "Monto Detracción (S/)" },
    { key: "netPay", label: "Neto a Cobrar (S/)" },
    { key: "cost", label: "Costo de Ventas (S/)" },
    { key: "paymentMethod", label: "Forma de Pago" },
    { key: "id", label: "ID Comprobante" }
  ];
}

function getExpensesHeaders() {
  return ["Enlace Comprobante Drive", "Categoría Gasto", "Fecha Emisión", "Fecha Vencimiento", "Proveedor / Razón Social", "RUC / DNI Proveedor", "Tipo Comprobante", "Serie", "Número Correlativo", "Concepto / Descripción", "Base Imponible (S/)", "IGV (18%) (S/)", "Monto Total (S/)", "% Detracción", "Monto Detracción (S/)", "Retención 4ta (S/)", "Neto a Pagar (S/)", "Forma de Pago", "ID Comprobante"];
}

function getExpensesKeyMapping() {
  return [
    { key: "fileUrl", label: "Enlace Comprobante Drive" },
    { key: "expenseCategory", label: "Categoría Gasto" },
    { key: "date", label: "Fecha Emisión" },
    { key: "dueDate", label: "Fecha Vencimiento" },
    { key: "supplierName", label: "Proveedor / Razón Social" },
    { key: "supplierDocNumber", label: "RUC / DNI Proveedor" },
    { key: "type", label: "Tipo Comprobante" },
    { key: "series", label: "Serie" },
    { key: "number", label: "Número Correlativo" },
    { key: "concept", label: "Concepto / Descripción" },
    { key: "base", label: "Base Imponible (S/)" },
    { key: "igv", label: "IGV (18%) (S/)" },
    { key: "total", label: "Monto Total (S/)" },
    { key: "detractionRate", label: "% Detracción" },
    { key: "detractionAmount", label: "Monto Detracción (S/)" },
    { key: "retention4th", label: "Retención 4ta (S/)" },
    { key: "netPay", label: "Neto a Pagar (S/)" },
    { key: "paymentMethod", label: "Forma de Pago" },
    { key: "id", label: "ID Comprobante" }
  ];
}

function saveSheetData(sheet, items, headers, keyMapping) {
  var maxRows = Math.max(sheet.getMaxRows(), sheet.getLastRow(), 2);
  var maxCols = Math.max(sheet.getMaxColumns(), sheet.getLastColumn(), headers.length, 1);
  if (maxRows > 1) {
    sheet.getRange(2, 1, maxRows - 1, maxCols).clearContent();
  }
  if (!items || items.length === 0) return;

  var rows = [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var row = [];
    for (var j = 0; j < keyMapping.length; j++) {
      var val = item[keyMapping[j].key];
      row.push(val !== undefined && val !== null ? val : "");
    }
    rows.push(row);
  }
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function loadSheetData(sheet, keyMapping) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var items = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var hasContent = false;
    for (var c = 0; c < row.length; c++) {
      if (row[c] !== "" && row[c] !== null && row[c] !== undefined) {
        hasContent = true;
        break;
      }
    }
    if (!hasContent) continue;

    var obj = {};
    for (var j = 0; j < keyMapping.length; j++) {
      var cellVal = row[j];
      if (cellVal instanceof Date) {
        cellVal = Utilities.formatDate(cellVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      obj[keyMapping[j].key] = cellVal;
    }
    if (!obj.id || String(obj.id).trim() === "") {
      obj.id = "sheet_" + (i + 1) + "_" + (obj.series || "F") + "_" + (obj.number || i);
    }
    items.push(obj);
  }
  return items;
}
`;
}

// =============================================================================
// 5. SINCRONIZACIÓN BIDIRECCIONAL CON GOOGLE SHEETS & DRIVE (NATIVE FETCH)
// =============================================================================

/**
 * 1. PULL / FETCH: Carga los datos maestros desde Google Sheets hacia la app
 */
async function fetchCloudData(showToastMsg = false) {
  const url = getAppsScriptUrl();
  if (!url || !url.startsWith('https://script.google.com/')) {
    if (showToastMsg) showToast('Configura la URL de Apps Script en Configuración.', 'warning');
    return;
  }

  if (state.isSyncing) return;
  state.isSyncing = true;
  updateSyncIndicator(true, 'Cargando de Sheets...');

  try {
    let data = null;

    // 1. Intentar por el proxy del backend
    try {
      const proxyRes = await fetch(`/api/google-apps-script/load?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) {
        data = await proxyRes.json();
      }
    } catch (proxyErr) {
      console.warn('Proxy de carga no disponible, intentando directo:', proxyErr);
    }

    // 2. Intentar directo si el proxy no retornó datos válidos
    if (!data || !data.success) {
      const res = await fetch(`${url}?action=load&_t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow'
      });
      if (res.ok) {
        data = await res.json();
      }
    }

    if (data && data.success) {
        const cloudSales = Array.isArray(data.sales)
          ? data.sales.filter(s => s && (Number(s.total) > 0 || s.clientName || s.number || s.id))
          : [];
        const cloudExpenses = Array.isArray(data.expenses)
          ? data.expenses.filter(e => e && (Number(e.total) > 0 || e.supplierName || e.number || e.id))
          : [];

        cloudSales.forEach((s, idx) => {
          if (!s.id) s.id = `sale_sheet_${s.series || 'F'}_${s.number || idx}_${s.date || ''}_${idx}`;
        });
        cloudExpenses.forEach((e, idx) => {
          if (!e.id) e.id = `exp_sheet_${e.series || 'F'}_${e.number || idx}_${e.date || ''}_${idx}`;
        });

        // Proteger únicamente los comprobantes recién creados/editados localmente en los últimos 10 segundos
        // para evitar que se pierdan si se dispara una recarga mientras viaja el guardado
        const recentThreshold = 10000;
        const nowTs = Date.now();

        const pendingLocalSales = state.sales.filter(s =>
          s && s._localUpdatedAt && (nowTs - s._localUpdatedAt < recentThreshold) &&
          !cloudSales.some(cs => cs.id === s.id || (cs.series === s.series && cs.number === s.number && cs.type === s.type && cs.date === s.date))
        );

        const pendingLocalExpenses = state.expenses.filter(e =>
          e && e._localUpdatedAt && (nowTs - e._localUpdatedAt < recentThreshold) &&
          !cloudExpenses.some(ce => ce.id === e.id || (ce.series === e.series && ce.number === e.number && ce.type === e.type && ce.date === e.date))
        );

        // Si se eliminó una fila directamente en Google Sheets, se refleja inmediatamente en el aplicativo
        state.sales = [...pendingLocalSales, ...cloudSales];
        state.expenses = [...pendingLocalExpenses, ...cloudExpenses];

        // Ordenar cronológicamente descendente
        state.sales.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        state.expenses.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        // Limpiar selecciones de elementos que ya no existen
        const currentSaleIdSet = new Set(state.sales.map(s => s.id));
        state.selectedSaleIds = new Set([...state.selectedSaleIds].filter(id => currentSaleIdSet.has(id)));

        const currentExpenseIdSet = new Set(state.expenses.map(e => e.id));
        state.selectedExpenseIds = new Set([...state.selectedExpenseIds].filter(id => currentExpenseIdSet.has(id)));

        saveSalesLocal();
        saveExpensesLocal();

        const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
        state.lastSyncTime = now;
        localStorage.setItem(CONFIG_KEYS.LAST_SYNC, now);
        updateSyncIndicator(false, now);

        if (showToastMsg) {
          showToast(`Datos sincronizados desde Google Sheets (${state.sales.length} ventas, ${state.expenses.length} gastos).`, 'success');
        }
        renderCurrentModule();

        if (pendingLocalSales.length > 0 || pendingLocalExpenses.length > 0) {
          setTimeout(() => pushCloudData(false), 200);
        }
      } else {
        throw new Error((data && data.error) || 'Respuesta inválida de Apps Script');
      }
  } catch (err) {
    console.warn('Error al obtener datos de Google Sheets:', err);
    updateSyncIndicator(false, state.lastSyncTime, true);
    if (showToastMsg) {
      showToast('No se pudo conectar a Google Sheets. Mostrando datos locales en caché.', 'warning');
    }
  } finally {
    state.isSyncing = false;
    if (state.pendingPush) {
      state.pendingPush = false;
      setTimeout(() => pushCloudData(false), 100);
    }
  }
}

/**
 * 2. PUSH / SYNC: Envía el estado actual (creación, edición o eliminación) a Google Sheets
 */
async function pushCloudData(showToastMsg = false) {
  const url = getAppsScriptUrl();
  if (!url || !url.startsWith('https://script.google.com/')) {
    if (showToastMsg) showToast('Configura la URL de Apps Script para guardar en la nube.', 'warning');
    return;
  }

  if (state.isSyncing) {
    state.pendingPush = true;
    return;
  }
  state.isSyncing = true;
  updateSyncIndicator(true, 'Guardando en Sheets...');

  try {
    const payload = {
      action: 'sync',
      sales: state.sales,
      expenses: state.expenses,
      config: {
        company: getCompanyName(),
        companyRuc: getCompanyRuc(),
        appScriptUrl: url,
        spreadsheetUrl: getSpreadsheetUrl(),
        driveFolderId: getDriveFolderId(),
        syncTimestamp: new Date().toLocaleString('es-PE')
      }
    };

    let syncSuccess = false;

    // 1. Intentar a través del proxy del backend
    try {
      const proxyRes = await fetch('/api/google-apps-script/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, payload })
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && data.success) syncSuccess = true;
      }
    } catch (proxyErr) {
      console.warn('Proxy de sincronización no disponible, intentando directo:', proxyErr);
    }

    // 2. Intentar directo si el proxy no tuvo éxito
    if (!syncSuccess) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      if (response.ok) {
        syncSuccess = true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }

    if (syncSuccess) {
      const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      state.lastSyncTime = now;
      localStorage.setItem(CONFIG_KEYS.LAST_SYNC, now);
      updateSyncIndicator(false, now);
      if (showToastMsg) {
        showToast('Cambios guardados en Google Sheets con éxito.', 'success');
      }
    } else {
      throw new Error('No se pudo confirmar guardado');
    }
  } catch (err) {
    console.warn('Error al guardar en Google Sheets:', err);
    updateSyncIndicator(false, state.lastSyncTime, true);
    if (showToastMsg) {
      showToast('Guardado localmente. Se sincronizará con Google Sheets al reconectar.', 'warning');
    }
  } finally {
    state.isSyncing = false;
    if (state.pendingPush) {
      state.pendingPush = false;
      setTimeout(() => pushCloudData(false), 200);
    }
  }
}

/**
 * Disparador de sincronización manual del botón
 */
async function triggerCloudSync(showToastMsg = true) {
  await fetchCloudData(showToastMsg);
}

function updateSyncIndicator(isLoading, customTextOrTime, isError = false) {
  const icon = document.getElementById('syncIcon');
  const statusText = document.getElementById('syncStatusText');
  const timeText = document.getElementById('lastSyncTimeText');

  if (icon) {
    if (isLoading) {
      icon.classList.add('animate-spin');
      if (statusText) statusText.textContent = typeof customTextOrTime === 'string' && customTextOrTime.includes('...') ? customTextOrTime : 'Sincronizando...';
    } else {
      icon.classList.remove('animate-spin');
      if (statusText) {
        statusText.textContent = isError ? 'Modo Local' : 'Conectado a Sheets';
        statusText.className = isError ? 'text-amber-400' : 'text-emerald-400';
      }
    }
  }

  if (timeText && !isLoading && customTextOrTime) {
    timeText.textContent = customTextOrTime;
  }
}

async function testCloudConnection() {
  const url = document.getElementById('cfgInputAppScriptUrl').value.trim();
  if (!url || !url.startsWith('https://script.google.com/')) {
    showToast('Ingresa una URL válida de Apps Script.', 'error');
    return;
  }

  showToast('Probando conexión con Google Apps Script...', 'info');
  try {
    let data = null;
    try {
      const proxyRes = await fetch(`/api/google-apps-script/load?url=${encodeURIComponent(url)}`);
      if (proxyRes.ok) data = await proxyRes.json();
    } catch {}

    if (!data || !data.success) {
      const res = await fetch(`${url}?action=load&_t=${Date.now()}`, { method: 'GET', redirect: 'follow' });
      if (res.ok) data = await res.json();
    }

    if (data && data.success) {
      showToast('¡Conexión exitosa con Google Sheets!', 'success');
    } else {
      showToast('Respuesta recibida pero sin formato válido.', 'warning');
    }
  } catch (e) {
    showToast('No se pudo conectar. Verifica que la App Web tenga acceso "Cualquier persona".', 'error');
  }
}

// Subida de Comprobante a Google Drive
async function uploadVoucherToDrive(fileBase64, fileName, mimeType, folderType, monthYear) {
  const url = getAppsScriptUrl();
  const parentFolderId = getDriveFolderId();

  if (!url || !url.startsWith('https://script.google.com/')) {
    return { success: false, error: 'Google Apps Script no configurado.' };
  }

  const payload = {
    action: 'upload_voucher',
    parentFolderId,
    folderType,
    monthYear,
    fileName,
    mimeType,
    fileBase64
  };

  // 1. Intentar a través del proxy del backend (resuelve restricciones de iframe/CORS de forma transparente)
  try {
    const proxyRes = await fetch('/api/google-apps-script/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, payload })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.success) {
        return data;
      } else if (data && data.error) {
        return { success: false, error: data.error };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy de subida a Drive no disponible, intentando directo:', proxyErr);
  }

  // 2. Respaldo directo en caso de modo cliente puro
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn('Advertencia en subida directa a Drive:', err);
    return { success: false, error: err.message || 'Error de conexión con Drive' };
  }
}

// =============================================================================
// 6. GEMINI AI CLIENTE NATIVO CON ROTACIÓN DE KEYS & COMPRESIÓN DE IMAGEN
// =============================================================================
function compressImageToBase64(file, maxWidth = 900, quality = 0.65) {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ base64: e.target.result.split(',')[1], mimeType: file.type });
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
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

function cleanJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    let clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(clean.substring(start, end + 1));
      }
      throw new Error('Formato JSON no reconocido devuelto por la IA');
    }
  }
}

function enforceConceptBusinessLogic(data, type = 'sale') {
  if (!data) return data;
  let itemsCount = Number(data.itemsCount) || (Array.isArray(data.itemsList) ? data.itemsList.length : 1);
  let itemsList = Array.isArray(data.itemsList) ? data.itemsList.filter(Boolean) : [];
  
  if (itemsList.length > 0) {
    itemsCount = itemsList.length;
  }

  let finalConcept = (data.concept || '').trim();

  // 1. SI el comprobante contiene exactamente 1 ítem:
  // Copia la descripción tal como figura en la factura, sin modificar, recortar ni resumir.
  // Formato: [DESCRIPCIÓN ORIGINAL DE LA FACTURA]
  if (itemsCount === 1) {
    if (itemsList.length === 1 && itemsList[0]) {
      finalConcept = itemsList[0].trim().toUpperCase();
    } else {
      finalConcept = finalConcept.toUpperCase();
    }
  } 
  // 2. SI el comprobante contiene 2 o más ítems:
  // Resume y unifica todos los productos o servicios en una sola categoría comercial o técnica general.
  // Formato: [TIPO DE OPERACIÓN] DE [CATEGORÍA GENERAL RESUMIDA]
  // Límite máximo: 80 a 100 caracteres.
  else if (itemsCount >= 2) {
    let upper = finalConcept.toUpperCase();
    const defaultPrefix = type === 'sale' ? 'VENTA DE ' : 'COMPRA DE ';
    const hasPrefix = /^(VENTA|COMPRA|ADQUISICIÓN|ADQUISICION|SERVICIO|PRESTACIÓN|PRESTACION|GASTO|SUMINISTRO|CONTRATACIÓN|CONTRATACION)\s+(DE|EN|POR)\s+/i.test(upper);
    
    if (!hasPrefix) {
      finalConcept = `${defaultPrefix}${upper}`;
    } else {
      finalConcept = upper;
    }

    if (finalConcept.length > 100) {
      finalConcept = finalConcept.substring(0, 97).trim() + '...';
    }
  }

  data.concept = finalConcept;
  return data;
}

async function analyzeVoucherWithGemini(file, type = 'sale', options = {}) {
  const isDeepOcr = options.isDeepOcr || false;
  // Optimizamos dimensiones para velocidad ultrarrápida (1-2s) sin perder legibilidad OCR
  const maxWidth = isDeepOcr ? 1300 : 950;
  const quality = isDeepOcr ? 0.78 : 0.68;
  const { base64, mimeType } = await compressImageToBase64(file, maxWidth, quality);

  const promptText = type === 'expense'
    ? `Extrae de este comprobante de pago o gasto peruano (Factura, Boleta o RxH) los datos en JSON estricto:
{
  "expenseCategory": "Mercadería / Insumos" | "Servicios Básicos (Luz/Agua)" | "Honorarios Profesionales" | "Alquileres" | "Gastos Administrativos" | "Otros Gastos",
  "type": "Factura" | "Boleta" | "RxH",
  "series": "Serie (ej: F001)",
  "number": "Número correlativo",
  "date": "YYYY-MM-DD",
  "supplierDocNumber": "RUC o DNI del emisor",
  "supplierName": "Razón Social o Nombre",
  "itemsCount": número total de ítems o líneas facturadas en el comprobante,
  "itemsList": ["descripción exacta ítem 1", "descripción exacta ítem 2"],
  "concept": "Concepto / Descripción generado estrictamente según las siguientes reglas obligatorias",
  "baseAmount": número base imponible,
  "igvAmount": número IGV,
  "totalAmount": número total,
  "detractionRate": número porcentaje detracción o 0,
  "retention4th": número retención 4ta si es RxH o 0,
  "paymentMethod": "Contado" | "Crédito"
}

REGLAS OBLIGATORIAS PARA EL CAMPO "concept" (Concepto / Descripción del comprobante):
Analiza la lista de productos o servicios del comprobante de pago y genera el Concepto / Descripción aplicando la siguiente lógica:
1. Evalúa la cantidad de ítems:
• SI el comprobante contiene exactamente 1 ítem:
  Copia la descripción tal como figura en la factura, sin modificar, recortar ni resumir.
  Formato: [DESCRIPCIÓN ORIGINAL DE LA FACTURA]
  (Ejemplo: "SILLA DE RUEDAS METÁLICA PEDIÁTRICA" o "MANTENIMIENTO PREVENTIVO DE TRACTOR")
• SI el comprobante contiene 2 o más ítems:
  Resume y unifica todos los productos o servicios en una sola categoría comercial o técnica general.
  Formato: [TIPO DE OPERACIÓN] DE [CATEGORÍA GENERAL RESUMIDA]
  (Ejemplo: "COMPRA DE SUMINISTROS DE OFICINA Y LIMPIEZA" o "SERVICIO DE MANTENIMIENTO TÉCNICO Y REPUESTOS")
  (Restricción: El Concepto / Descripción resumido debe ser claro, conciso y tener un límite máximo estricto de 80 a 100 caracteres).`
    : `Extrae de este comprobante de venta peruano (Factura, Boleta o Ticket) los datos en JSON estricto:
{
  "date": "YYYY-MM-DD",
  "clientName": "Razón Social o Nombre del cliente",
  "clientDocNumber": "RUC o DNI del cliente",
  "type": "Factura" | "Boleta" | "Ticket",
  "series": "Serie (ej: F001, B001)",
  "number": "Número correlativo",
  "itemsCount": número total de ítems o líneas facturadas en el comprobante,
  "itemsList": ["descripción exacta ítem 1", "descripción exacta ítem 2"],
  "concept": "Concepto / Descripción generado estrictamente según las siguientes reglas obligatorias",
  "baseAmount": número base imponible,
  "igvAmount": número IGV,
  "totalAmount": número total,
  "detractionRate": número porcentaje detracción o 0,
  "detractionAmount": número monto de detracción o 0,
  "netPay": número neto a cobrar,
  "paymentMethod": "Contado" | "Crédito"
}

REGLAS OBLIGATORIAS PARA EL CAMPO "concept" (Concepto / Descripción del comprobante):
Analiza la lista de productos o servicios del comprobante de pago y genera el Concepto / Descripción aplicando la siguiente lógica:
1. Evalúa la cantidad de ítems:
• SI el comprobante contiene exactamente 1 ítem:
  Copia la descripción tal como figura en la factura, sin modificar, recortar ni resumir.
  Formato: [DESCRIPCIÓN ORIGINAL DE LA FACTURA]
  (Ejemplo: "SILLA DE RUEDAS METÁLICA PEDIÁTRICA")
• SI el comprobante contiene 2 o más ítems:
  Resume y unifica todos los productos o servicios en una sola categoría comercial o técnica general.
  Formato: [TIPO DE OPERACIÓN] DE [CATEGORÍA GENERAL RESUMIDA]
  (Ejemplo: "VENTA DE EQUIPOS DE MOVILIDAD Y APOYO BIOMÉDICO")
  (Restricción: El Concepto / Descripción resumido debe ser claro, conciso y tener un límite máximo estricto de 80 a 100 caracteres).`;

  const selectedModel = isDeepOcr ? 'gemini-3.7-flash' : 'gemini-3.1-flash-lite';
  const customKey = localStorage.getItem(CONFIG_KEYS.GEMINI_API_KEY) || '';

  // 1. Primero intentar a través de la API proxy del servidor (ultra rápido)
  try {
    const res = await fetch('/api/gemini/analyze-voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: base64,
        mimeType: mimeType || 'image/jpeg',
        type,
        apiKey: customKey,
        model: selectedModel
      })
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data?.text || '{}';
      const parsed = cleanJson(rawText);
      const cleanData = enforceConceptBusinessLogic(parsed, type);
      return { aiData: cleanData, base64, mimeType };
    } else {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || '';
      if (errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('429')) {
        throw new Error('Límite de cuota de Gemini alcanzado temporalmente. Por favor espera 30-60 segundos antes de reintentar o ingresa los datos manualmente.');
      }
    }
  } catch (apiErr) {
    if (apiErr.message && apiErr.message.includes('Límite de cuota')) {
      throw apiErr;
    }
    console.warn('Server proxy attempt failed, falling back to direct API candidate models...', apiErr);
  }

  // 2. Fallback de modelos directos
  const candidateKeys = Array.from(new Set([customKey, ...DEFAULTS.GEMINI_API_KEYS])).filter(Boolean);
  const candidateModels = isDeepOcr ? DEFAULTS.GEMINI_MODELS_DEEP : DEFAULTS.GEMINI_MODELS_FAST;

  let lastDirectErr = null;
  for (const model of candidateModels) {
    for (const key of candidateKeys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const isThinking = model.includes('3.7') || model.includes('2.5-pro');
        const generationConfig = {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 1000
        };
        if (isThinking) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const body = {
          contents: [{
            parts: [
              { text: promptText },
              { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } }
            ]
          }],
          generationConfig
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const parsed = cleanJson(rawText);
          const cleanData = enforceConceptBusinessLogic(parsed, type);
          return { aiData: cleanData, base64, mimeType };
        } else {
          const errData = await res.json().catch(() => ({}));
          lastDirectErr = errData?.error?.message || `HTTP ${res.status}`;
          if (res.status === 429 || String(lastDirectErr).includes('quota') || String(lastDirectErr).includes('RESOURCE_EXHAUSTED')) {
            console.warn(`Quota exhausted on ${model}, trying backup key/model...`);
          }
        }
      } catch (e) {
        lastDirectErr = e.message;
        console.warn(`Gemini attempt on ${model} failed, trying next...`, e);
      }
    }
  }

  if (lastDirectErr && (String(lastDirectErr).includes('quota') || String(lastDirectErr).includes('RESOURCE_EXHAUSTED') || String(lastDirectErr).includes('429'))) {
    throw new Error('Límite de solicitudes de Gemini superado temporalmente (cuota agotada). Por favor espera 1 minuto o ingresa los datos manualmente.');
  }

  throw new Error('No se pudo procesar el comprobante con la IA. Puedes ingresar los datos manualmente en el formulario.');
}

// =============================================================================
// 7. DECODIFICADOR DE CÓDIGO QR SUNAT
// =============================================================================
function parseQrSunat(qrString) {
  if (!qrString || !qrString.includes('|')) return null;
  const parts = qrString.trim().split('|');
  if (parts.length < 6) return null;

  const typeMap = { '01': 'Factura', '03': 'Boleta', '07': 'Nota de Crédito', '08': 'Nota de Débito', 'R01': 'RxH' };

  return {
    rucEmisor: parts[0]?.trim() || '',
    type: typeMap[parts[1]?.trim()] || 'Factura',
    series: parts[2]?.trim() || 'F001',
    number: parts[3]?.trim() || '0000001',
    igv: parseFloat(parts[4]?.trim()) || 0,
    total: parseFloat(parts[5]?.trim()) || 0,
    date: parts[6]?.trim() || new Date().toISOString().split('T')[0],
    docClienteTipo: parts[7]?.trim() || '',
    docClienteNumero: parts[8]?.trim() || ''
  };
}

// =============================================================================
// 8. PERSISTENCIA LOCAL Y SINCRONIZACIÓN CON GOOGLE SHEETS
// =============================================================================
function loadLocalData() {
  try {
    const rawSales = localStorage.getItem(CONFIG_KEYS.SALES);
    const parsedSales = rawSales ? JSON.parse(rawSales) : [];
    // Clean out old mock demo items if present
    state.sales = Array.isArray(parsedSales) ? parsedSales.filter(s => !String(s.id).startsWith('sale_demo_')) : [];
  } catch {
    state.sales = [];
  }

  try {
    const rawExp = localStorage.getItem(CONFIG_KEYS.EXPENSES);
    const parsedExp = rawExp ? JSON.parse(rawExp) : [];
    // Clean out old mock demo items if present
    state.expenses = Array.isArray(parsedExp) ? parsedExp.filter(e => !String(e.id).startsWith('exp_demo_')) : [];
  } catch {
    state.expenses = [];
  }

  state.lastSyncTime = localStorage.getItem(CONFIG_KEYS.LAST_SYNC) || '';
}

function saveSalesLocal() {
  localStorage.setItem(CONFIG_KEYS.SALES, JSON.stringify(state.sales));
}

function saveExpensesLocal() {
  localStorage.setItem(CONFIG_KEYS.EXPENSES, JSON.stringify(state.expenses));
}

function getSampleSales() {
  return [];
}

function getSampleExpenses() {
  return [];
}

// =============================================================================
// 9. NAVEGACIÓN Y CONTROL DE MÓDULOS
// =============================================================================
function switchModule(moduleName) {
  state.activeModule = moduleName;
  
  const modSales = document.getElementById('moduleSales');
  const modExpenses = document.getElementById('moduleExpenses');
  const modReports = document.getElementById('moduleReports');

  const btnSales = document.getElementById('navBtnSales');
  const btnExpenses = document.getElementById('navBtnExpenses');
  const btnReports = document.getElementById('navBtnReports');

  [modSales, modExpenses, modReports].forEach(m => m.classList.add('hidden'));
  [btnSales, btnExpenses, btnReports].forEach(b => {
    b.className = 'flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white transition cursor-pointer';
  });

  if (moduleName === 'sales') {
    modSales.classList.remove('hidden');
    btnSales.className = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 transition cursor-pointer font-bold';
    renderSalesModule();
  } else if (moduleName === 'expenses') {
    modExpenses.classList.remove('hidden');
    btnExpenses.className = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white shadow-lg shadow-sky-950/50 transition cursor-pointer font-bold';
    renderExpensesModule();
  } else if (moduleName === 'reports') {
    modReports.classList.remove('hidden');
    btnReports.className = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white shadow-lg shadow-violet-950/50 transition cursor-pointer font-bold';
    renderReportsModule();
  }

  initIcons();
}

function renderCurrentModule() {
  switchModule(state.activeModule);
}

// =============================================================================
// 10. MÓDULO DE VENTAS (CONTROLADORES & VISTAS)
// =============================================================================
function switchSalesTab(tabName) {
  state.activeSalesTab = tabName;

  const tDash = document.getElementById('salesTabDashboard');
  const tScan = document.getElementById('salesTabScanner');
  const tNew = document.getElementById('salesTabNew');
  const tCust = document.getElementById('salesTabCustomers');

  const bDash = document.getElementById('tabBtnSalesDashboard');
  const bScan = document.getElementById('tabBtnSalesScanner');
  const bNew = document.getElementById('tabBtnSalesNew');
  const bCust = document.getElementById('tabBtnSalesCustomers');

  [tDash, tScan, tNew, tCust].forEach(t => t.classList.add('hidden'));
  [bDash, bScan, bNew, bCust].forEach(b => {
    b.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer';
  });

  if (tabName === 'dashboard') {
    tDash.classList.remove('hidden');
    bDash.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer';
    renderSalesTable();
  } else if (tabName === 'scanner') {
    tScan.classList.remove('hidden');
    bScan.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer';
  } else if (tabName === 'new-sale') {
    tNew.classList.remove('hidden');
    bNew.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer';
  } else if (tabName === 'customers') {
    tCust.classList.remove('hidden');
    bCust.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 cursor-pointer';
    renderCustomersTable();
  }
  initIcons();
}

function renderSalesModule() {
  switchSalesTab(state.activeSalesTab);
  renderSalesTable();
}

function renderSalesTable() {
  const search = (document.getElementById('salesFilterSearch')?.value || '').toLowerCase();
  const year = document.getElementById('salesFilterYear')?.value || 'ALL';
  const month = document.getElementById('salesFilterMonth')?.value || 'ALL';
  const type = document.getElementById('salesFilterType')?.value || 'ALL';

  const filtered = state.sales.filter(item => {
    const sDate = item.date || '';
    const itemYear = sDate.substring(0, 4);
    const itemMonth = sDate.substring(5, 7);

    const matchesSearch = !search ||
      (item.clientName || '').toLowerCase().includes(search) ||
      (item.clientDocNumber || '').includes(search) ||
      (item.series || '').toLowerCase().includes(search) ||
      (item.number || '').includes(search) ||
      (item.concept || '').toLowerCase().includes(search);

    const matchesYear = year === 'ALL' || itemYear === year;
    const matchesMonth = month === 'ALL' || itemMonth === month;
    const matchesType = type === 'ALL' || item.type === type;

    return matchesSearch && matchesYear && matchesMonth && matchesType;
  });

  // Calculate KPIs
  const totalFacturado = filtered.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  const totalIgv = filtered.reduce((sum, s) => sum + (Number(s.igv) || 0), 0);
  const totalNet = filtered.reduce((sum, s) => sum + (Number(s.netPay) || Number(s.total) || 0), 0);
  const totalDetraction = filtered.reduce((sum, s) => sum + (Number(s.detractionAmount) || 0), 0);
  const withDrive = filtered.filter(s => !!s.fileUrl).length;

  document.getElementById('kpiSalesTotal').textContent = `S/ ${totalFacturado.toFixed(2)}`;
  document.getElementById('kpiSalesCount').textContent = `${filtered.length} comprobantes`;
  document.getElementById('kpiSalesIgv').textContent = `S/ ${totalIgv.toFixed(2)}`;
  document.getElementById('kpiSalesNet').textContent = `S/ ${totalNet.toFixed(2)}`;
  document.getElementById('kpiSalesDetraction').textContent = `S/ ${totalDetraction.toFixed(2)}`;
  document.getElementById('kpiSalesDriveCount').textContent = `${withDrive} / ${filtered.length}`;

  const tbody = document.getElementById('salesTableBody');
  const emptyState = document.getElementById('salesEmptyState');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateSalesBulkActionBar();
    const selectAllEl = document.getElementById('salesSelectAll');
    if (selectAllEl) selectAllEl.checked = false;
    return;
  }
  emptyState.classList.add('hidden');

  const allFilteredSelected = filtered.length > 0 && filtered.every(item => state.selectedSaleIds.has(item.id));
  const selectAllEl = document.getElementById('salesSelectAll');
  if (selectAllEl) selectAllEl.checked = allFilteredSelected;

  tbody.innerHTML = filtered.map(item => {
    const isSelected = state.selectedSaleIds.has(item.id);
    return `
    <tr class="hover:bg-slate-800/40 transition ${isSelected ? 'bg-emerald-950/30' : ''}">
      <td class="py-3 px-3 text-center" onclick="event.stopPropagation()">
        <input
          type="checkbox"
          data-id="${item.id}"
          ${isSelected ? 'checked' : ''}
          onchange="toggleSelectSale('${item.id}', this.checked)"
          class="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
        />
      </td>
      <td class="py-3 px-3 text-center">
        ${item.fileUrl ? `
          <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-teal-400 hover:text-teal-300 transition" title="Ver en Google Drive">
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        ` : `
          <span class="text-slate-600" title="Sin archivo"><i data-lucide="cloud-off" class="w-4 h-4 inline"></i></span>
        `}
      </td>
      <td class="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">${item.date || '-'}</td>
      <td class="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">${item.clientDocNumber || '-'}</td>
      <td class="py-3 px-3">
        <p class="font-semibold text-white truncate max-w-[180px]" title="${item.clientName || ''}">${item.clientName || 'Cliente Varios'}</p>
      </td>
      <td class="py-3 px-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'Factura' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-300'}">
          ${item.type || 'Factura'}
        </span>
      </td>
      <td class="py-3 px-3 text-center font-mono text-slate-300 font-semibold whitespace-nowrap">${item.series || 'F001'}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-300 whitespace-nowrap">${item.number || '000001'}</td>
      <td class="py-3 px-3 text-slate-300 truncate max-w-[180px]" title="${item.concept || ''}">${item.concept || '-'}</td>
      <td class="py-3 px-3 text-right font-mono text-slate-400">S/ ${(Number(item.base) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono text-sky-400">S/ ${(Number(item.igv) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-white">S/ ${(Number(item.total) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono text-indigo-400">S/ ${(Number(item.detractionAmount) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-amber-400">S/ ${(Number(item.netPay) || Number(item.total) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-center whitespace-nowrap">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="editSale('${item.id}')" class="p-1.5 text-slate-400 hover:text-emerald-400 transition cursor-pointer" title="Editar">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="confirmDeleteSale('${item.id}')" class="p-1.5 text-slate-400 hover:text-red-400 transition cursor-pointer" title="Eliminar">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');

  updateSalesBulkActionBar();
  initIcons();
}

function toggleSelectSale(id, isChecked) {
  if (isChecked) {
    state.selectedSaleIds.add(id);
  } else {
    state.selectedSaleIds.delete(id);
  }
  renderSalesTable();
}

function toggleSelectAllSales(isChecked) {
  const search = (document.getElementById('salesFilterSearch')?.value || '').toLowerCase();
  const year = document.getElementById('salesFilterYear')?.value || 'ALL';
  const month = document.getElementById('salesFilterMonth')?.value || 'ALL';
  const type = document.getElementById('salesFilterType')?.value || 'ALL';

  const filtered = state.sales.filter(item => {
    const sDate = item.date || '';
    const itemYear = sDate.substring(0, 4);
    const itemMonth = sDate.substring(5, 7);

    const matchesSearch = !search ||
      (item.clientName || '').toLowerCase().includes(search) ||
      (item.clientDocNumber || '').includes(search) ||
      (item.series || '').toLowerCase().includes(search) ||
      (item.number || '').includes(search) ||
      (item.concept || '').toLowerCase().includes(search);

    const matchesYear = year === 'ALL' || itemYear === year;
    const matchesMonth = month === 'ALL' || itemMonth === month;
    const matchesType = type === 'ALL' || item.type === type;

    return matchesSearch && matchesYear && matchesMonth && matchesType;
  });

  if (isChecked) {
    filtered.forEach(item => state.selectedSaleIds.add(item.id));
  } else {
    filtered.forEach(item => state.selectedSaleIds.delete(item.id));
  }
  renderSalesTable();
}

function clearSalesSelection() {
  state.selectedSaleIds.clear();
  renderSalesTable();
}

function updateSalesBulkActionBar() {
  const bar = document.getElementById('salesBulkActionBar');
  const countEl = document.getElementById('salesBulkSelectedCount');
  const totalEl = document.getElementById('salesBulkSelectedTotal');
  if (!bar) return;

  const count = state.selectedSaleIds.size;
  if (count > 0) {
    const selectedItems = state.sales.filter(s => state.selectedSaleIds.has(s.id));
    const totalSum = selectedItems.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

    countEl.textContent = `${count} ${count === 1 ? 'venta seleccionada' : 'ventas seleccionadas'}`;
    totalEl.textContent = `Total: S/ ${totalSum.toFixed(2)}`;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function confirmBulkDeleteSales() {
  const count = state.selectedSaleIds.size;
  if (count === 0) {
    showToast('Selecciona al menos una venta para eliminar.', 'warning');
    return;
  }

  const selectedItems = state.sales.filter(s => state.selectedSaleIds.has(s.id));
  const totalSum = selectedItems.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

  state.deleteAction = () => {
    state.sales = state.sales.filter(s => !state.selectedSaleIds.has(s.id));
    state.selectedSaleIds.clear();

    saveSalesLocal();
    renderSalesTable();
    showToast(`${count} comprobantes de venta eliminados correctamente.`, 'info');
    pushCloudData(true);
  };

  document.getElementById('confirmModalMessage').textContent =
    `¿Deseas eliminar permanentemente los ${count} comprobantes de venta seleccionados por un monto total de S/ ${totalSum.toFixed(2)}? Esta acción se sincronizará con Google Sheets.`;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function handleSaleBaseChange(val) {
  const num = parseFloat(val) || 0;
  const igv = num * 0.18;
  const total = num + igv;
  document.getElementById('saleFormIgv').value = igv.toFixed(2);
  document.getElementById('saleFormTotal').value = total.toFixed(2);
  recalcSaleDetraction(total);
}

function handleSaleIgvChange(val) {
  const igv = parseFloat(val) || 0;
  const base = parseFloat(document.getElementById('saleFormBase').value) || 0;
  const total = base + igv;
  document.getElementById('saleFormTotal').value = total.toFixed(2);
  recalcSaleDetraction(total);
}

function handleSaleTotalChange(val) {
  const total = parseFloat(val) || 0;
  const base = total / 1.18;
  const igv = total - base;
  document.getElementById('saleFormBase').value = base.toFixed(2);
  document.getElementById('saleFormIgv').value = igv.toFixed(2);
  recalcSaleDetraction(total);
}

function handleSaleDetractionRateChange(val) {
  const total = parseFloat(document.getElementById('saleFormTotal').value) || 0;
  recalcSaleDetraction(total);
}

function recalcSaleDetraction(total) {
  const rate = parseFloat(document.getElementById('saleFormDetractionRate').value) || 0;
  const detAmount = total * (rate / 100);
  const net = total - detAmount;
  document.getElementById('saleFormDetractionAmount').value = detAmount > 0 ? detAmount.toFixed(2) : '0.00';
  document.getElementById('saleFormNetPay').value = (net > 0 ? net : total).toFixed(2);
}

function handleSaveSale(e) {
  e.preventDefault();
  const editId = document.getElementById('saleFormEditId').value;
  const uniqueId = editId || `sale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const saleObj = {
    id: uniqueId,
    type: document.getElementById('saleFormType').value,
    series: (document.getElementById('saleFormSeries').value || 'F001').trim().toUpperCase(),
    number: (document.getElementById('saleFormNumber').value || '0000001').trim(),
    date: document.getElementById('saleFormDate').value || new Date().toISOString().split('T')[0],
    clientDocNumber: (document.getElementById('saleFormDocNumber').value || '00000000').trim(),
    clientName: (document.getElementById('saleFormClientName').value || 'CLIENTE VARIOS').trim().toUpperCase(),
    concept: (document.getElementById('saleFormConcept').value || 'Venta de productos').trim(),
    paymentMethod: document.getElementById('saleFormPaymentMethod').value,
    base: parseFloat(document.getElementById('saleFormBase').value) || 0,
    igv: parseFloat(document.getElementById('saleFormIgv').value) || 0,
    total: parseFloat(document.getElementById('saleFormTotal').value) || 0,
    cost: parseFloat(document.getElementById('saleFormCost').value) || 0,
    detractionRate: parseFloat(document.getElementById('saleFormDetractionRate').value) || 0,
    detractionAmount: parseFloat(document.getElementById('saleFormDetractionAmount').value) || 0,
    netPay: parseFloat(document.getElementById('saleFormNetPay').value) || parseFloat(document.getElementById('saleFormTotal').value) || 0,
    fileUrl: document.getElementById('saleFormFileUrl').value || undefined,
    fileName: document.getElementById('saleFormFileName').value || undefined,
    fileDrivePath: document.getElementById('saleFormFileDrivePath').value || undefined,
    _localUpdatedAt: Date.now()
  };

  state.lastLocalActionTime = Date.now();

  if (editId) {
    state.sales = state.sales.map(s => s.id === editId ? saleObj : s);
    showToast('Comprobante de venta actualizado.', 'success');
  } else {
    // Si ya existía uno idéntico localmente, reemplazarlo, si no, agregarlo al inicio
    const existingIndex = state.sales.findIndex(s => 
      s.id === uniqueId || 
      (s.series === saleObj.series && s.number === saleObj.number && s.date === saleObj.date && s.type === saleObj.type)
    );
    if (existingIndex >= 0) {
      state.sales[existingIndex] = saleObj;
    } else {
      state.sales.unshift(saleObj);
    }
    showToast('Venta registrada con éxito.', 'success');
  }

  saveSalesLocal();
  resetSaleForm();
  switchSalesTab('dashboard');
  renderSalesTable();
  pushCloudData(true);
}

function editSale(id) {
  const item = state.sales.find(s => s.id === id);
  if (!item) return;

  document.getElementById('saleFormEditId').value = item.id;
  document.getElementById('saleFormType').value = item.type || 'Factura';
  document.getElementById('saleFormSeries').value = item.series || '';
  document.getElementById('saleFormNumber').value = item.number || '';
  document.getElementById('saleFormDate').value = item.date || '';
  document.getElementById('saleFormDocNumber').value = item.clientDocNumber || '';
  document.getElementById('saleFormClientName').value = item.clientName || '';
  document.getElementById('saleFormConcept').value = item.concept || '';
  document.getElementById('saleFormPaymentMethod').value = item.paymentMethod || 'Contado';
  document.getElementById('saleFormBase').value = item.base || '';
  document.getElementById('saleFormIgv').value = item.igv || '';
  document.getElementById('saleFormTotal').value = item.total || '';
  document.getElementById('saleFormCost').value = item.cost || '';
  document.getElementById('saleFormDetractionRate').value = item.detractionRate || '0';
  document.getElementById('saleFormDetractionAmount').value = item.detractionAmount || '0.00';
  document.getElementById('saleFormNetPay').value = item.netPay || item.total || '0.00';
  document.getElementById('saleFormFileUrl').value = item.fileUrl || '';
  document.getElementById('saleFormFileName').value = item.fileName || '';
  document.getElementById('saleFormFileDrivePath').value = item.fileDrivePath || '';

  const badge = document.getElementById('salesFormDriveBadge');
  if (item.fileUrl) {
    badge.classList.remove('hidden');
    document.getElementById('salesFormDriveText').textContent = 'Archivo Enlazado en Drive';
  } else {
    badge.classList.add('hidden');
  }

  document.getElementById('salesFormTitle').textContent = 'Editar Comprobante de Venta';
  document.getElementById('salesFormSubmitBtnLabel').textContent = 'Actualizar Comprobante';
  document.getElementById('salesNewTabLabel').textContent = 'Editar Venta';

  switchSalesTab('new-sale');
}

function resetSaleForm() {
  document.getElementById('salesForm').reset();
  document.getElementById('saleFormEditId').value = '';
  document.getElementById('saleFormFileUrl').value = '';
  document.getElementById('saleFormFileName').value = '';
  document.getElementById('saleFormFileDrivePath').value = '';
  document.getElementById('salesFormDriveBadge').classList.add('hidden');
  document.getElementById('saleFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('salesFormTitle').textContent = 'Registrar Comprobante de Venta';
  document.getElementById('salesFormSubmitBtnLabel').textContent = 'Guardar Comprobante';
  document.getElementById('salesNewTabLabel').textContent = 'Nueva Venta';
}

function confirmDeleteSale(id) {
  const item = state.sales.find(s => s.id === id);
  if (!item) return;

  state.deleteAction = () => {
    state.selectedSaleIds.delete(id);
    state.sales = state.sales.filter(s => s.id !== id);
    saveSalesLocal();
    renderSalesTable();
    showToast('Comprobante de venta eliminado.', 'info');
    pushCloudData(true);
  };

  document.getElementById('confirmModalMessage').textContent = `¿Deseas eliminar la ${item.type} ${item.series}-${item.number} de ${item.clientName}? Esta acción se sincronizará con Google Sheets.`;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function renderCustomersTable() {
  const map = {};
  state.sales.forEach(s => {
    const doc = s.clientDocNumber || '00000000';
    if (!map[doc]) {
      map[doc] = { doc, name: s.clientName || 'CLIENTE VARIOS', count: 0, total: 0 };
    }
    map[doc].count += 1;
    map[doc].total += (Number(s.total) || 0);
  });

  const list = Object.values(map).sort((a, b) => b.total - a.total);
  document.getElementById('customersCountBadge').textContent = `${list.length} Clientes`;

  const tbody = document.getElementById('customersTableBody');
  tbody.innerHTML = list.map(c => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="py-3 px-3 font-mono text-slate-400">${c.doc}</td>
      <td class="py-3 px-3 font-semibold text-white">${c.name}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-300">${c.count}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-emerald-400">S/ ${c.total.toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono text-slate-400">S/ ${(c.total / c.count).toFixed(2)}</td>
    </tr>
  `).join('');
}

// =============================================================================
// 11. MÓDULO DE GASTOS Y COMPRAS (CONTROLADORES & VISTAS)
// =============================================================================
function switchExpensesTab(tabName) {
  state.activeExpensesTab = tabName;

  const tDash = document.getElementById('expensesTabDashboard');
  const tScan = document.getElementById('expensesTabScanner');
  const tNew = document.getElementById('expensesTabNew');
  const tSupp = document.getElementById('expensesTabSuppliers');

  const bDash = document.getElementById('tabBtnExpensesDashboard');
  const bScan = document.getElementById('tabBtnExpensesScanner');
  const bNew = document.getElementById('tabBtnExpensesNew');
  const bSupp = document.getElementById('tabBtnExpensesSuppliers');

  [tDash, tScan, tNew, tSupp].forEach(t => t.classList.add('hidden'));
  [bDash, bScan, bNew, bSupp].forEach(b => {
    b.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 cursor-pointer';
  });

  if (tabName === 'dashboard') {
    tDash.classList.remove('hidden');
    bDash.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 cursor-pointer';
    renderExpensesTable();
  } else if (tabName === 'scanner') {
    tScan.classList.remove('hidden');
    bScan.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer';
  } else if (tabName === 'new-expense') {
    tNew.classList.remove('hidden');
    bNew.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 cursor-pointer';
  } else if (tabName === 'suppliers') {
    tSupp.classList.remove('hidden');
    bSupp.className = 'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer';
    renderSuppliersTable();
  }
  initIcons();
}

function renderExpensesModule() {
  switchExpensesTab(state.activeExpensesTab);
  renderExpensesTable();
}

function renderExpensesTable() {
  const search = (document.getElementById('expensesFilterSearch')?.value || '').toLowerCase();
  const category = document.getElementById('expensesFilterCategory')?.value || 'ALL';
  const year = document.getElementById('expensesFilterYear')?.value || 'ALL';
  const month = document.getElementById('expensesFilterMonth')?.value || 'ALL';

  const filtered = state.expenses.filter(item => {
    const sDate = item.date || '';
    const itemYear = sDate.substring(0, 4);
    const itemMonth = sDate.substring(5, 7);

    const matchesSearch = !search ||
      (item.supplierName || '').toLowerCase().includes(search) ||
      (item.supplierDocNumber || '').includes(search) ||
      (item.series || '').toLowerCase().includes(search) ||
      (item.number || '').includes(search) ||
      (item.concept || '').toLowerCase().includes(search);

    const matchesCat = category === 'ALL' || item.expenseCategory === category;
    const matchesYear = year === 'ALL' || itemYear === year;
    const matchesMonth = month === 'ALL' || itemMonth === month;

    return matchesSearch && matchesCat && matchesYear && matchesMonth;
  });

  const totalGastos = filtered.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
  const totalIgv = filtered.reduce((sum, e) => sum + (Number(e.igv) || 0), 0);
  const totalNet = filtered.reduce((sum, e) => sum + (Number(e.netPay) || Number(e.total) || 0), 0);
  const totalRet = filtered.reduce((sum, e) => sum + (Number(e.detractionAmount) || 0) + (Number(e.retention4th) || 0), 0);
  const withDrive = filtered.filter(e => !!e.fileUrl).length;

  document.getElementById('kpiExpensesTotal').textContent = `S/ ${totalGastos.toFixed(2)}`;
  document.getElementById('kpiExpensesCount').textContent = `${filtered.length} comprobantes`;
  document.getElementById('kpiExpensesIgv').textContent = `S/ ${totalIgv.toFixed(2)}`;
  document.getElementById('kpiExpensesNet').textContent = `S/ ${totalNet.toFixed(2)}`;
  document.getElementById('kpiExpensesDetraction').textContent = `S/ ${totalRet.toFixed(2)}`;
  document.getElementById('kpiExpensesDriveCount').textContent = `${withDrive} / ${filtered.length}`;

  const tbody = document.getElementById('expensesTableBody');
  const emptyState = document.getElementById('expensesEmptyState');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateExpensesBulkActionBar();
    const selectAllEl = document.getElementById('expensesSelectAll');
    if (selectAllEl) selectAllEl.checked = false;
    return;
  }
  emptyState.classList.add('hidden');

  const allFilteredSelected = filtered.length > 0 && filtered.every(item => state.selectedExpenseIds.has(item.id));
  const selectAllEl = document.getElementById('expensesSelectAll');
  if (selectAllEl) selectAllEl.checked = allFilteredSelected;

  tbody.innerHTML = filtered.map(item => {
    const isSelected = state.selectedExpenseIds.has(item.id);
    return `
    <tr class="hover:bg-slate-800/40 transition ${isSelected ? 'bg-sky-950/30' : ''}">
      <td class="py-3 px-3 text-center" onclick="event.stopPropagation()">
        <input
          type="checkbox"
          data-id="${item.id}"
          ${isSelected ? 'checked' : ''}
          onchange="toggleSelectExpense('${item.id}', this.checked)"
          class="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 bg-slate-900 border-slate-700 cursor-pointer"
        />
      </td>
      <td class="py-3 px-3 text-center">
        ${item.fileUrl ? `
          <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center text-teal-400 hover:text-teal-300 transition" title="Ver en Google Drive">
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        ` : `
          <span class="text-slate-600" title="Sin archivo"><i data-lucide="cloud-off" class="w-4 h-4 inline"></i></span>
        `}
      </td>
      <td class="py-3 px-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-sky-300 border border-slate-700 whitespace-nowrap">
          ${item.expenseCategory || 'Otros Gastos'}
        </span>
      </td>
      <td class="py-3 px-3 font-mono text-slate-400 whitespace-nowrap">${item.date || '-'}</td>
      <td class="py-3 px-3 font-mono text-slate-300 whitespace-nowrap">${item.supplierDocNumber || '-'}</td>
      <td class="py-3 px-3">
        <p class="font-semibold text-white truncate max-w-[180px]" title="${item.supplierName || ''}">${item.supplierName || 'Proveedor Varios'}</p>
      </td>
      <td class="py-3 px-3 whitespace-nowrap">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'RxH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'}">
          ${item.type || 'Factura'}
        </span>
      </td>
      <td class="py-3 px-3 text-center font-mono text-slate-300 font-semibold whitespace-nowrap">${item.series || 'F001'}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-300 whitespace-nowrap">${item.number || '000001'}</td>
      <td class="py-3 px-3 text-slate-300 truncate max-w-[180px]" title="${item.concept || ''}">${item.concept || '-'}</td>
      <td class="py-3 px-3 text-right font-mono text-slate-400">S/ ${(Number(item.base) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono text-emerald-400">S/ ${(Number(item.igv) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-white">S/ ${(Number(item.total) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-amber-400">S/ ${(Number(item.netPay) || Number(item.total) || 0).toFixed(2)}</td>
      <td class="py-3 px-3 text-center whitespace-nowrap">
        <div class="flex items-center justify-center gap-1.5">
          <button onclick="editExpense('${item.id}')" class="p-1.5 text-slate-400 hover:text-sky-400 transition cursor-pointer" title="Editar">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="confirmDeleteExpense('${item.id}')" class="p-1.5 text-slate-400 hover:text-red-400 transition cursor-pointer" title="Eliminar">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');

  updateExpensesBulkActionBar();
  initIcons();
}

function toggleSelectExpense(id, isChecked) {
  if (isChecked) {
    state.selectedExpenseIds.add(id);
  } else {
    state.selectedExpenseIds.delete(id);
  }
  renderExpensesTable();
}

function toggleSelectAllExpenses(isChecked) {
  const search = (document.getElementById('expensesFilterSearch')?.value || '').toLowerCase();
  const cat = document.getElementById('expensesFilterCategory')?.value || 'ALL';
  const year = document.getElementById('expensesFilterYear')?.value || 'ALL';
  const month = document.getElementById('expensesFilterMonth')?.value || 'ALL';

  const filtered = state.expenses.filter(item => {
    const sDate = item.date || '';
    const itemYear = sDate.substring(0, 4);
    const itemMonth = sDate.substring(5, 7);

    const matchesSearch = !search ||
      (item.supplierName || '').toLowerCase().includes(search) ||
      (item.supplierDocNumber || '').includes(search) ||
      (item.series || '').toLowerCase().includes(search) ||
      (item.number || '').includes(search) ||
      (item.concept || '').toLowerCase().includes(search);

    const matchesCat = cat === 'ALL' || item.expenseCategory === cat;
    const matchesYear = year === 'ALL' || itemYear === year;
    const matchesMonth = month === 'ALL' || itemMonth === month;

    return matchesSearch && matchesCat && matchesYear && matchesMonth;
  });

  if (isChecked) {
    filtered.forEach(item => state.selectedExpenseIds.add(item.id));
  } else {
    filtered.forEach(item => state.selectedExpenseIds.delete(item.id));
  }
  renderExpensesTable();
}

function clearExpensesSelection() {
  state.selectedExpenseIds.clear();
  renderExpensesTable();
}

function updateExpensesBulkActionBar() {
  const bar = document.getElementById('expensesBulkActionBar');
  const countEl = document.getElementById('expensesBulkSelectedCount');
  const totalEl = document.getElementById('expensesBulkSelectedTotal');
  if (!bar) return;

  const count = state.selectedExpenseIds.size;
  if (count > 0) {
    const selectedItems = state.expenses.filter(e => state.selectedExpenseIds.has(e.id));
    const totalSum = selectedItems.reduce((acc, e) => acc + (Number(e.total) || 0), 0);

    countEl.textContent = `${count} ${count === 1 ? 'gasto seleccionado' : 'gastos seleccionados'}`;
    totalEl.textContent = `Total: S/ ${totalSum.toFixed(2)}`;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

function confirmBulkDeleteExpenses() {
  const count = state.selectedExpenseIds.size;
  if (count === 0) {
    showToast('Selecciona al menos un gasto para eliminar.', 'warning');
    return;
  }

  const selectedItems = state.expenses.filter(e => state.selectedExpenseIds.has(e.id));
  const totalSum = selectedItems.reduce((acc, e) => acc + (Number(e.total) || 0), 0);

  state.deleteAction = () => {
    state.expenses = state.expenses.filter(e => !state.selectedExpenseIds.has(e.id));
    state.selectedExpenseIds.clear();

    saveExpensesLocal();
    renderExpensesTable();
    showToast(`${count} comprobantes de gasto eliminados correctamente.`, 'info');
    pushCloudData(true);
  };

  document.getElementById('confirmModalMessage').textContent =
    `¿Deseas eliminar permanentemente los ${count} comprobantes de gasto seleccionados por un monto total de S/ ${totalSum.toFixed(2)}? Esta acción se sincronizará con Google Sheets.`;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function handleExpenseTypeChange(type) {
  if (type === 'RxH') {
    document.getElementById('expenseFormCategory').value = 'Honorarios Profesionales';
    document.getElementById('expenseFormIgv').value = '0.00';
    const total = parseFloat(document.getElementById('expenseFormTotal').value) || 0;
    const retention = total * 0.08;
    document.getElementById('expenseFormRetention4th').value = retention.toFixed(2);
    document.getElementById('expenseFormNetPay').value = (total - retention).toFixed(2);
  } else {
    document.getElementById('expenseFormRetention4th').value = '0.00';
    handleExpenseTotalChange(document.getElementById('expenseFormTotal').value);
  }
}

function handleExpenseBaseChange(val) {
  const base = parseFloat(val) || 0;
  const type = document.getElementById('expenseFormType').value;
  if (type === 'RxH') {
    document.getElementById('expenseFormIgv').value = '0.00';
    document.getElementById('expenseFormTotal').value = base.toFixed(2);
    const ret = base * 0.08;
    document.getElementById('expenseFormRetention4th').value = ret.toFixed(2);
    document.getElementById('expenseFormNetPay').value = (base - ret).toFixed(2);
  } else {
    const igv = base * 0.18;
    const total = base + igv;
    document.getElementById('expenseFormIgv').value = igv.toFixed(2);
    document.getElementById('expenseFormTotal').value = total.toFixed(2);
    recalcExpenseDetraction(total);
  }
}

function handleExpenseIgvChange(val) {
  const igv = parseFloat(val) || 0;
  const base = parseFloat(document.getElementById('expenseFormBase').value) || 0;
  const total = base + igv;
  document.getElementById('expenseFormTotal').value = total.toFixed(2);
  recalcExpenseDetraction(total);
}

function handleExpenseTotalChange(val) {
  const total = parseFloat(val) || 0;
  const type = document.getElementById('expenseFormType').value;
  if (type === 'RxH') {
    document.getElementById('expenseFormBase').value = total.toFixed(2);
    document.getElementById('expenseFormIgv').value = '0.00';
    const ret = total * 0.08;
    document.getElementById('expenseFormRetention4th').value = ret.toFixed(2);
    document.getElementById('expenseFormNetPay').value = (total - ret).toFixed(2);
  } else {
    const base = total / 1.18;
    const igv = total - base;
    document.getElementById('expenseFormBase').value = base.toFixed(2);
    document.getElementById('expenseFormIgv').value = igv.toFixed(2);
    recalcExpenseDetraction(total);
  }
}

function handleExpenseDetractionRateChange(val) {
  const total = parseFloat(document.getElementById('expenseFormTotal').value) || 0;
  recalcExpenseDetraction(total);
}

function recalcExpenseDetraction(total) {
  const rate = parseFloat(document.getElementById('expenseFormDetractionRate').value) || 0;
  const ret4th = parseFloat(document.getElementById('expenseFormRetention4th').value) || 0;
  const detAmount = total * (rate / 100);
  const net = total - detAmount - ret4th;
  document.getElementById('expenseFormNetPay').value = (net > 0 ? net : total).toFixed(2);
}

function handleSaveExpense(e) {
  e.preventDefault();
  const editId = document.getElementById('expenseFormEditId').value;
  const uniqueId = editId || `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const expObj = {
    id: uniqueId,
    expenseCategory: document.getElementById('expenseFormCategory').value,
    type: document.getElementById('expenseFormType').value,
    series: (document.getElementById('expenseFormSeries').value || 'F001').trim().toUpperCase(),
    number: (document.getElementById('expenseFormNumber').value || '0000001').trim(),
    date: document.getElementById('expenseFormDate').value || new Date().toISOString().split('T')[0],
    supplierDocNumber: (document.getElementById('expenseFormDocNumber').value || '00000000').trim(),
    supplierName: (document.getElementById('expenseFormSupplierName').value || 'PROVEEDOR VARIOS').trim().toUpperCase(),
    concept: (document.getElementById('expenseFormConcept').value || 'Gasto operativo').trim(),
    base: parseFloat(document.getElementById('expenseFormBase').value) || 0,
    igv: parseFloat(document.getElementById('expenseFormIgv').value) || 0,
    total: parseFloat(document.getElementById('expenseFormTotal').value) || 0,
    detractionRate: parseFloat(document.getElementById('expenseFormDetractionRate').value) || 0,
    detractionAmount: (parseFloat(document.getElementById('expenseFormTotal').value) || 0) * (parseFloat(document.getElementById('expenseFormDetractionRate').value) || 0) / 100,
    retention4th: parseFloat(document.getElementById('expenseFormRetention4th').value) || 0,
    netPay: parseFloat(document.getElementById('expenseFormNetPay').value) || parseFloat(document.getElementById('expenseFormTotal').value) || 0,
    paymentMethod: 'Contado',
    fileUrl: document.getElementById('expenseFormFileUrl').value || undefined,
    fileName: document.getElementById('expenseFormFileName').value || undefined,
    fileDrivePath: document.getElementById('expenseFormFileDrivePath').value || undefined,
    _localUpdatedAt: Date.now()
  };

  state.lastLocalActionTime = Date.now();

  if (editId) {
    state.expenses = state.expenses.map(exp => exp.id === editId ? expObj : exp);
    showToast('Gasto actualizado correctamente.', 'success');
  } else {
    // Si ya existía uno idéntico localmente, reemplazarlo, si no, agregarlo al inicio
    const existingIndex = state.expenses.findIndex(e => 
      e.id === uniqueId || 
      (e.series === expObj.series && e.number === expObj.number && e.date === expObj.date && e.type === expObj.type)
    );
    if (existingIndex >= 0) {
      state.expenses[existingIndex] = expObj;
    } else {
      state.expenses.unshift(expObj);
    }
    showToast('Gasto registrado con éxito.', 'success');
  }

  saveExpensesLocal();
  resetExpenseForm();
  switchExpensesTab('dashboard');
  renderExpensesTable();
  pushCloudData(true);
}

function editExpense(id) {
  const item = state.expenses.find(e => e.id === id);
  if (!item) return;

  document.getElementById('expenseFormEditId').value = item.id;
  document.getElementById('expenseFormCategory').value = item.expenseCategory || 'Otros Gastos';
  document.getElementById('expenseFormType').value = item.type || 'Factura';
  document.getElementById('expenseFormSeries').value = item.series || '';
  document.getElementById('expenseFormNumber').value = item.number || '';
  document.getElementById('expenseFormDate').value = item.date || '';
  document.getElementById('expenseFormDocNumber').value = item.supplierDocNumber || '';
  document.getElementById('expenseFormSupplierName').value = item.supplierName || '';
  document.getElementById('expenseFormConcept').value = item.concept || '';
  document.getElementById('expenseFormBase').value = item.base || '';
  document.getElementById('expenseFormIgv').value = item.igv || '';
  document.getElementById('expenseFormTotal').value = item.total || '';
  document.getElementById('expenseFormDetractionRate').value = item.detractionRate || '0';
  document.getElementById('expenseFormRetention4th').value = item.retention4th || '0.00';
  document.getElementById('expenseFormNetPay').value = item.netPay || item.total || '0.00';
  document.getElementById('expenseFormFileUrl').value = item.fileUrl || '';
  document.getElementById('expenseFormFileName').value = item.fileName || '';
  document.getElementById('expenseFormFileDrivePath').value = item.fileDrivePath || '';

  const badge = document.getElementById('expensesFormDriveBadge');
  if (item.fileUrl) {
    badge.classList.remove('hidden');
    document.getElementById('expensesFormDriveText').textContent = 'Archivo Enlazado en Drive';
  } else {
    badge.classList.add('hidden');
  }

  document.getElementById('expensesFormTitle').textContent = 'Editar Comprobante de Gasto';
  document.getElementById('expensesFormSubmitBtnLabel').textContent = 'Actualizar Gasto';
  document.getElementById('expensesNewTabLabel').textContent = 'Editar Gasto';

  switchExpensesTab('new-expense');
}

function resetExpenseForm() {
  document.getElementById('expensesForm').reset();
  document.getElementById('expenseFormEditId').value = '';
  document.getElementById('expenseFormFileUrl').value = '';
  document.getElementById('expenseFormFileName').value = '';
  document.getElementById('expenseFormFileDrivePath').value = '';
  document.getElementById('expensesFormDriveBadge').classList.add('hidden');
  document.getElementById('expenseFormDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('expensesFormTitle').textContent = 'Registrar Comprobante de Gasto o Compra';
  document.getElementById('expensesFormSubmitBtnLabel').textContent = 'Guardar Gasto';
  document.getElementById('expensesNewTabLabel').textContent = 'Nuevo Gasto';
}

function confirmDeleteExpense(id) {
  const item = state.expenses.find(e => e.id === id);
  if (!item) return;

  state.deleteAction = () => {
    state.selectedExpenseIds.delete(id);
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveExpensesLocal();
    renderExpensesTable();
    showToast('Comprobante de gasto eliminado.', 'info');
    pushCloudData(true);
  };

  document.getElementById('confirmModalMessage').textContent = `¿Deseas eliminar el gasto ${item.type} ${item.series}-${item.number} de ${item.supplierName}? Esta acción se sincronizará con Google Sheets.`;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function renderSuppliersTable() {
  const map = {};
  state.expenses.forEach(e => {
    const doc = e.supplierDocNumber || '00000000';
    if (!map[doc]) {
      map[doc] = { doc, name: e.supplierName || 'PROVEEDOR VARIOS', category: e.expenseCategory || 'Otros', count: 0, total: 0, net: 0 };
    }
    map[doc].count += 1;
    map[doc].total += (Number(e.total) || 0);
    map[doc].net += (Number(e.netPay) || Number(e.total) || 0);
  });

  const list = Object.values(map).sort((a, b) => b.total - a.total);
  document.getElementById('suppliersCountBadge').textContent = `${list.length} Proveedores`;

  const tbody = document.getElementById('suppliersTableBody');
  tbody.innerHTML = list.map(s => `
    <tr class="hover:bg-slate-800/40 transition">
      <td class="py-3 px-3 font-mono text-slate-400">${s.doc}</td>
      <td class="py-3 px-3 font-semibold text-white">${s.name}</td>
      <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-sky-300">${s.category}</span></td>
      <td class="py-3 px-3 text-center font-mono text-slate-300">${s.count}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-sky-400">S/ ${s.total.toFixed(2)}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-amber-400">S/ ${s.net.toFixed(2)}</td>
    </tr>
  `).join('');
}

// =============================================================================
// 12. ESCÁNER INTELIGENTE IA & QR SUNAT (FILE DRAG/DROP & OCR)
// =============================================================================
function handleDragOver(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId)?.classList.add('border-emerald-500', 'bg-slate-900/80');
}

function handleDragLeave(e, zoneId) {
  e.preventDefault();
  document.getElementById(zoneId)?.classList.remove('border-emerald-500', 'bg-slate-900/80');
}

function handleFileDrop(e, type) {
  e.preventDefault();
  const zoneId = type === 'sale' ? 'salesDropZone' : 'expensesDropZone';
  document.getElementById(zoneId)?.classList.remove('border-emerald-500', 'bg-slate-900/80');

  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    processUploadedFile(e.dataTransfer.files[0], type);
  }
}

function handleFileSelect(e, type) {
  if (e.target.files && e.target.files[0]) {
    processUploadedFile(e.target.files[0], type);
  }
}

async function processUploadedFile(file, type = 'sale') {
  const statusBox = document.getElementById(type === 'sale' ? 'salesScanStatus' : 'expensesScanStatus');
  const statusText = document.getElementById(type === 'sale' ? 'salesScanStatusText' : 'expensesScanStatusText');
  const monthYearInput = document.getElementById(type === 'sale' ? 'salesScanMonthYear' : 'expensesScanMonthYear');
  const monthYear = monthYearInput?.value || new Date().toISOString().substring(0, 7);

  const isDeepOcr = document.getElementById(type === 'sale' ? 'salesDeepOcrToggle' : 'expensesDeepOcrToggle')?.checked || false;
  const driveFolderType = type === 'sale' ? 'Ventas' : 'Gastos';

  statusBox.classList.remove('hidden');
  statusBox.className = 'p-3.5 rounded-xl text-xs font-medium space-y-2 bg-amber-950/40 border border-amber-500/30 text-amber-300';
  statusText.textContent = `☁️ 1/3 Subiendo comprobante a la carpeta Google Drive (${driveFolderType} / ${monthYear})...`;

  try {
    // 1. Compresión y preparación rápida del archivo (< 50ms)
    const cleanFileName = file.name.replace(/\s+/g, '_');

    // 2. Subida prioritaria a la carpeta de Google Drive e identificación del enlace
    let uploadedFileUrl = '';
    let uploadedFileName = cleanFileName;
    let uploadedFolderPath = `${driveFolderType} / ${monthYear}`;

    try {
      const { base64: uploadBase64, mimeType: uploadMime } = await compressImageToBase64(file, 900, 0.65);
      const driveResult = await uploadVoucherToDrive(uploadBase64, cleanFileName, uploadMime, driveFolderType, monthYear);
      if (driveResult && driveResult.success && driveResult.fileUrl) {
        uploadedFileUrl = driveResult.fileUrl;
        uploadedFileName = driveResult.fileName || cleanFileName;
        uploadedFolderPath = driveResult.folderPath || `${driveFolderType} / ${monthYear}`;
        statusText.textContent = `🔗 2/3 Enlace de Drive identificado. Leyendo datos fiscales con Gemini AI...`;
      } else {
        statusText.textContent = `⚡ 2/3 Leyendo comprobante con Gemini AI...`;
      }
    } catch (dErr) {
      console.warn('Drive upload warning:', dErr);
      statusText.textContent = `⚡ 2/3 Leyendo comprobante con Gemini AI...`;
    }

    // 3. Extraer datos con Gemini de forma ultra rápida
    const { aiData } = await analyzeVoucherWithGemini(file, type, { isDeepOcr });

    statusBox.className = 'p-3.5 rounded-xl text-xs font-medium space-y-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300';
    statusText.textContent = '✅ ¡Comprobante subido, enlace identificado y datos leídos con éxito!';

    // 4. Rellenar formulario con el enlace de Drive ya integrado y listo para registrar
    if (type === 'sale') {
      document.getElementById('saleFormType').value = aiData.type || 'Factura';
      document.getElementById('saleFormSeries').value = aiData.series || 'F001';
      document.getElementById('saleFormNumber').value = aiData.number || '0000001';
      document.getElementById('saleFormDate').value = aiData.date || new Date().toISOString().split('T')[0];
      document.getElementById('saleFormDocNumber').value = aiData.clientDocNumber || '';
      document.getElementById('saleFormClientName').value = aiData.clientName || '';
      document.getElementById('saleFormConcept').value = aiData.concept || 'Venta de mercadería';
      document.getElementById('saleFormBase').value = aiData.baseAmount || '';
      document.getElementById('saleFormIgv').value = aiData.igvAmount || '';
      document.getElementById('saleFormTotal').value = aiData.totalAmount || '';
      document.getElementById('saleFormDetractionRate').value = aiData.detractionRate || '0';
      document.getElementById('saleFormDetractionAmount').value = aiData.detractionAmount || '0.00';
      document.getElementById('saleFormNetPay').value = aiData.netPay || aiData.totalAmount || '0.00';
      
      document.getElementById('saleFormFileUrl').value = uploadedFileUrl;
      document.getElementById('saleFormFileName').value = uploadedFileName;
      document.getElementById('saleFormFileDrivePath').value = uploadedFolderPath;

      const badge = document.getElementById('salesFormDriveBadge');
      const badgeText = document.getElementById('salesFormDriveText');
      if (uploadedFileUrl) {
        badge.className = 'text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5';
        badge.classList.remove('hidden');
        badgeText.textContent = 'Enlace Drive Vinculado';
      }

      switchSalesTab('new-sale');
      showToast('Venta leída y vinculada a Google Drive con éxito.', 'success');
    } else {
      document.getElementById('expenseFormCategory').value = aiData.expenseCategory || 'Mercadería / Insumos';
      document.getElementById('expenseFormType').value = aiData.type || 'Factura';
      document.getElementById('expenseFormSeries').value = aiData.series || 'F001';
      document.getElementById('expenseFormNumber').value = aiData.number || '0000001';
      document.getElementById('expenseFormDate').value = aiData.date || new Date().toISOString().split('T')[0];
      document.getElementById('expenseFormDocNumber').value = aiData.supplierDocNumber || '';
      document.getElementById('expenseFormSupplierName').value = aiData.supplierName || '';
      document.getElementById('expenseFormConcept').value = aiData.concept || 'Gasto operativo';
      document.getElementById('expenseFormBase').value = aiData.baseAmount || '';
      document.getElementById('expenseFormIgv').value = aiData.igvAmount || '';
      document.getElementById('expenseFormTotal').value = aiData.totalAmount || '';
      document.getElementById('expenseFormDetractionRate').value = aiData.detractionRate || '0';
      document.getElementById('expenseFormRetention4th').value = aiData.retention4th || '0.00';
      document.getElementById('expenseFormNetPay').value = aiData.netPay || aiData.totalAmount || '0.00';

      document.getElementById('expenseFormFileUrl').value = uploadedFileUrl;
      document.getElementById('expenseFormFileName').value = uploadedFileName;
      document.getElementById('expenseFormFileDrivePath').value = uploadedFolderPath;

      const badge = document.getElementById('expensesFormDriveBadge');
      const badgeText = document.getElementById('expensesFormDriveText');
      if (uploadedFileUrl) {
        badge.className = 'text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-xl flex items-center gap-1.5';
        badge.classList.remove('hidden');
        badgeText.textContent = 'Enlace Drive Vinculado';
      }

      switchExpensesTab('new-expense');
      showToast('Gasto leído y vinculado a Google Drive con éxito.', 'success');
    }

    setTimeout(() => statusBox.classList.add('hidden'), 2500);
  } catch (err) {
    statusBox.className = 'p-3.5 rounded-xl text-xs font-medium space-y-2 bg-amber-950/40 border border-amber-500/30 text-amber-300';
    const isQuota = err.message && (err.message.includes('cuota') || err.message.includes('quota') || err.message.includes('exceeded') || err.message.includes('429'));
    if (isQuota) {
      statusText.textContent = 'Límite de solicitudes de Gemini alcanzado temporalmente. Espera 30-60 segundos para reintentar el escaneo o abre la pestaña del formulario para ingresar los datos manualmente.';
      showToast('Límite de solicitudes de IA alcanzado. Puedes ingresar los datos directamente en el formulario.', 'warning');
    } else {
      statusBox.className = 'p-3.5 rounded-xl text-xs font-medium space-y-2 bg-red-950/40 border border-red-500/30 text-red-300';
      statusText.textContent = `Error: ${err.message || 'No se pudo procesar el archivo'}`;
      showToast(err.message || 'Error al analizar comprobante.', 'error');
    }
  }
}

function processQrSunat(type = 'sale') {
  const input = document.getElementById(type === 'sale' ? 'salesQrInput' : 'expensesQrInput');
  const text = (input?.value || '').trim();

  const parsed = parseQrSunat(text);
  if (!parsed) {
    showToast('Formato de QR no válido. Asegúrate de incluir los campos separados por barra vertical (|)', 'warning');
    return;
  }

  if (type === 'sale') {
    document.getElementById('saleFormType').value = parsed.type;
    document.getElementById('saleFormSeries').value = parsed.series;
    document.getElementById('saleFormNumber').value = parsed.number;
    document.getElementById('saleFormDate').value = parsed.date;
    document.getElementById('saleFormDocNumber').value = parsed.docClienteNumero;
    document.getElementById('saleFormIgv').value = parsed.igv.toFixed(2);
    document.getElementById('saleFormTotal').value = parsed.total.toFixed(2);
    document.getElementById('saleFormBase').value = (parsed.total - parsed.igv).toFixed(2);
    recalcSaleDetraction(parsed.total);

    input.value = '';
    switchSalesTab('new-sale');
    showToast('QR SUNAT decodificado correctamente.', 'success');
  } else {
    document.getElementById('expenseFormType').value = parsed.type;
    document.getElementById('expenseFormSeries').value = parsed.series;
    document.getElementById('expenseFormNumber').value = parsed.number;
    document.getElementById('expenseFormDate').value = parsed.date;
    document.getElementById('expenseFormDocNumber').value = parsed.rucEmisor;
    document.getElementById('expenseFormIgv').value = parsed.igv.toFixed(2);
    document.getElementById('expenseFormTotal').value = parsed.total.toFixed(2);
    document.getElementById('expenseFormBase').value = (parsed.total - parsed.igv).toFixed(2);
    recalcExpenseDetraction(parsed.total);

    input.value = '';
    switchExpensesTab('new-expense');
    showToast('QR de compra decodificado.', 'success');
  }
}

// =============================================================================
// 13. MÓDULO DE REPORTES FINANCIEROS, GRÁFICOS & ASESOR CFO IA
// =============================================================================
function renderReportsModule() {
  const period = document.getElementById('reportsPeriodSelect')?.value || 'ALL';

  const filterItem = (item) => {
    if (period === 'ALL') return true;
    const sDate = item.date || '';
    if (period.length === 4) return sDate.startsWith(period); // e.g. "2026"
    if (period.length === 7) return sDate.startsWith(period); // e.g. "2026-08"
    return true;
  };

  const filteredSales = state.sales.filter(filterItem);
  const filteredExpenses = state.expenses.filter(filterItem);

  const totalVentas = filteredSales.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const totalVentasIgv = filteredSales.reduce((s, x) => s + (Number(x.igv) || 0), 0);
  const totalCostos = filteredSales.reduce((s, x) => s + (Number(x.cost) || 0), 0);

  const totalGastos = filteredExpenses.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const totalGastosIgv = filteredExpenses.reduce((s, x) => s + (Number(x.igv) || 0), 0);

  const utilidadBruta = totalVentas - totalGastos - totalCostos;
  const margen = totalVentas > 0 ? ((utilidadBruta / totalVentas) * 100).toFixed(1) : '0';
  const balanceIgv = totalVentasIgv - totalGastosIgv;

  document.getElementById('repKpiSales').textContent = `S/ ${totalVentas.toFixed(2)}`;
  document.getElementById('repKpiSalesIgv').textContent = `IGV Débito: S/ ${totalVentasIgv.toFixed(2)}`;
  document.getElementById('repKpiExpenses').textContent = `S/ ${totalGastos.toFixed(2)}`;
  document.getElementById('repKpiExpensesIgv').textContent = `IGV Crédito: S/ ${totalGastosIgv.toFixed(2)}`;
  
  document.getElementById('repKpiProfit').textContent = `S/ ${utilidadBruta.toFixed(2)}`;
  document.getElementById('repKpiProfit').className = `text-lg md:text-2xl font-bold ${utilidadBruta >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
  document.getElementById('repKpiMargin').textContent = `Margen: ${margen}%`;

  const taxStatusEl = document.getElementById('repKpiTaxStatus');
  const taxAmtEl = document.getElementById('repKpiTaxAmount');

  if (balanceIgv <= 0) {
    taxStatusEl.textContent = 'Crédito Fiscal a Favor';
    taxStatusEl.className = 'text-lg md:text-xl font-bold text-emerald-400';
    taxAmtEl.textContent = `A favor: S/ ${Math.abs(balanceIgv).toFixed(2)}`;
  } else {
    taxStatusEl.textContent = 'IGV por Pagar a SUNAT';
    taxStatusEl.className = 'text-lg md:text-xl font-bold text-amber-400';
    taxAmtEl.textContent = `Por pagar: S/ ${balanceIgv.toFixed(2)}`;
  }

  renderFinancialCharts(filteredSales, filteredExpenses);
  renderActiveReportsTable();
}

function switchReportsSubTab(subTab) {
  state.activeReportsSubTab = subTab;

  const cSales = document.getElementById('reportContainerSales');
  const cExpenses = document.getElementById('reportContainerExpenses');
  const cTax = document.getElementById('reportContainerTax');

  const bSales = document.getElementById('repSubTabBtnSales');
  const bExpenses = document.getElementById('repSubTabBtnExpenses');
  const bTax = document.getElementById('repSubTabBtnTax');

  [cSales, cExpenses, cTax].forEach(c => c?.classList.add('hidden'));
  [bSales, bExpenses, bTax].forEach(b => {
    if (b) b.className = 'px-3 py-1.5 rounded-lg font-semibold text-slate-400 hover:text-white cursor-pointer transition';
  });

  if (subTab === 'sales') {
    cSales?.classList.remove('hidden');
    if (bSales) bSales.className = 'px-3 py-1.5 rounded-lg font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-pointer transition';
  } else if (subTab === 'expenses') {
    cExpenses?.classList.remove('hidden');
    if (bExpenses) bExpenses.className = 'px-3 py-1.5 rounded-lg font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 cursor-pointer transition';
  } else if (subTab === 'tax') {
    cTax?.classList.remove('hidden');
    if (bTax) bTax.className = 'px-3 py-1.5 rounded-lg font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-pointer transition';
  }

  renderActiveReportsTable();
}

function renderActiveReportsTable() {
  const period = document.getElementById('reportsPeriodSelect')?.value || 'ALL';
  const search = (document.getElementById('reportFilterSearch')?.value || '').toLowerCase().trim();

  const filterPeriod = (item) => {
    if (period === 'ALL') return true;
    const sDate = item.date || '';
    if (period.length === 4) return sDate.startsWith(period);
    if (period.length === 7) return sDate.startsWith(period);
    return true;
  };

  if (state.activeReportsSubTab === 'sales') {
    const filteredSales = state.sales.filter(filterPeriod).filter(s => {
      if (!search) return true;
      return (s.clientName || '').toLowerCase().includes(search) ||
             (s.clientDocNumber || '').includes(search) ||
             (s.series || '').toLowerCase().includes(search) ||
             (s.number || '').includes(search) ||
             (s.type || '').toLowerCase().includes(search) ||
             (s.concept || '').toLowerCase().includes(search);
    });

    const badge = document.getElementById('reportRowCountBadge');
    if (badge) badge.textContent = `${filteredSales.length} comprobantes de venta`;

    const tbody = document.getElementById('reportSalesTableBody');
    const tfoot = document.getElementById('reportSalesTableFoot');

    if (tbody) {
      if (filteredSales.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="py-8 text-center text-slate-500">No hay ventas registradas para este período o criterio de búsqueda.</td></tr>`;
      } else {
        tbody.innerHTML = filteredSales.map(item => `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-2.5 px-3 text-center">
              ${item.fileUrl ? `
                <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex text-teal-400 hover:text-teal-300" title="Ver en Drive">
                  <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                </a>
              ` : `<span class="text-slate-600"><i data-lucide="cloud-off" class="w-3.5 h-3.5 inline"></i></span>`}
            </td>
            <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${item.date || '-'}</td>
            <td class="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">${item.clientDocNumber || '-'}</td>
            <td class="py-2.5 px-3">
              <span class="font-semibold text-white truncate max-w-[170px] inline-block" title="${item.clientName || ''}">${item.clientName || 'Cliente Varios'}</span>
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'Factura' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-300'}">
                ${item.type || 'Factura'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-300 font-semibold whitespace-nowrap">${item.series || 'F001'}</td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-300 whitespace-nowrap">${item.number || '000001'}</td>
            <td class="py-2.5 px-3 text-slate-300 truncate max-w-[160px]" title="${item.concept || ''}">${item.concept || '-'}</td>
            <td class="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">S/ ${(Number(item.base) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-sky-400 whitespace-nowrap">S/ ${(Number(item.igv) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">S/ ${(Number(item.total) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">${item.detractionRate ? `${item.detractionRate}%` : '-'}</td>
            <td class="py-2.5 px-3 text-right font-mono text-indigo-400 whitespace-nowrap">S/ ${(Number(item.detractionAmount) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">S/ ${(Number(item.netPay) || Number(item.total) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-center text-slate-400 text-[11px] whitespace-nowrap">${item.paymentMethod || 'Contado'}</td>
          </tr>
        `).join('');
      }
    }

    if (tfoot) {
      const sumBase = filteredSales.reduce((sum, s) => sum + (Number(s.base) || 0), 0);
      const sumIgv = filteredSales.reduce((sum, s) => sum + (Number(s.igv) || 0), 0);
      const sumTotal = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
      const sumDetr = filteredSales.reduce((sum, s) => sum + (Number(s.detractionAmount) || 0), 0);
      const sumNet = filteredSales.reduce((sum, s) => sum + (Number(s.netPay) || Number(s.total) || 0), 0);

      tfoot.innerHTML = `
        <tr>
          <td colspan="8" class="py-3 px-3 text-right uppercase tracking-wider text-slate-300 font-bold">TOTALES CONSOLIDADOS DE VENTAS:</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 whitespace-nowrap font-bold">S/ ${sumBase.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-sky-400 whitespace-nowrap font-bold">S/ ${sumIgv.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-emerald-400 whitespace-nowrap font-bold text-sm">S/ ${sumTotal.toFixed(2)}</td>
          <td></td>
          <td class="py-3 px-3 text-right font-mono text-indigo-400 whitespace-nowrap font-bold">S/ ${sumDetr.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-amber-400 whitespace-nowrap font-bold text-sm">S/ ${sumNet.toFixed(2)}</td>
          <td></td>
        </tr>
      `;
    }

  } else if (state.activeReportsSubTab === 'expenses') {
    const filteredExpenses = state.expenses.filter(filterPeriod).filter(e => {
      if (!search) return true;
      return (e.supplierName || '').toLowerCase().includes(search) ||
             (e.supplierDocNumber || '').includes(search) ||
             (e.series || '').toLowerCase().includes(search) ||
             (e.number || '').includes(search) ||
             (e.type || '').toLowerCase().includes(search) ||
             (e.expenseCategory || '').toLowerCase().includes(search) ||
             (e.concept || '').toLowerCase().includes(search);
    });

    const badge = document.getElementById('reportRowCountBadge');
    if (badge) badge.textContent = `${filteredExpenses.length} comprobantes de gasto`;

    const tbody = document.getElementById('reportExpensesTableBody');
    const tfoot = document.getElementById('reportExpensesTableFoot');

    if (tbody) {
      if (filteredExpenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="15" class="py-8 text-center text-slate-500">No hay gastos o compras registradas para este período o criterio de búsqueda.</td></tr>`;
      } else {
        tbody.innerHTML = filteredExpenses.map(item => `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="py-2.5 px-3 text-center">
              ${item.fileUrl ? `
                <a href="${item.fileUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex text-teal-400 hover:text-teal-300" title="Ver en Drive">
                  <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                </a>
              ` : `<span class="text-slate-600"><i data-lucide="cloud-off" class="w-3.5 h-3.5 inline"></i></span>`}
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-sky-300 border border-slate-700 whitespace-nowrap">
                ${item.expenseCategory || 'Otros Gastos'}
              </span>
            </td>
            <td class="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">${item.date || '-'}</td>
            <td class="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">${item.supplierDocNumber || '-'}</td>
            <td class="py-2.5 px-3">
              <span class="font-semibold text-white truncate max-w-[170px] inline-block" title="${item.supplierName || ''}">${item.supplierName || 'Proveedor Varios'}</span>
            </td>
            <td class="py-2.5 px-3 whitespace-nowrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'RxH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-300'}">
                ${item.type || 'Factura'}
              </span>
            </td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-300 font-semibold whitespace-nowrap">${item.series || 'F001'}</td>
            <td class="py-2.5 px-3 text-center font-mono text-slate-300 whitespace-nowrap">${item.number || '000001'}</td>
            <td class="py-2.5 px-3 text-slate-300 truncate max-w-[160px]" title="${item.concept || ''}">${item.concept || '-'}</td>
            <td class="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">S/ ${(Number(item.base) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-emerald-400 whitespace-nowrap">S/ ${(Number(item.igv) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">S/ ${(Number(item.total) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-indigo-400 whitespace-nowrap">S/ ${(Number(item.retention4th) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">S/ ${(Number(item.detractionAmount) || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-400 whitespace-nowrap">S/ ${(Number(item.netPay) || Number(item.total) || 0).toFixed(2)}</td>
          </tr>
        `).join('');
      }
    }

    if (tfoot) {
      const sumBase = filteredExpenses.reduce((sum, e) => sum + (Number(e.base) || 0), 0);
      const sumIgv = filteredExpenses.reduce((sum, e) => sum + (Number(e.igv) || 0), 0);
      const sumTotal = filteredExpenses.reduce((sum, e) => sum + (Number(e.total) || 0), 0);
      const sumRet4 = filteredExpenses.reduce((sum, e) => sum + (Number(e.retention4th) || 0), 0);
      const sumDetr = filteredExpenses.reduce((sum, e) => sum + (Number(e.detractionAmount) || 0), 0);
      const sumNet = filteredExpenses.reduce((sum, e) => sum + (Number(e.netPay) || Number(e.total) || 0), 0);

      tfoot.innerHTML = `
        <tr>
          <td colspan="9" class="py-3 px-3 text-right uppercase tracking-wider text-slate-300 font-bold">TOTALES CONSOLIDADOS DE GASTOS:</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 whitespace-nowrap font-bold">S/ ${sumBase.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-emerald-400 whitespace-nowrap font-bold">S/ ${sumIgv.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-sky-400 whitespace-nowrap font-bold text-sm">S/ ${sumTotal.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-indigo-400 whitespace-nowrap font-bold">S/ ${sumRet4.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-400 whitespace-nowrap font-bold">S/ ${sumDetr.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-amber-400 whitespace-nowrap font-bold text-sm">S/ ${sumNet.toFixed(2)}</td>
        </tr>
      `;
    }

  } else if (state.activeReportsSubTab === 'tax') {
    // Generate month-by-month tax balance
    const monthMap = {};
    state.sales.filter(filterPeriod).forEach(s => {
      const m = (s.date || '').substring(0, 7) || 'Sin Fecha';
      if (!monthMap[m]) monthMap[m] = { month: m, salesBase: 0, salesIgv: 0, expensesBase: 0, expensesIgv: 0, salesTotal: 0, expensesTotal: 0 };
      monthMap[m].salesBase += (Number(s.base) || 0);
      monthMap[m].salesIgv += (Number(s.igv) || 0);
      monthMap[m].salesTotal += (Number(s.total) || 0);
    });

    state.expenses.filter(filterPeriod).forEach(e => {
      const m = (e.date || '').substring(0, 7) || 'Sin Fecha';
      if (!monthMap[m]) monthMap[m] = { month: m, salesBase: 0, salesIgv: 0, expensesBase: 0, expensesIgv: 0, salesTotal: 0, expensesTotal: 0 };
      monthMap[m].expensesBase += (Number(e.base) || 0);
      monthMap[m].expensesIgv += (Number(e.igv) || 0);
      monthMap[m].expensesTotal += (Number(e.total) || 0);
    });

    const monthList = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));

    const badge = document.getElementById('reportRowCountBadge');
    if (badge) badge.textContent = `${monthList.length} períodos fiscales`;

    const tbody = document.getElementById('reportTaxTableBody');
    const tfoot = document.getElementById('reportTaxTableFoot');

    if (tbody) {
      if (monthList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No hay movimientos registrados en el período seleccionado.</td></tr>`;
      } else {
        tbody.innerHTML = monthList.map(row => {
          const balance = row.salesIgv - row.expensesIgv;
          const utilidad = row.salesTotal - row.expensesTotal;
          const isCredit = balance <= 0;
          return `
            <tr class="hover:bg-slate-800/40 transition font-mono">
              <td class="py-3 px-3 font-semibold text-white">${row.month}</td>
              <td class="py-3 px-3 text-right text-slate-300">S/ ${row.salesBase.toFixed(2)}</td>
              <td class="py-3 px-3 text-right text-emerald-400 font-semibold">S/ ${row.salesIgv.toFixed(2)}</td>
              <td class="py-3 px-3 text-right text-slate-300">S/ ${row.expensesBase.toFixed(2)}</td>
              <td class="py-3 px-3 text-right text-sky-400 font-semibold">S/ ${row.expensesIgv.toFixed(2)}</td>
              <td class="py-3 px-3 text-right font-bold ${isCredit ? 'text-emerald-400' : 'text-amber-400'}">
                S/ ${Math.abs(balance).toFixed(2)}
              </td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isCredit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
                  ${isCredit ? 'Crédito a Favor' : 'Por Pagar a SUNAT'}
                </span>
              </td>
              <td class="py-3 px-3 text-right font-bold ${utilidad >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                S/ ${utilidad.toFixed(2)}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (tfoot) {
      const totSalesBase = monthList.reduce((s, m) => s + m.salesBase, 0);
      const totSalesIgv = monthList.reduce((s, m) => s + m.salesIgv, 0);
      const totExpBase = monthList.reduce((s, m) => s + m.expensesBase, 0);
      const totExpIgv = monthList.reduce((s, m) => s + m.expensesIgv, 0);
      const totBalance = totSalesIgv - totExpIgv;
      const totUtilidad = monthList.reduce((s, m) => s + (m.salesTotal - m.expensesTotal), 0);

      tfoot.innerHTML = `
        <tr>
          <td class="py-3 px-3 uppercase tracking-wider text-slate-300 font-bold">TOTALES DEL PERÍODO:</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 font-bold">S/ ${totSalesBase.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-emerald-400 font-bold">S/ ${totSalesIgv.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-slate-300 font-bold">S/ ${totExpBase.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono text-sky-400 font-bold">S/ ${totExpIgv.toFixed(2)}</td>
          <td class="py-3 px-3 text-right font-mono font-bold ${totBalance <= 0 ? 'text-emerald-400' : 'text-amber-400'}">
            S/ ${Math.abs(totBalance).toFixed(2)}
          </td>
          <td class="py-3 px-3 text-right font-bold text-xs ${totBalance <= 0 ? 'text-emerald-400' : 'text-amber-400'}">
            ${totBalance <= 0 ? 'Saldo a Favor' : 'Saldo por Pagar'}
          </td>
          <td class="py-3 px-3 text-right font-mono font-bold text-sm ${totUtilidad >= 0 ? 'text-emerald-400' : 'text-red-400'}">
            S/ ${totUtilidad.toFixed(2)}
          </td>
        </tr>
      `;
    }
  }

  initIcons();
}

function exportActiveReportToCsv() {
  const period = document.getElementById('reportsPeriodSelect')?.value || 'ALL';
  const filterPeriod = (item) => {
    if (period === 'ALL') return true;
    const sDate = item.date || '';
    if (period.length === 4) return sDate.startsWith(period);
    if (period.length === 7) return sDate.startsWith(period);
    return true;
  };

  let filename = '';
  let csvContent = '';

  const escapeCsv = (val) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  if (state.activeReportsSubTab === 'sales') {
    filename = `Reporte_Ventas_Agricarl_${period}_${Date.now()}.csv`;
    const headers = [
      "Fecha Emisión",
      "RUC / DNI Cliente",
      "Cliente / Razón Social",
      "Tipo Comprobante",
      "Serie",
      "Número Correlativo",
      "Concepto / Detalle",
      "Forma de Pago",
      "Base Imponible (S/)",
      "IGV 18% (S/)",
      "Monto Total (S/)",
      "% Detracción",
      "Monto Detracción (S/)",
      "Neto a Cobrar (S/)",
      "Costo de Ventas (S/)",
      "Enlace Drive"
    ];

    const data = state.sales.filter(filterPeriod).map(s => [
      s.date || '',
      s.clientDocNumber || '',
      s.clientName || '',
      s.type || 'Factura',
      s.series || 'F001',
      s.number || '000001',
      s.concept || '',
      s.paymentMethod || 'Contado',
      (Number(s.base) || 0).toFixed(2),
      (Number(s.igv) || 0).toFixed(2),
      (Number(s.total) || 0).toFixed(2),
      s.detractionRate ? `${s.detractionRate}%` : '0%',
      (Number(s.detractionAmount) || 0).toFixed(2),
      (Number(s.netPay) || Number(s.total) || 0).toFixed(2),
      (Number(s.cost) || 0).toFixed(2),
      s.fileUrl || ''
    ]);

    csvContent = [headers.map(escapeCsv).join(',')].concat(data.map(row => row.map(escapeCsv).join(','))).join('\r\n');

  } else if (state.activeReportsSubTab === 'expenses') {
    filename = `Reporte_Gastos_Agricarl_${period}_${Date.now()}.csv`;
    const headers = [
      "Categoría de Gasto",
      "Fecha Emisión",
      "RUC / DNI Proveedor",
      "Proveedor / Razón Social",
      "Tipo Comprobante",
      "Serie",
      "Número Correlativo",
      "Concepto / Detalle",
      "Base Imponible (S/)",
      "IGV 18% (S/)",
      "Monto Total (S/)",
      "Retención 4ta Cat (S/)",
      "% Detracción",
      "Monto Detracción (S/)",
      "Neto Pagado (S/)",
      "Enlace Drive"
    ];

    const data = state.expenses.filter(filterPeriod).map(e => [
      e.expenseCategory || 'Otros Gastos',
      e.date || '',
      e.supplierDocNumber || '',
      e.supplierName || '',
      e.type || 'Factura',
      e.series || 'F001',
      e.number || '000001',
      e.concept || '',
      (Number(e.base) || 0).toFixed(2),
      (Number(e.igv) || 0).toFixed(2),
      (Number(e.total) || 0).toFixed(2),
      (Number(e.retention4th) || 0).toFixed(2),
      e.detractionRate ? `${e.detractionRate}%` : '0%',
      (Number(e.detractionAmount) || 0).toFixed(2),
      (Number(e.netPay) || Number(e.total) || 0).toFixed(2),
      e.fileUrl || ''
    ]);

    csvContent = [headers.map(escapeCsv).join(',')].concat(data.map(row => row.map(escapeCsv).join(','))).join('\r\n');

  } else if (state.activeReportsSubTab === 'tax') {
    filename = `Balance_Fiscal_IGV_Agricarl_${period}_${Date.now()}.csv`;
    const headers = [
      "Período / Mes",
      "Ventas Base (S/)",
      "IGV Débito Fiscal (S/)",
      "Compras Base (S/)",
      "IGV Crédito Fiscal (S/)",
      "Balance IGV SUNAT (S/)",
      "Estado Tributario",
      "Utilidad Operativa (S/)"
    ];

    const monthMap = {};
    state.sales.filter(filterPeriod).forEach(s => {
      const m = (s.date || '').substring(0, 7) || 'Sin Fecha';
      if (!monthMap[m]) monthMap[m] = { month: m, salesBase: 0, salesIgv: 0, expensesBase: 0, expensesIgv: 0, salesTotal: 0, expensesTotal: 0 };
      monthMap[m].salesBase += (Number(s.base) || 0);
      monthMap[m].salesIgv += (Number(s.igv) || 0);
      monthMap[m].salesTotal += (Number(s.total) || 0);
    });

    state.expenses.filter(filterPeriod).forEach(e => {
      const m = (e.date || '').substring(0, 7) || 'Sin Fecha';
      if (!monthMap[m]) monthMap[m] = { month: m, salesBase: 0, salesIgv: 0, expensesBase: 0, expensesIgv: 0, salesTotal: 0, expensesTotal: 0 };
      monthMap[m].expensesBase += (Number(e.base) || 0);
      monthMap[m].expensesIgv += (Number(e.igv) || 0);
      monthMap[m].expensesTotal += (Number(e.total) || 0);
    });

    const monthList = Object.values(monthMap).sort((a, b) => b.month.localeCompare(a.month));
    const data = monthList.map(m => {
      const balance = m.salesIgv - m.expensesIgv;
      const isCredit = balance <= 0;
      return [
        m.month,
        m.salesBase.toFixed(2),
        m.salesIgv.toFixed(2),
        m.expensesBase.toFixed(2),
        m.expensesIgv.toFixed(2),
        Math.abs(balance).toFixed(2),
        isCredit ? 'Crédito a Favor' : 'Por Pagar a SUNAT',
        (m.salesTotal - m.expensesTotal).toFixed(2)
      ];
    });

    csvContent = [headers.map(escapeCsv).join(',')].concat(data.map(row => row.map(escapeCsv).join(','))).join('\r\n');
  }

  // Download with UTF-8 BOM
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast(`Reporte exportado exitosamente (${filename})`, 'success');
}

function renderFinancialCharts(sales, expenses) {
  if (!window.Chart) return;

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
  const fullMonthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  // Determine target year from the period select
  const periodVal = document.getElementById('reportsPeriodSelect')?.value || 'ALL';
  let targetYear = '2026';
  if (periodVal !== 'ALL') {
    targetYear = periodVal.substring(0, 4);
  } else {
    const years = state.sales.map(s => (s.date || '').substring(0, 4)).filter(Boolean);
    targetYear = years.includes('2026') ? '2026' : (years[0] || String(new Date().getFullYear()));
  }

  // 1. Calculate monthly sales for the target year
  const salesByMonth = Array(12).fill(0);
  const salesCountByMonth = Array(12).fill(0);
  const expensesByMonth = Array(12).fill(0);

  state.sales.forEach(s => {
    if (s.date && s.date.startsWith(`${targetYear}-`)) {
      const mIdx = parseInt(s.date.substring(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        salesByMonth[mIdx] += (Number(s.total) || 0);
        salesCountByMonth[mIdx] += 1;
      }
    }
  });

  state.expenses.forEach(e => {
    if (e.date && e.date.startsWith(`${targetYear}-`)) {
      const mIdx = parseInt(e.date.substring(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) expensesByMonth[mIdx] += (Number(e.total) || 0);
    }
  });

  // Calculate year totals and stats for the line chart
  const yearTotalSales = salesByMonth.reduce((a, b) => a + b, 0);
  const monthlyAvgSales = yearTotalSales / 12;

  let maxSaleAmount = 0;
  let maxSaleMonthIdx = -1;
  salesByMonth.forEach((val, idx) => {
    if (val > maxSaleAmount) {
      maxSaleAmount = val;
      maxSaleMonthIdx = idx;
    }
  });

  // Update header badges & stats
  const badgeEl = document.getElementById('salesTrendYearBadge');
  if (badgeEl) badgeEl.textContent = `Año ${targetYear}`;

  const totalEl = document.getElementById('salesTrendYearTotal');
  if (totalEl) totalEl.textContent = `S/ ${yearTotalSales.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const avgEl = document.getElementById('salesTrendMonthlyAvg');
  if (avgEl) avgEl.textContent = `S/ ${monthlyAvgSales.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const peakEl = document.getElementById('salesTrendPeakMonth');
  if (peakEl) {
    if (maxSaleAmount > 0 && maxSaleMonthIdx >= 0) {
      peakEl.textContent = `${months[maxSaleMonthIdx]} (S/ ${maxSaleAmount.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
    } else {
      peakEl.textContent = 'Sin ventas';
    }
  }

  // --- A. GRÁFICO DE LÍNEAS: EVOLUCIÓN MENSUAL DE VENTAS TOTALES ---
  const ctxLine = document.getElementById('salesTrendLineChart')?.getContext('2d');
  if (ctxLine) {
    if (state.charts.salesTrend) state.charts.salesTrend.destroy();

    // Crear gradiente de relleno moderno
    const gradient = ctxLine.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.06)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    state.charts.salesTrend = new Chart(ctxLine, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: `Ventas Totales (${targetYear})`,
            data: salesByMonth,
            borderColor: '#10b981',
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#10b981',
            pointBorderColor: '#090d16',
            pointBorderWidth: 2.5,
            pointRadius: 4.5,
            pointHoverRadius: 7.5,
            pointHoverBackgroundColor: '#34d399',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#0c1322',
            titleColor: '#e2e8f0',
            bodyColor: '#10b981',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            titleFont: {
              family: "'Plus Jakarta Sans', sans-serif",
              size: 12,
              weight: 'bold'
            },
            bodyFont: {
              family: "'JetBrains Mono', monospace",
              size: 13,
              weight: 'bold'
            },
            callbacks: {
              title: (tooltipItems) => {
                const idx = tooltipItems[0]?.dataIndex;
                return `${fullMonthNames[idx]} ${targetYear}`;
              },
              label: (context) => {
                const val = Number(context.raw) || 0;
                const count = salesCountByMonth[context.dataIndex] || 0;
                return `Ventas Totales: S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${count} comprobantes)`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                size: 11,
                family: "'Plus Jakarta Sans', sans-serif"
              }
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              color: '#94a3b8',
              font: {
                size: 11,
                family: "'JetBrains Mono', monospace"
              },
              callback: (value) => {
                if (value >= 1000) {
                  return 'S/ ' + (value / 1000).toFixed(1) + 'k';
                }
                return 'S/ ' + value;
              }
            }
          }
        }
      }
    });
  }

  // --- B. GRÁFICO DE BARRAS COMPARATIVO: VENTAS VS GASTOS ---
  const ctxComp = document.getElementById('monthlyComparisonChart')?.getContext('2d');
  if (ctxComp) {
    if (state.charts.comparison) state.charts.comparison.destroy();
    state.charts.comparison = new Chart(ctxComp, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: `Ventas (S/) - ${targetYear}`,
            data: salesByMonth,
            backgroundColor: '#10b981',
            borderRadius: 6
          },
          {
            label: `Gastos (S/) - ${targetYear}`,
            data: expensesByMonth,
            backgroundColor: '#0284c7',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } }, grid: { color: 'rgba(255, 255, 255, 0.04)' } },
          y: { ticks: { color: '#94a3b8', font: { size: 11, family: "'JetBrains Mono', monospace" } }, grid: { color: 'rgba(255, 255, 255, 0.04)' } }
        }
      }
    });
  }

  // --- C. GRÁFICO DOUGHNUT: DISTRIBUCIÓN DE GASTOS POR CATEGORÍA ---
  const catMap = {};
  expenses.forEach(e => {
    const cat = e.expenseCategory || 'Otros Gastos';
    catMap[cat] = (catMap[cat] || 0) + (Number(e.total) || 0);
  });

  const catLabels = Object.keys(catMap);
  const catValues = Object.values(catMap);

  const ctxCat = document.getElementById('expensesCategoryChart')?.getContext('2d');
  if (ctxCat) {
    if (state.charts.categories) state.charts.categories.destroy();
    state.charts.categories = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['Sin Gastos'],
        datasets: [{
          data: catValues.length ? catValues : [1],
          backgroundColor: ['#059669', '#0284c7', '#d97706', '#7c3aed', '#dc2626', '#64748b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10, family: "'Plus Jakarta Sans', sans-serif" }, boxWidth: 12 } }
        }
      }
    });
  }
}

async function generateAiExecutiveReport() {
  const btn = document.getElementById('btnGenerateAiReport');
  const reportCard = document.getElementById('aiReportCard');

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4 animate-spin"></i><span>Generando Diagnóstico...</span>`;
  initIcons();

  const totalVentas = state.sales.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const totalGastos = state.expenses.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const igvDebito = state.sales.reduce((s, x) => s + (Number(x.igv) || 0), 0);
  const igvCredito = state.expenses.reduce((s, x) => s + (Number(x.igv) || 0), 0);
  const utilidad = totalVentas - totalGastos;

  const dataSummary = {
    empresa: getCompanyName(),
    ruc: getCompanyRuc(),
    totalVentas,
    totalGastos,
    utilidad,
    igvDebito,
    igvCredito,
    balanceIgv: igvDebito - igvCredito,
    numVentas: state.sales.length,
    numGastos: state.expenses.length
  };

  const prompt = `Eres el Director Financiero (CFO) de la empresa "${getCompanyName()}". 
Analiza estos datos contables: ${JSON.stringify(dataSummary)}
Responde ESTRICTAMENTE con un objeto JSON válido con esta estructura:
{
  "headline": "Frase de impacto gerencial de 1 sola línea resumiendo la salud del negocio",
  "healthStatus": "Saludable" | "Excelente" | "Atención Requerida",
  "healthScore": 85,
  "commercialInsight": "Análisis de ventas y márgenes en máx 2 oraciones",
  "taxInsight": "Diagnóstico sobre el IGV y crédito fiscal SUNAT en máx 2 oraciones",
  "costInsight": "Recomendación puntual sobre control de compras y gastos",
  "keyActions": [
    { "title": "Acción 1", "priority": "Inmediata", "desc": "Detalle breve" },
    { "title": "Acción 2", "priority": "Alta", "desc": "Detalle breve" },
    { "title": "Acción 3", "priority": "Media", "desc": "Detalle breve" }
  ]
}`;

  try {
    let reportData = null;
    const customKey = localStorage.getItem(CONFIG_KEYS.GEMINI_API_KEY) || '';

    // 1. Intentar servidor proxy
    try {
      const res = await fetch('/api/gemini/financial-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: dataSummary,
          apiKey: customKey,
          model: 'gemini-3.1-flash-lite'
        })
      });
      if (res.ok) {
        const resJson = await res.json();
        reportData = cleanJson(resJson.text);
      }
    } catch (e) {
      console.warn('Backend financial insights proxy error, trying direct...', e);
    }

    // 2. Direct fallback
    if (!reportData) {
      const candidateKeys = Array.from(new Set([customKey, ...DEFAULTS.GEMINI_API_KEYS])).filter(Boolean);
      for (const model of DEFAULTS.GEMINI_MODELS_FAST) {
        for (const key of candidateKeys) {
          try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
              })
            });
            if (res.ok) {
              const resJson = await res.json();
              const raw = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
              reportData = cleanJson(raw);
              break;
            }
          } catch (e) {}
        }
        if (reportData) break;
      }
    }

    if (!reportData) throw new Error('No response');

    reportCard.classList.remove('hidden');
    document.getElementById('aiHeadline').textContent = reportData.headline || 'Balance operativo consolidado.';
    document.getElementById('aiHealthScore').textContent = `${reportData.healthScore || 85} / 100`;
    document.getElementById('aiCommercialInsight').textContent = reportData.commercialInsight || `Ventas totales de S/ ${totalVentas.toFixed(2)}.`;
    document.getElementById('aiTaxInsight').textContent = reportData.taxInsight || `Balance de IGV en S/ ${(igvDebito - igvCredito).toFixed(2)}.`;
    document.getElementById('aiCostInsight').textContent = reportData.costInsight || `Control estricto de compras sugerido.`;

    const actionsList = document.getElementById('aiKeyActionsList');
    if (reportData.keyActions && Array.isArray(reportData.keyActions)) {
      actionsList.innerHTML = reportData.keyActions.map(act => `
        <div class="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-start gap-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${act.priority === 'Inmediata' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
            ${act.priority || 'Alta'}
          </span>
          <div>
            <p class="font-bold text-white">${act.title}</p>
            <p class="text-slate-400 text-[11px] mt-0.5">${act.desc || act.description || ''}</p>
          </div>
        </div>
      `).join('');
    }

    showToast('Diagnóstico financiero generado con éxito.', 'success');
  } catch (err) {
    // Fallback local report
    reportCard.classList.remove('hidden');
    document.getElementById('aiHeadline').textContent = `Desempeño financiero analizado: S/ ${totalVentas.toFixed(2)} facturados.`;
    document.getElementById('aiHealthScore').textContent = utilidad >= 0 ? '85 / 100' : '45 / 100';
    document.getElementById('aiCommercialInsight').textContent = `Se registran ${state.sales.length} comprobantes de venta emitidos.`;
    document.getElementById('aiTaxInsight').textContent = igvDebito <= igvCredito ? 'Dispones de Crédito Fiscal a favor ante SUNAT.' : 'Presentas Débito Fiscal a regularizar.';
    document.getElementById('aiCostInsight').textContent = `Gastos acumulados de S/ ${totalGastos.toFixed(2)}.`;
    showToast('Diagnóstico calculado localmente.', 'info');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-slate-950"></i><span>Diagnóstico CFO Virtual IA</span>`;
    initIcons();
  }
}

// =============================================================================
// 14. EXPORTACIÓN DE DATOS A FORMATO CSV (EXCEL COMPATIBLE)
// =============================================================================
function exportSalesToCSV() {
  if (state.sales.length === 0) {
    showToast('No hay ventas registradas para exportar.', 'warning');
    return;
  }

  const headers = ['Fecha Emision', 'Cliente / Razon Social', 'RUC/DNI', 'Tipo', 'Serie', 'Numero', 'Concepto', 'Base Imponible', 'IGV', 'Total', 'Detraccion', 'Neto a Cobrar', 'Enlace Drive'];
  const rows = state.sales.map(s => [
    `"${s.date || ''}"`,
    `"${(s.clientName || '').replace(/"/g, '""')}"`,
    `"${s.clientDocNumber || ''}"`,
    `"${s.type || ''}"`,
    `"${s.series || ''}"`,
    `"${s.number || ''}"`,
    `"${(s.concept || '').replace(/"/g, '""')}"`,
    (Number(s.base) || 0).toFixed(2),
    (Number(s.igv) || 0).toFixed(2),
    (Number(s.total) || 0).toFixed(2),
    (Number(s.detractionAmount) || 0).toFixed(2),
    (Number(s.netPay) || Number(s.total) || 0).toFixed(2),
    `"${s.fileUrl || ''}"`
  ]);

  downloadCSV(`Ventas_${getCompanyName().replace(/\s+/g, '_')}_${Date.now()}.csv`, headers, rows);
}

function exportExpensesToCSV() {
  if (state.expenses.length === 0) {
    showToast('No hay gastos registrados para exportar.', 'warning');
    return;
  }

  const headers = ['Categoria', 'Fecha Emision', 'Proveedor / Razon Social', 'RUC/DNI', 'Tipo', 'Serie', 'Numero', 'Concepto', 'Base Imponible', 'IGV', 'Total', 'Neto Pagado', 'Enlace Drive'];
  const rows = state.expenses.map(e => [
    `"${e.expenseCategory || ''}"`,
    `"${e.date || ''}"`,
    `"${(e.supplierName || '').replace(/"/g, '""')}"`,
    `"${e.supplierDocNumber || ''}"`,
    `"${e.type || ''}"`,
    `"${e.series || ''}"`,
    `"${e.number || ''}"`,
    `"${(e.concept || '').replace(/"/g, '""')}"`,
    (Number(e.base) || 0).toFixed(2),
    (Number(e.igv) || 0).toFixed(2),
    (Number(e.total) || 0).toFixed(2),
    (Number(e.netPay) || Number(e.total) || 0).toFixed(2),
    `"${e.fileUrl || ''}"`
  ]);

  downloadCSV(`Gastos_${getCompanyName().replace(/\s+/g, '_')}_${Date.now()}.csv`, headers, rows);
}

function downloadCSV(filename, headers, rows) {
  const csvContent = '\uFEFF' + headers.join(';') + '\n' + rows.map(r => r.join(';')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Archivo CSV descargado con éxito.', 'success');
}

// =============================================================================
// 15. MODAL DE CONFIRMACIÓN
// =============================================================================
function closeConfirmModal() {
  document.getElementById('confirmModal').classList.add('hidden');
  state.deleteAction = null;
}

document.getElementById('confirmModalOkBtn')?.addEventListener('click', () => {
  if (typeof state.deleteAction === 'function') {
    state.deleteAction();
  }
  closeConfirmModal();
});

// Expose all state and functions to window for module bundling compatibility
if (typeof window !== 'undefined') {
  Object.assign(window, {
    state,
    CONFIG_KEYS,
    DEFAULTS,
    initIcons,
    showToast,
    checkAuth,
    handleLoginSubmit,
    toggleLoginPassword,
    handleLogout,
    getCompanyName,
    getCompanyRuc,
    getAppsScriptUrl,
    getSpreadsheetUrl,
    getDriveFolderId,
    loadStoredSettings,
    openConfigModal,
    closeConfigModal,
    switchConfigTab,
    saveCloudConfig,
    copyAppsScriptCode,
    generateAppsScriptCode,
    triggerCloudSync,
    testCloudConnection,
    generateAiExecutiveReport,
    updateSyncIndicator,
    compressImageToBase64,
    cleanJson,
    enforceConceptBusinessLogic,
    parseQrSunat,
    loadLocalData,
    saveSalesLocal,
    saveExpensesLocal,
    getSampleSales,
    getSampleExpenses,
    switchModule,
    renderCurrentModule,
    switchSalesTab,
    renderSalesModule,
    renderSalesTable,
    toggleSelectSale,
    toggleSelectAllSales,
    clearSalesSelection,
    updateSalesBulkActionBar,
    confirmBulkDeleteSales,
    handleSaleBaseChange,
    handleSaleIgvChange,
    handleSaleTotalChange,
    handleSaleDetractionRateChange,
    recalcSaleDetraction,
    handleSaveSale,
    editSale,
    resetSaleForm,
    confirmDeleteSale,
    renderCustomersTable,
    switchExpensesTab,
    renderExpensesModule,
    renderExpensesTable,
    toggleSelectExpense,
    toggleSelectAllExpenses,
    clearExpensesSelection,
    updateExpensesBulkActionBar,
    confirmBulkDeleteExpenses,
    handleExpenseTypeChange,
    handleExpenseBaseChange,
    handleExpenseIgvChange,
    handleExpenseTotalChange,
    handleExpenseDetractionRateChange,
    recalcExpenseDetraction,
    handleSaveExpense,
    editExpense,
    resetExpenseForm,
    confirmDeleteExpense,
    renderSuppliersTable,
    handleDragOver,
    handleDragLeave,
    handleFileDrop,
    handleFileSelect,
    processQrSunat,
    renderReportsModule,
    switchReportsSubTab,
    renderActiveReportsTable,
    exportActiveReportToCsv,
    renderFinancialCharts,
    exportSalesToCSV,
    exportExpensesToCSV,
    downloadCSV,
    closeConfirmModal
  });
}

