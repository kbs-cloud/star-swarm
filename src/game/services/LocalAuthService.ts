import { IAuthService } from './IAuthService';
import { UserAccount } from '../auth';

export class LocalAuthService implements IAuthService {
  private currentUserCache: UserAccount | null = null;

  public async initCSRF(): Promise<void> {
    // No-op offline
  }

  public async registerUser(email: string, password?: string): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Account registered locally.' };
  }

  public async loginUser(email: string, password: string): Promise<{ success: boolean; message: string; user?: UserAccount }> {
    const user = this.getLocalUser();
    this.currentUserCache = user;
    return { success: true, message: 'Logged in locally.', user };
  }

  public async checkGoogleOAuthConfig(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  public async checkSession(): Promise<UserAccount | null> {
    const user = this.getLocalUser();
    this.currentUserCache = user;
    return user;
  }

  public getCurrentUser(): UserAccount | null {
    return this.getLocalUser();
  }

  public async logoutUser(): Promise<void> {
    this.currentUserCache = null;
  }

  public async recordGameStats(email: string, won: boolean): Promise<void> {
    const displayName = localStorage.getItem('starswarm_display_name') || 'Commander';
    const key = `starswarm_offline_stats_${displayName}`;
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    try {
      const stored = localStorage.getItem(key);
      if (stored) stats = JSON.parse(stored);
    } catch (e) {
      // ignore
    }

    stats.gamesPlayed += 1;
    if (won) stats.gamesWon += 1;

    localStorage.setItem(key, JSON.stringify(stats));
    this.currentUserCache = this.getLocalUser();
  }

  private getLocalUser(): UserAccount {
    const displayName = localStorage.getItem('starswarm_display_name') || 'Commander';
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    try {
      const storedStats = localStorage.getItem(`starswarm_offline_stats_${displayName}`);
      if (storedStats) {
        stats = JSON.parse(storedStats);
      }
    } catch (e) {
      console.error('Failed to parse offline stats:', e);
    }

    return {
      email: 'commander@local',
      displayName,
      isGoogleLinked: false,
      hasPassword: true,
      stats
    };
  }
}
