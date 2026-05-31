import { IAuthService } from './IAuthService';
import { UserAccount } from '../auth';

export class OnlineAuthService implements IAuthService {
  private currentUserCache: UserAccount | null = null;

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  private getHeaders(): Record<string, string> {
    const csrfToken = this.getCookie('csrf_token') || '';
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

  public async initCSRF(): Promise<void> {
    try {
      await fetch('/api/csrf-init');
    } catch (e) {
      console.error('Failed to initialize CSRF token handshake:', e);
    }
  }

  public async registerUser(email: string, password?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: this.getHeaders(),
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

  public async loginUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        this.currentUserCache = data.user;
        return { success: true, message: 'Logged in successfully.', user: data.user };
      } else {
        return { success: false, message: data.error || 'Invalid credentials.' };
      }
    } catch (e) {
      return { success: false, message: 'Server connection failed.' };
    }
  }

  public async checkGoogleOAuthConfig(): Promise<{ enabled: boolean }> {
    try {
      const response = await fetch('/api/auth/google/config');
      if (response.ok) {
        const data = await response.json();
        return { enabled: !!data.enabled };
      }
    } catch (e) {
      console.error('Failed to check Google OAuth configuration status:', e);
    }
    return { enabled: false };
  }

  public async checkSession(): Promise<UserAccount | null> {
    try {
      const response = await fetch('/api/me');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.currentUserCache = data.user;
          return data.user;
        }
      }
    } catch (e) {
      console.error('Failed to verify active user session cookie:', e);
    }
    this.currentUserCache = null;
    return null;
  }

  public getCurrentUser(): UserAccount | null {
    return this.currentUserCache;
  }

  public async logoutUser(): Promise<void> {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: this.getHeaders()
      });
    } catch (e) {
      console.error('Logout request failed:', e);
    }
    this.currentUserCache = null;
  }

  public async recordGameStats(_email: string, won: boolean): Promise<void> {
    try {
      const response = await fetch('/api/stats', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ won })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.stats && this.currentUserCache) {
          this.currentUserCache.stats = data.stats;
        }
      }
    } catch (e) {
      console.error('Failed to sync telemetry stats with backend:', e);
    }
  }
}
