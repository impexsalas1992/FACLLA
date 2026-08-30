import React, { StrictMode, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState;
  props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('App runtime error caught by ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center mx-auto text-red-400 text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-slate-100">Se produjo un error al iniciar la aplicación</h1>
            <p className="text-xs text-slate-400 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-left overflow-auto max-h-32">
              {this.state.error?.message || 'Error desconocido'}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition shadow-lg"
              >
                Recargar página
              </button>
              <button
                onClick={() => {
                  try {
                    localStorage.clear();
                    window.location.reload();
                  } catch (e) {}
                }}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition border border-slate-700"
              >
                Limpiar datos
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Prevent mobile multi-finger pinch-to-zoom and gesture zooming across iOS and Android
if (typeof window !== 'undefined') {
  // Prevent iOS Safari gesture events (pinch-to-zoom)
  document.addEventListener('gesturestart', (e: Event) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gesturechange', (e: Event) => {
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('gestureend', (e: Event) => {
    e.preventDefault();
  }, { passive: false });

  // Prevent multi-touch touchstart/touchmove gestures that trigger pinch zoom
  document.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e: TouchEvent) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // Prevent fast double-tap zooming on mobile touchscreens
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e: TouchEvent) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      const target = e.target as HTMLElement | null;
      if (!target || !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)) {
        e.preventDefault();
      }
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Prevent Ctrl + Mouse Wheel zooming on desktop/trackpads
  document.addEventListener('wheel', (e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
    }
  }, { passive: false });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


