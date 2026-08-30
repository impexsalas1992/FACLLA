import { useState, useEffect, useRef, useCallback } from 'react';
import { ActiveModule, SaleItem, ExpenseItem } from './types';
import { loadSales, saveSales, loadExpenses, saveExpenses, getDeletedIds, addDeletedId, addDeletedIds, addDeletedItem, addDeletedItems, unmarkDeletedItem, clearDeletedIds } from './utils/storage';
import { getAppsScriptUrl, loadFromGoogleSheets, syncToGoogleSheets, getCompanyName, getCompanyRuc } from './utils/googleSheetsSync';
import { PRIMARY_GEMINI_KEY } from './utils/aiService';
import { Header, ViewMode } from './components/Header';
import { Login } from './components/Login';
import { SalesModule } from './components/SalesModule/SalesModule';
import { ExpensesModule } from './components/ExpensesModule/ExpensesModule';
import { ReportsModule } from './components/ReportsModule/ReportsModule';
import { DashboardModule } from './components/DashboardModule/DashboardModule';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { Monitor, Tablet, Smartphone, Maximize2, RefreshCw, CheckCircle2, Cloud } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('impexsalas_session_v1') === 'true' || localStorage.getItem('agricarl_session_v1') === 'true';
  });

  const [activeModule, setActiveModule] = useState<ActiveModule>('sales');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('app_visual_viewmode');
    return (saved === 'tablet' || saved === 'mobile') ? saved : 'desktop';
  });

  const [salesData, setSalesData] = useState<SaleItem[]>(() => loadSales());
  const [expensesData, setExpensesData] = useState<ExpenseItem[]>(() => loadExpenses());

  const [companyName, setCompanyNameState] = useState<string>(() => getCompanyName());
  const [companyRuc, setCompanyRucState] = useState<string>(() => getCompanyRuc());

  const [apiKey, setApiKey] = useState(() => {
    const stored = localStorage.getItem('gemini_api_key');
    if (
      !stored ||
      stored === 'AQ.Ab8RN6IyoXIj5g6yOiIaWhoOSQKtlxwyeKBC8PFEmoKLFU2lXg' ||
      stored === 'AQ.Ab8RN6LARm3hAsOc0RcuqeMMxGRdZxKpdD_O3j5xGFan6jGYPg'
    ) {
      localStorage.setItem('gemini_api_key', PRIMARY_GEMINI_KEY);
      return PRIMARY_GEMINI_KEY;
    }
    return stored;
  });
  const [selectedModel, setSelectedModel] = useState(() => {
    const stored = localStorage.getItem('gemini_selected_model');
    if (!stored || stored.includes('2.') || stored.includes('1.5')) {
      localStorage.setItem('gemini_selected_model', 'gemini-3.7-flash');
      return 'gemini-3.7-flash';
    }
    return stored;
  });
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState(false);
  const [sheetsModalTab, setSheetsModalTab] = useState<'drive' | 'sheets' | 'script' | 'config_sheet'>('sheets');
  const [isSheetsConnected, setIsSheetsConnected] = useState(() => !!getAppsScriptUrl());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(() => {
    const initialSales = loadSales();
    const initialExp = loadExpenses();
    return initialSales.length === 0 && initialExp.length === 0;
  });
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => localStorage.getItem('agricarl_last_sync_timestamp') || '');
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  const handleOpenSheetsModal = (tab: 'drive' | 'sheets' | 'script' | 'config_sheet' = 'sheets') => {
    setSheetsModalTab(tab);
    setIsSheetsModalOpen(true);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('app_visual_viewmode', mode);
  };

  // Sync locks, queueing, and debouncing refs
  const isPushingRef = useRef(false);
  const isPullingRef = useRef(false);
  const isPushPendingRef = useRef(false);
  const isLocalDirtyRef = useRef(false);
  const pendingPushDataRef = useRef<{ sales: SaleItem[]; expenses: ExpenseItem[]; isManual?: boolean } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedHashRef = useRef<string>('');
  const initialLoadDoneRef = useRef(false);

  // Push local data to Google Sheets (Reflects all additions, edits, and deletions made in the App)
  const pushToCloud = useCallback(async (sales: SaleItem[], expenses: ExpenseItem[], isManual = false): Promise<boolean> => {
    const scriptUrl = getAppsScriptUrl();
    if (!scriptUrl) {
      isPushPendingRef.current = false;
      isLocalDirtyRef.current = false;
      pendingPushDataRef.current = null;
      return false;
    }

    const payloadHash = JSON.stringify({ sales, expenses });
    // Prevent duplicate push if data hasn't changed unless manual
    if (!isManual && payloadHash === lastSyncedHashRef.current) {
      isPushPendingRef.current = false;
      isLocalDirtyRef.current = false;
      pendingPushDataRef.current = null;
      return true;
    }

    // Safety guard: do not push empty data if initial load hasn't completed
    if (!initialLoadDoneRef.current && sales.length === 0 && expenses.length === 0) {
      return false;
    }

    // If another push is already running in background, queue the latest state so it runs immediately after
    if (isPushingRef.current) {
      pendingPushDataRef.current = { sales, expenses, isManual };
      return false;
    }

    isPushingRef.current = true;
    setIsSyncing(true);

    try {
      const success = await syncToGoogleSheets(sales, expenses, scriptUrl);
      if (success) {
        lastSyncedHashRef.current = payloadHash;
        isPushPendingRef.current = false;
        isLocalDirtyRef.current = false;
        clearDeletedIds();
        setIsSheetsConnected(true);
        const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowFormatted);
        localStorage.setItem('agricarl_last_sync_timestamp', nowFormatted);
      }
      return success;
    } catch (err) {
      console.error('Error sincronizando con Google Sheets:', err);
      return false;
    } finally {
      isPushingRef.current = false;
      setIsSyncing(false);

      // If a new mutation (like deletion or edit) occurred while network was busy, fire the queued push immediately!
      if (pendingPushDataRef.current) {
        const queued = pendingPushDataRef.current;
        pendingPushDataRef.current = null;
        const queuedHash = JSON.stringify({ sales: queued.sales, expenses: queued.expenses });
        if (queuedHash !== lastSyncedHashRef.current || queued.isManual) {
          setTimeout(() => {
            pushToCloud(queued.sales, queued.expenses, queued.isManual);
          }, 30);
        }
      }
    }
  }, []);

  // Pull data from Google Sheets (Google Sheets is the Single Source of Truth across all devices)
  const pullFromCloud = useCallback(async (showIndicator = false, isInitial = false) => {
    const scriptUrl = getAppsScriptUrl();
    if (!scriptUrl) {
      initialLoadDoneRef.current = true;
      setIsInitialLoading(false);
      return null;
    }

    // Do not pull if a push is in-flight or if local unsaved changes are pending
    if (isPushingRef.current || isPullingRef.current || isPushPendingRef.current) return null;
    isPullingRef.current = true;

    if (showIndicator || isInitial) setIsSyncing(true);
    try {
      const cloudData = await loadFromGoogleSheets(scriptUrl);
      if (cloudData) {
        const rawCloudSales = Array.isArray(cloudData.sales) ? cloudData.sales : [];
        const rawCloudExpenses = Array.isArray(cloudData.expenses) ? cloudData.expenses : [];

        // Current local state & deleted tracking at the moment cloud data returns
        const currentLocalSales = loadSales();
        const currentLocalExpenses = loadExpenses();
        const deletedIds = getDeletedIds();

        const isItemExplicitlyDeleted = (item: { id?: string; series?: string; number?: string }) => {
          if (!item) return false;
          if (item.id && deletedIds.has(String(item.id).trim())) return true;
          const key = `${item.series || ''}-${item.number || ''}`.toLowerCase().trim();
          if (key && key !== '-' && key !== 'f001-000001' && deletedIds.has(key)) return true;
          if (key && key !== '-' && key !== 'f001-000001' && deletedIds.has(`sale_${key}`)) return true;
          if (key && key !== '-' && key !== 'f001-000001' && deletedIds.has(`exp_${key}`)) return true;
          return false;
        };

        // Filter out explicitly deleted items from cloud results
        const filteredCloudSales = rawCloudSales.filter(c => !isItemExplicitlyDeleted(c));
        const filteredCloudExpenses = rawCloudExpenses.filter(c => !isItemExplicitlyDeleted(c));

        // 1. Process cloud sales & enrich with locally cached attachment data (e.g. storedBase64, local file references)
        const finalCloudSales: SaleItem[] = filteredCloudSales.map(cloudItem => {
          const key = `${cloudItem.series || ''}-${cloudItem.number || ''}`.toLowerCase().trim();
          const localMatch = currentLocalSales.find(
            l => l.id === cloudItem.id || (key && key !== '-' && `${l.series || ''}-${l.number || ''}`.toLowerCase().trim() === key)
          );
          if (localMatch) {
            return {
              ...cloudItem,
              fileUrl: cloudItem.fileUrl || localMatch.fileUrl,
              fileName: cloudItem.fileName || localMatch.fileName,
              fileDrivePath: cloudItem.fileDrivePath || localMatch.fileDrivePath,
              isPendingScan: cloudItem.isPendingScan !== undefined ? cloudItem.isPendingScan : localMatch.isPendingScan,
              storedBase64: localMatch.storedBase64,
              storedMimeType: localMatch.storedMimeType,
              createdAt: cloudItem.createdAt || localMatch.createdAt,
            };
          }
          return cloudItem;
        });

        // Google Sheets is the Single Source of Truth: if a row was deleted in Google Sheets,
        // it is immediately removed from the application as well.
        const finalSales: SaleItem[] = finalCloudSales;

        // 2. Process cloud expenses & enrich with locally cached attachment data
        const finalCloudExpenses: ExpenseItem[] = filteredCloudExpenses.map(cloudItem => {
          const key = `${cloudItem.series || ''}-${cloudItem.number || ''}`.toLowerCase().trim();
          const localMatch = currentLocalExpenses.find(
            l => l.id === cloudItem.id || (key && key !== '-' && `${l.series || ''}-${l.number || ''}`.toLowerCase().trim() === key)
          );
          if (localMatch) {
            return {
              ...cloudItem,
              fileUrl: cloudItem.fileUrl || localMatch.fileUrl,
              fileName: cloudItem.fileName || localMatch.fileName,
              fileDrivePath: cloudItem.fileDrivePath || localMatch.fileDrivePath,
              isPendingScan: cloudItem.isPendingScan !== undefined ? cloudItem.isPendingScan : localMatch.isPendingScan,
              storedBase64: localMatch.storedBase64,
              storedMimeType: localMatch.storedMimeType,
              createdAt: cloudItem.createdAt || localMatch.createdAt,
            };
          }
          return cloudItem;
        });

        // If a row was deleted in Google Sheets, it is immediately removed from the application
        const finalExpenses: ExpenseItem[] = finalCloudExpenses;

        // 3. Set the synchronized state
        setSalesData(finalSales);
        saveSales(finalSales);

        setExpensesData(finalExpenses);
        saveExpenses(finalExpenses);

        lastSyncedHashRef.current = JSON.stringify({ sales: finalSales, expenses: finalExpenses });

        // Si la hoja Google Sheets contiene datos de configuración actualizados, aplicarlos al estado
        if (cloudData.appliedConfig) {
          if (cloudData.appliedConfig.companyName) {
            setCompanyNameState(cloudData.appliedConfig.companyName);
          }
          if (cloudData.appliedConfig.companyRuc) {
            setCompanyRucState(cloudData.appliedConfig.companyRuc);
          }
        }

        setIsSheetsConnected(true);
        const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(nowFormatted);
        localStorage.setItem('agricarl_last_sync_timestamp', nowFormatted);

        if (showIndicator) {
          setSyncToastMessage(`Sincronizado con Google Sheets: ${finalSales.length} ventas y ${finalExpenses.length} gastos actualizados`);
          setTimeout(() => setSyncToastMessage(null), 3000);
        }

        return { sales: finalSales, expenses: finalExpenses };
      }
      return null;
    } catch (err) {
      console.warn('Google Sheets Sync (usando datos locales):', err);
      return null;
    } finally {
      if (showIndicator || isInitial) setIsSyncing(false);
      isPullingRef.current = false;
      initialLoadDoneRef.current = true;
      setIsInitialLoading(false);
    }
  }, [pushToCloud]);

  // Initial load on startup / page refresh: ALWAYS pull latest records directly from Google Sheets
  useEffect(() => {
    if (isAuthenticated) {
      pullFromCloud(true, true);
    }
  }, [isAuthenticated, pullFromCloud]);

  // Listen for configuration updates synced from Google Sheets or modals & deletions
  useEffect(() => {
    const handleConfigSync = (e: any) => {
      if (e.detail?.companyName) {
        setCompanyNameState(e.detail.companyName);
      }
      if (e.detail?.companyRuc) {
        setCompanyRucState(e.detail.companyRuc);
      }
    };
    const handleCompanyUpdate = (e: any) => {
      if (e.detail?.name) {
        setCompanyNameState(e.detail.name);
      }
    };
    const handleItemAddedOrUpdated = (e: any) => {
      // Unmark from deleted list if re-added or newly created
      if (e.detail?.item) {
        unmarkDeletedItem(e.detail.item);
      }

      // Immediate push when a new voucher or sale/expense is registered or modified
      isLocalDirtyRef.current = true;
      isPushPendingRef.current = true;

      const salesToPush = e.detail?.allSales || loadSales();
      const expensesToPush = e.detail?.allExpenses || loadExpenses();

      if (e.detail?.allSales) {
        setSalesData(e.detail.allSales);
        saveSales(e.detail.allSales);
      }
      if (e.detail?.allExpenses) {
        setExpensesData(e.detail.allExpenses);
        saveExpenses(e.detail.allExpenses);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        pushToCloud(salesToPush, expensesToPush, true);
      }, 50);
    };
    const handleItemDeleted = (e: any) => {
      if (e.detail?.item) {
        addDeletedItem(e.detail.item);
      } else if (e.detail?.id) {
        addDeletedId(e.detail.id);
      }

      if (Array.isArray(e.detail?.items)) {
        addDeletedItems(e.detail.items);
      } else if (Array.isArray(e.detail?.ids)) {
        addDeletedIds(e.detail.ids);
      }

      isLocalDirtyRef.current = true;
      isPushPendingRef.current = true;

      const salesToPush = e.detail?.allSales || loadSales();
      const expensesToPush = e.detail?.allExpenses || loadExpenses();

      if (e.detail?.allSales) {
        setSalesData(e.detail.allSales);
        saveSales(e.detail.allSales);
      }
      if (e.detail?.allExpenses) {
        setExpensesData(e.detail.allExpenses);
        saveExpenses(e.detail.allExpenses);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        pushToCloud(salesToPush, expensesToPush, true);
      }, 50);
    };

    window.addEventListener('app-config-synced-from-sheets', handleConfigSync);
    window.addEventListener('company-updated', handleCompanyUpdate);
    window.addEventListener('app-item-added', handleItemAddedOrUpdated);
    window.addEventListener('app-force-push', handleItemAddedOrUpdated);
    window.addEventListener('app-item-deleted', handleItemDeleted);

    return () => {
      window.removeEventListener('app-config-synced-from-sheets', handleConfigSync);
      window.removeEventListener('company-updated', handleCompanyUpdate);
      window.removeEventListener('app-item-added', handleItemAddedOrUpdated);
      window.removeEventListener('app-force-push', handleItemAddedOrUpdated);
      window.removeEventListener('app-item-deleted', handleItemDeleted);
    };
  }, [pushToCloud]);

  // Auto-sync when returning to the tab (window focus / visibilitychange) & periodic background refresh
  useEffect(() => {
    if (!isAuthenticated) return;

    let focusTimer: NodeJS.Timeout | null = null;
    const handleFocus = () => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        if (!isPushingRef.current && !isPullingRef.current && !isPushPendingRef.current) {
          pullFromCloud(false, false);
        }
      }, 500);
    };

    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Background interval check every 10 seconds to automatically catch edits or deletions in Google Sheets
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && !isPushingRef.current && !isPullingRef.current && !isPushPendingRef.current) {
        pullFromCloud(false, false);
      }
    }, 10000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (focusTimer) clearTimeout(focusTimer);
      clearInterval(intervalTimer);
    };
  }, [isAuthenticated, pullFromCloud]);

  // Persist locally IMMEDIATELY on every change, then auto-push modifications to Google Sheets
  useEffect(() => {
    saveSales(salesData);
    saveExpenses(expensesData);

    if (!isAuthenticated) return;
    if (!initialLoadDoneRef.current) return;
    if (isPullingRef.current) return;

    const currentHash = JSON.stringify({ sales: salesData, expenses: expensesData });
    if (currentHash === lastSyncedHashRef.current) return;

    isLocalDirtyRef.current = true;
    isPushPendingRef.current = true;

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce push by 200ms so user edits in the app are automatically saved to Google Sheets
    debounceTimerRef.current = setTimeout(() => {
      pushToCloud(salesData, expensesData);
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [salesData, expensesData, isAuthenticated, pushToCloud]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('gemini_selected_model', selectedModel);
  }, [selectedModel]);

  const handleLogout = () => {
    localStorage.removeItem('impexsalas_session_v1');
    localStorage.removeItem('agricarl_session_v1');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="bg-slate-900 text-slate-100 min-h-screen font-sans flex flex-col antialiased">
      {/* Top Header Navigation with Realtime Sync & Device View Controls */}
      <Header
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        apiKey={apiKey}
        setApiKey={setApiKey}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        onLogout={handleLogout}
        onOpenSheetsModal={handleOpenSheetsModal}
        isSheetsConnected={isSheetsConnected}
        isSyncing={isSyncing}
        lastSyncTime={lastSyncTime}
        onManualSync={() => pullFromCloud(true, false)}
        companyName={companyName}
        viewMode={viewMode}
        setViewMode={handleViewModeChange}
      />

      {/* Global Sync Notification Toast */}
      {syncToastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600/95 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-2.5 text-sm font-medium border border-emerald-400/40 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-100 flex-shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Initial Cloud Loading Overlay for New Device First Connect */}
      {isInitialLoading && salesData.length === 0 && expensesData.length === 0 && (
        <div className="bg-emerald-950/40 border-b border-emerald-600/30 px-4 py-2.5 text-center text-xs flex items-center justify-center gap-2.5 text-emerald-200">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Cargando y sincronizando datos guardados desde Google Sheets...</span>
        </div>
      )}

      {/* Device Viewport Mode Indicator Banner (when Tablet or Mobile is selected) */}
      {viewMode !== 'desktop' && (
        <div className="bg-slate-800/90 border-b border-slate-700 px-4 py-2 text-center text-xs flex items-center justify-center gap-3">
          <span className="flex items-center gap-1.5 text-slate-300 font-medium">
            {viewMode === 'tablet' ? (
              <>
                <Tablet className="w-4 h-4 text-sky-400" />
                <span>Simulación de <strong>Tableta (768px)</strong> activa</span>
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4 text-purple-400" />
                <span>Simulación de <strong>Smartphone Móvil (390px)</strong> activa</span>
              </>
            )}
          </span>
          <button
            onClick={() => handleViewModeChange('desktop')}
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 underline font-semibold transition text-xs"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Volver a PC (Pantalla completa)</span>
          </button>
        </div>
      )}

      {/* Main Content Area: Fully responsive and native-app comfortable on all screens */}
      <div className="flex-1 w-full flex justify-center">
        <main
          className={`w-full transition-all duration-300 ${
            viewMode === 'desktop'
              ? 'max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-6'
              : viewMode === 'tablet'
              ? 'max-w-[768px] mx-auto px-3 sm:px-5 py-4 space-y-4'
              : 'max-w-[480px] mx-auto px-2 sm:px-3 py-3 space-y-3'
          }`}
        >
          {activeModule === 'dashboard' && (
            <DashboardModule
              salesData={salesData}
              expensesData={expensesData}
              setActiveModule={setActiveModule}
              onOpenSettings={() => handleOpenSheetsModal('script')}
            />
          )}

          {activeModule === 'sales' && (
            <SalesModule
              salesData={salesData}
              setSalesData={setSalesData}
              apiKey={apiKey}
              selectedModel={selectedModel}
              onOpenSettings={() => handleOpenSheetsModal('script')}
              onManualSync={() => pullFromCloud(true, false)}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
            />
          )}

          {activeModule === 'expenses' && (
            <ExpensesModule
              expensesData={expensesData}
              setExpensesData={setExpensesData}
              apiKey={apiKey}
              selectedModel={selectedModel}
              onOpenSettings={() => handleOpenSheetsModal('script')}
              onManualSync={() => pullFromCloud(true, false)}
              isSyncing={isSyncing}
              lastSyncTime={lastSyncTime}
            />
          )}

          {activeModule === 'reports' && (
            <ReportsModule
              salesData={salesData}
              expensesData={expensesData}
              apiKey={apiKey}
              selectedModel={selectedModel}
              onOpenSettings={() => handleOpenSheetsModal('script')}
            />
          )}
        </main>
      </div>

      {/* Floating Quick Viewport Switcher Toolbar */}
      <div className="fixed bottom-4 right-4 z-40 bg-slate-800/95 border border-slate-600 rounded-full p-1 shadow-2xl flex items-center gap-1 backdrop-blur-md">
        <button
          onClick={() => handleViewModeChange('desktop')}
          className={`p-2 rounded-full transition ${
            viewMode === 'desktop'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Ver en modo PC / Escritorio"
        >
          <Monitor className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleViewModeChange('tablet')}
          className={`p-2 rounded-full transition ${
            viewMode === 'tablet'
              ? 'bg-sky-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Ver en modo Tableta (768px)"
        >
          <Tablet className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleViewModeChange('mobile')}
          className={`p-2 rounded-full transition ${
            viewMode === 'mobile'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
          title="Ver en modo Móvil (390px)"
        >
          <Smartphone className="w-4 h-4" />
        </button>
      </div>

      {/* Google Sheets Database Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        initialTab={sheetsModalTab}
        companyName={companyName}
        companyRuc={companyRuc}
        onCompanyChange={(name, ruc) => {
          setCompanyNameState(name);
          setCompanyRucState(ruc);
        }}
        onClose={() => {
          setIsSheetsModalOpen(false);
          setIsSheetsConnected(!!getAppsScriptUrl());
        }}
        salesData={salesData}
        expensesData={expensesData}
        onDataLoaded={(newSales, newExpenses) => {
          // Direct, clean adoption of loaded data
          setSalesData(newSales);
          saveSales(newSales);
          setExpensesData(newExpenses);
          saveExpenses(newExpenses);
          lastSyncedHashRef.current = JSON.stringify({ sales: newSales, expenses: newExpenses });
          setIsSheetsConnected(true);
          const nowFormatted = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastSyncTime(nowFormatted);
          localStorage.setItem('agricarl_last_sync_timestamp', nowFormatted);
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-800/80 border-t border-slate-700/60 py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistema Integrado de Control de Ventas, Gastos & Resúmenes Mensuales &copy; 2026 <strong>{companyName}</strong></span>
          <span className="text-slate-500">Sincronización Bidireccional Automática con Google Sheets & Carpetas Google Drive</span>
        </div>
      </footer>
    </div>
  );
}
