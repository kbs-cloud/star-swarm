import { isElectronMode } from '../../utils/env';
import { IAuthService } from './IAuthService';
import { IGameService } from './IGameService';
import { LocalAuthService } from './LocalAuthService';
import { OnlineAuthService } from './OnlineAuthService';
import { LocalGameService } from './LocalGameService';
import { OnlineGameService } from './OnlineGameService';

export const authService: IAuthService = isElectronMode() ? new LocalAuthService() : new OnlineAuthService();
export const gameService: IGameService = isElectronMode() ? new LocalGameService() : new OnlineGameService();
