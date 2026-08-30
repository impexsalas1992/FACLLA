import React, { useState } from 'react';
import { Lock, User, ShieldCheck, AlertCircle, Eye, EyeOff, Receipt } from 'lucide-react';
import { getCompanyName } from '../utils/googleSheetsSync';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toUpperCase().replace(/\s+/g, '');
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Por favor ingrese su usuario y contraseña.');
      return;
    }

    if (
      (cleanUsername === 'IMPEXSALAS' || cleanUsername === 'SALAS' || cleanUsername === 'AGRICARL' || cleanUsername === 'ADMIN') &&
      (cleanPassword === 'impexsalas' || cleanPassword === 'IMPEXSALAS' || cleanPassword === 'lozada105' || cleanPassword === 'llauri1992' || cleanPassword === 'admin' || cleanPassword === 'salas2026')
    ) {
      localStorage.setItem('impexsalas_session_v1', 'true');
      localStorage.setItem('agricarl_session_v1', 'true');
      onLoginSuccess();
    } else {
      setError('Usuario o contraseña incorrectos. Verifique sus datos.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shadow-inner mb-1">
            <Receipt className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center justify-center gap-2">
              ControlVentas&Gastos<span className="text-emerald-400">.AI</span>
            </h1>
            <p className="text-xs text-yellow-400 font-bold tracking-wide uppercase mt-1">
              Empresa {getCompanyName()}
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Ingreso al Sistema de Control Fiscal, Ventas, Gastos y Consultas Inteligentes SUNAT
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-medium animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">
              Usuario
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: IMPEXSALAS"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition uppercase"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-xl text-xs transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 mt-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Iniciar Sesión en {getCompanyName()}</span>
          </button>
        </form>

        {/* Footer info inside login box */}
        <div className="pt-4 border-t border-slate-800 text-center text-[11px] text-slate-500 space-y-1">
          <p>Credenciales asignadas para el personal de <strong className="text-yellow-400 font-bold">{getCompanyName()}</strong></p>
          <p className="text-[10px]">Acceso seguro y protegido &bull; 2026</p>
        </div>
      </div>
    </div>
  );
};
