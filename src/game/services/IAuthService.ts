import { UserAccount } from '../auth';

export interface IAuthService {
  initCSRF(): Promise<void>;
  registerUser(email: string, password?: string): Promise<{ success: boolean; message: string }>;
  loginUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }>;
  checkGoogleOAuthConfig(): Promise<{ enabled: boolean }>;
  checkSession(): Promise<UserAccount | null>;
  getCurrentUser(): UserAccount | null;
  logoutUser(): Promise<void>;
  recordGameStats(email: string, won: boolean): Promise<void>;
  pollAuth(token: string): Promise<{ status: 'pending' | 'success' | 'error'; sessionId?: string; error?: string }>;
}
