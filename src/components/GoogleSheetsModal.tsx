import React, { useState } from 'react';
import {
  Copy,
  Check,
  X,
  Code2,
  Sparkles,
  FileCode
} from 'lucide-react';
import {
  generateAppsScriptCode,
  getGoogleDriveFolderId,
  getCompanyName,
  DEFAULT_COMPANY_NAME
} from '../utils/googleSheetsSync';
import { SaleItem, ExpenseItem } from '../types';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  salesData?: SaleItem[];
  expensesData?: ExpenseItem[];
  onDataLoaded?: (sales: SaleItem[], expenses: ExpenseItem[]) => void;
  initialTab?: string;
  companyName?: string;
  companyRuc?: string;
  onCompanyChange?: (name: string, ruc: string) => void;
}

export const GoogleSheetsModal: React.FC<GoogleSheetsModalProps> = ({
  isOpen,
  onClose,
  companyName,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const effectiveRootDriveId = getGoogleDriveFolderId();
  const currentCompanyName = companyName || getCompanyName() || DEFAULT_COMPANY_NAME;
  const currentGeneratedScript = generateAppsScriptCode(effectiveRootDriveId, currentCompanyName);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentGeneratedScript);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl relative space-y-4 text-slate-100 my-6 max-h-[92vh] flex flex-col">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white">Procedimiento del Código Google Apps Script</h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-semibold border border-emerald-500/50 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Listo para Implementar
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-yellow-400 border border-yellow-500/30 font-mono font-bold">
                  {currentCompanyName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Copia y pega este código en tu Google Sheets para habilitar la sincronización de comprobantes y subida a Google Drive.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          <div className="space-y-4">
            
            {/* Guía Paso a Paso */}
            <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-4 text-xs text-slate-300 space-y-2.5 shadow-md">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Procedimiento de Instalación en Google Sheets (5 Pasos Sencillos)</span>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-slate-300 text-xs leading-relaxed pl-1">
                <li>
                  Abre tu hoja de cálculo en <b>Google Sheets</b> y dirígete al menú superior: <b>Extensiones &gt; Apps Script</b>.
                </li>
                <li>
                  En el editor que se abrirá, borra todo el contenido existente en el archivo <code>Código.gs</code>.
                </li>
                <li>
                  Haz clic en el botón naranja <b>"Copiar Código Apps Script"</b> de abajo y pégalo en el editor.
                </li>
                <li>
                  Haz clic en el botón superior: <b>Implementar &gt; Nueva implementación</b>.
                </li>
                <li>
                  Selecciona tipo <b>"Aplicación web"</b>, configura Ejecutar como: <b>"Yo"</b> y Quién tiene acceso: <b>"Cualquier persona" (Anyone)</b>. Luego haz clic en <b>Implementar</b> y acepta los permisos de Google.
                </li>
              </ol>
            </div>

            {/* Header Toolbar con Botón de Copiar */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-amber-400" />
                  Código Fuente Completo (.gs)
                </h4>
                <p className="text-[11px] text-slate-400">
                  Crea automáticamente pestañas de Ventas, Gastos, Carpetas de Clientes/Proveedores y gestiona subidas de comprobantes.
                </p>
              </div>
              <button
                onClick={handleCopyCode}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-amber-950/40 hover:scale-[1.02] border border-amber-400/40"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? '¡Código Copiado al Portapapeles!' : 'Copiar Código Apps Script'}</span>
              </button>
            </div>

            {/* Visor de Código */}
            <div className="relative bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-emerald-400/90 max-h-96 overflow-y-auto shadow-inner">
              <pre>{currentGeneratedScript}</pre>
            </div>

          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handleCopyCode}
            className="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1.5 transition"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedCode ? '¡Copiado con éxito!' : 'Copiar Código'}</span>
          </button>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-2 rounded-xl text-xs font-semibold transition border border-slate-700"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
