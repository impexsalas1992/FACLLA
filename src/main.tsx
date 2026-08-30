import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
      // If tapping an input or button, allow normal interaction but prevent viewport zoom
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
    <App />
  </StrictMode>,
);

