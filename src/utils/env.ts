/**
 * Helper utility to detect if the application is running in an Electron shell environment
 * (either development devServer or packaged build).
 */
export function isElectronMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Check user agent for Electron identifier
  const hasElectronUserAgent = window.navigator.userAgent.toLowerCase().includes('electron');

  // 2. Check if runtime exposes process with electron versions
  const isProcessElectron = !!((window as any).process && (window as any).process.versions && (window as any).process.versions.electron);

  // 3. Check for compile-time environment variable injected by Vite
  const isViteModeElectron = import.meta.env.VITE_BUILD_MODE === 'electron';

  return hasElectronUserAgent || isProcessElectron || isViteModeElectron;
}

/**
 * Helper utility to detect if the application is running inside a Capacitor mobile shell.
 */
export function isCapacitorMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return !!(window as any).Capacitor || window.location.protocol === 'capacitor:';
}

/**
 * Helper utility to detect if the application is running in a packaged local client environment
 * (either Electron or Capacitor).
 */
export function isPackagedMode(): boolean {
  return isElectronMode() || isCapacitorMode();
}

