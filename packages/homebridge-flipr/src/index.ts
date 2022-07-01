import { API, PlatformPluginConstructor } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { FliprHomebridgePlatform } from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API): void => {
  api.registerPlatform(
    PLATFORM_NAME,
    FliprHomebridgePlatform as unknown as PlatformPluginConstructor,
  );
};
