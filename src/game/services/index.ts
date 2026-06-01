import { isElectronMode } from '../../utils/env';
import { IAuthService } from './IAuthService';
import { IGameService } from './IGameService';
import { LocalAuthService } from './LocalAuthService';
import { OnlineAuthService } from './OnlineAuthService';
import { LocalGameService } from './LocalGameService';
import { OnlineGameService } from './OnlineGameService';
import { isOnlineMode } from './apiFetch';

const localAuth = new LocalAuthService();
const onlineAuth = new OnlineAuthService();
const localGame = new LocalGameService();
const onlineGame = new OnlineGameService();

export const authService: IAuthService = new Proxy({} as IAuthService, {
  get(_, prop) {
    const service = isOnlineMode() ? onlineAuth : localAuth;
    const value = Reflect.get(service, prop);
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  }
});

export const gameService: IGameService = new Proxy({} as IGameService, {
  get(_, prop) {
    const service = isOnlineMode() ? onlineGame : localGame;
    const value = Reflect.get(service, prop);
    if (typeof value === 'function') {
      return value.bind(service);
    }
    return value;
  }
});
