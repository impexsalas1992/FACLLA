import React from 'react';
import { ActiveModule } from '../types';
import { getGoogleDriveFolderUrl, getSpreadsheetUrl, getCompanyName, getCompanyShortName } from '../utils/googleSheetsSync';
import {
  LayoutDashboard,
  Receipt,
  ShoppingCart,
  BarChart3,
  LogOut,
  UserCheck,
  FileSpreadsheet,
  ExternalLink,
  FolderOpen,
  Building2,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  Code2
} from 'lucide-react';

export type ViewMode = 'desktop' | 'tablet' | 'mobile';

interface HeaderProps {
  activeModule: ActiveModule;
  setActiveModule: (m: ActiveModule) => void;
  apiKey?: string;
  setApiKey?: (k: string) => void;
  selectedModel?: string;
  setSelectedModel?: (m: string) => void;
  onLogout?: () => void;
  onOpenSheetsModal?: (tab?: 'drive' | 'sheets' | 'script' | 'config_sheet') => void;
  isSheetsConnected?: boolean;
  isSyncing?: boolean;
  lastSyncTime?: string;
  onManualSync?: () => void;
  companyName?: string;
  viewMode?: ViewMode;
  setViewMode?: (mode: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  setActiveModule,
  onLogout,
  onOpenSheetsModal,
  isSheetsConnected,
  isSyncing,
  lastSyncTime,
  onManualSync,
  companyName,
  viewMode = 'desktop',
  setViewMode
}) => {
  const driveFolderUrl = getGoogleDriveFolderUrl();
  const spreadsheetUrl = getSpreadsheetUrl();
  const currentCompanyName = companyName || getCompanyName();
  const shortName = getCompanyShortName(currentCompanyName);

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 py-2 sm:py-0 gap-3">
        {/* Logo & Company Title */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="bg-emerald-500 p-2 rounded-lg text-slate-900 font-bold shadow">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-lg font-bold text-white leading-tight flex items-center">
                ControlVentas&Gastos<span className="text-emerald-400">.AI</span>
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-700/90 text-yellow-400 font-bold ml-1 border border-yellow-500/30 flex items-center gap-1 shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-yellow-400">{currentCompanyName}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">Gestor de Comprobantes, Carpetas Google Drive, Detracciones & Declaraciones SUNAT</p>
          </div>
        </div>

        {/* Device Viewport Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {/* Selector de Modo de Visualización (PC, Tablet, Móvil) */}
          {setViewMode && (
            <div className="flex items-center bg-slate-900/90 border border-slate-700 rounded-lg p-0.5 shadow-inner" title="Opciones de Visualización">
              <button
                onClick={() => setViewMode('desktop')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'desktop'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Vista PC / Escritorio (Ancho Completo)"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden md:inline">PC</span>
              </button>

              <button
                onClick={() => setViewMode('tablet')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'tablet'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Vista Tableta (iPad / 768px)"
              >
                <Tablet className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Tablet</span>
              </button>

              <button
                onClick={() => setViewMode('mobile')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  viewMode === 'mobile'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Vista Móvil / Smartphone (390px)"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Móvil</span>
              </button>
            </div>
          )}

          {/* Botón Sincronización Bidireccional Manual */}
          {isSheetsConnected && onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-sm ${
                isSyncing
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 animate-pulse'
                  : 'bg-slate-700/90 hover:bg-slate-600 border-slate-600 text-slate-200 hover:text-white'
              }`}
              title="Sincronizar ahora: Actualiza cambios bidireccionalmente entre el aplicativo y Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
              {lastSyncTime && !isSyncing && (
                <span className="text-[10px] text-slate-400 font-normal hidden lg:inline ml-0.5">
                  ({lastSyncTime})
                </span>
              )}
            </button>
          )}

          {/* Botón Discreto / Medio Oculto: Código Apps Script */}
          {onOpenSheetsModal && (
            <button
              onClick={() => onOpenSheetsModal('script')}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 opacity-60 hover:opacity-100 hover:bg-slate-800/80 transition"
              title="Código Apps Script"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Botón Ver Registros (Google Sheets Externo) */}
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition hover:text-white"
            title="Abrir Hoja de Cálculo en Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Hoja</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* Botón Carpetas Drive Externo */}
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition hover:text-white"
            title="Abrir Carpeta Principal en Google Drive"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
            <span>Drive</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>

          {/* User Badge & Logout */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide truncate max-w-[100px] sm:max-w-[120px]" title={currentCompanyName}>
              {shortName}
            </span>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Cerrar sesión"
                className="ml-1 p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Module Navigation Tabs */}
      <div className="bg-slate-900/90 border-t border-slate-700/80 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4 text-xs sm:text-sm overflow-x-auto py-1 scrollbar-none">
          {/* Dashboard */}
          <button
            onClick={() => setActiveModule('dashboard')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all touch-manipulation ${
              activeModule === 'dashboard'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Dashboard</span>
          </button>

          {/* Módulo 1 */}
          <button
            onClick={() => setActiveModule('sales')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all touch-manipulation ${
              activeModule === 'sales'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            <span>Módulo 1: Ventas</span>
          </button>

          {/* Módulo 2 */}
          <button
            onClick={() => setActiveModule('expenses')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all touch-manipulation ${
              activeModule === 'expenses'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span>Módulo 2: Gastos</span>
          </button>

          {/* Módulo 3 */}
          <button
            onClick={() => setActiveModule('reports')}
            className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition-all touch-manipulation ${
              activeModule === 'reports'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Módulo 3: Reportes</span>
          </button>
        </div>
      </div>
    </header>
  );
};
