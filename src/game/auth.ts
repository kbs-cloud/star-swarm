// Star-Swarm Authentication & User Statistics Client (TypeScript)

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

// Memory cache for synchronous UI queries
let currentUserCache: UserAccount | null = null;

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
 * Helper to build default headers with CSRF double-submit token.
 */
function getHeaders(): Record<string, string> {
  const csrfToken = getCookie('csrf_token') || '';
  const guestName = localStorage.getItem('starswarm_guest_name') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken
  };
  if (guestName) {
    headers['X-Guest-Name'] = guestName;
    headers['X-Guest-Email'] = guestName;
  }
  return headers;
}

/**
 * Bootstraps the CSRF handshake token.
 */
export async function initCSRF(): Promise<void> {
  try {
    await fetch('/api/csrf-init');
  } catch (e) {
    console.error('Failed to initialize CSRF token handshake:', e);
  }
}

/**
 * Calls `/api/register` to register a new account on the server.
 */
export async function registerUser(email: string, password?: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok) {
      return { success: true, message: data.message || 'Account registered successfully.' };
    } else {
      return { success: false, message: data.error || 'Failed to register account.' };
    }
  } catch (e) {
    return { success: false, message: 'Server connection failed.' };
  }
}

/**
 * Calls `/api/login` to authenticate using email and password.
 */
export async function loginUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      currentUserCache = data.user;
      return { success: true, message: 'Logged in successfully.', user: data.user };
    } else {
      return { success: false, message: data.error || 'Invalid credentials.' };
    }
  } catch (e) {
    return { success: false, message: 'Server connection failed.' };
  }
}

/**
 * Calls `/api/google-login` to authenticate via Google.
 */
export async function loginWithGoogle(email: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
  try {
    const response = await fetch('/api/google-login', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email })
    });

    const data = await response.json();
    if (response.ok && data.success) {
      currentUserCache = data.user;
      return { success: true, message: 'Google authentication successful.', user: data.user };
    } else {
      return { success: false, message: data.error || 'Google login failed.' };
    }
  } catch (e) {
    return { success: false, message: 'Server connection failed.' };
  }
}

/**
 * Checks if the user is already authenticated via cookies.
 */
export async function checkSession(): Promise<UserAccount | null> {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        currentUserCache = data.user;
        return data.user;
      }
    }
  } catch (e) {
    console.error('Failed to verify active user session cookie:', e);
  }
  currentUserCache = null;
  return null;
}

/**
 * Synchronous query for the active session cache.
 */
export function getCurrentUser(): UserAccount | null {
  return currentUserCache;
}

/**
 * Logs out and clears the session cookie.
 */
export async function logoutUser(): Promise<void> {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      headers: getHeaders()
    });
  } catch (e) {
    console.error('Logout request failed:', e);
  }
  currentUserCache = null;
}

/**
 * Updates win/loss telemetry stats on the server.
 */
export async function recordGameStats(_email: string, won: boolean): Promise<void> {
  try {
    const response = await fetch('/api/stats', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ won })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.stats && currentUserCache) {
        currentUserCache.stats = data.stats;
      }
    }
  } catch (e) {
    console.error('Failed to sync telemetry stats with backend:', e);
  }
}
