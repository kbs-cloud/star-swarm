import { authService } from './services';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
}

export interface UserAccount {
  email: string;
  displayName: string | null;
  isGoogleLinked: boolean;
  hasPassword?: boolean;
  stats: UserStats;
}

/**
 * Extracts a cookie value by name from document.cookie.
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

/**
 * Bootstraps the CSRF handshake token.
 */
export async function initCSRF(): Promise<void> {
  return authService.initCSRF();
}

/**
 * Calls registration to register a new account.
 */
export async function registerUser(email: string, password?: string): Promise<{ success: boolean; message: string }> {
  return authService.registerUser(email, password);
}

/**
 * Authenticates using email and password.
 */
export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  return authService.loginUser(email, password);
}

/**
 * Checks if real Google OAuth is configured.
 */
export async function checkGoogleOAuthConfig(): Promise<{ enabled: boolean }> {
  return authService.checkGoogleOAuthConfig();
}

/**
 * Checks if the user is already authenticated via cookies.
 */
export async function checkSession(): Promise<UserAccount | null> {
  return authService.checkSession();
}

/**
 * Synchronous query for the active session cache.
 */
export function getCurrentUser(): UserAccount | null {
  return authService.getCurrentUser();
}

/**
 * Logs out and clears the session cookie.
 */
export async function logoutUser(): Promise<void> {
  return authService.logoutUser();
}

/**
 * Updates win/loss telemetry stats.
 */
export async function recordGameStats(email: string, won: boolean): Promise<void> {
  return authService.recordGameStats(email, won);
}
