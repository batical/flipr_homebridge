import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import fetch, { Response } from 'node-fetch';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { URLSearchParams } from 'url';
import { FliprPlatformAccessory } from './platformAccessory';

interface FliprPlatformConfig extends PlatformConfig {
  username: string;
  password: string;
}

export interface FliprModule {
  ActivationKey: string;
  IsSuspended: string;
  Status: {
    Comment: string;
    DateTime: string;
    Status: string;
  };
  BatteryPlugDate: string;
  Comments: string;
  NoAlertUnil: string;
  Serial: string;
  PAC: string;
  ResetsCounter: string;
  SigfoxStatus: string;
  OffsetOrp: string;
  OffsetTemperature: string;
  OffsetPh: string;
  OffsetConductivite: string;
  IsForSpa: string;
  Version: string;
  LastMeasureDateTime: string;
  CommercialType: {
    Id: string;
    Value: string;
  };
  SubscribtionValidUntil: string;
  ModuleType_Id: string;
  Eco_Mode: string;
  EnableFliprFirmwareUpgrade: string;
  FliprFirmwareUpgradeAttempt: string;
  FliprFirmwareUpgradeStart: string;
  FliprFirmwareUpgradeEnd: string;
  BEflipr: string;
  IsSubscriptionValid: string;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class FliprHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public access_token?: string;

  constructor(
    public readonly log: Logger,
    public readonly config: FliprPlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  restoreAccessory(existingAccessory) {
    // the accessory already exists
    this.log.info(
      'Restoring existing accessory from cache:',
      existingAccessory.displayName,
    );

    // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
    // existingAccessory.context.device = device;
    // this.api.updatePlatformAccessories([existingAccessory]);

    // create the accessory handler for the restored accessory
    // this is imported from `platformAccessory.ts`
    new FliprPlatformAccessory(this, existingAccessory);

    // it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
    // remove platform accessories when no longer present
    // this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
    // this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
  }

  addAccessory(fliprModule: FliprModule, uuid) {
    // the accessory does not yet exist, so we need to create it
    this.log.info('Adding new accessory:', fliprModule.Serial);

    // create a new accessory
    const fliprAccessory = new this.api.platformAccessory<{
      fliprModule: FliprModule;
    }>(fliprModule.Serial, uuid);

    // store a copy of the device object in the `accessory.context`
    // the `context` property can be used to store any data about the accessory you may need
    fliprAccessory.context.fliprModule = fliprModule;

    // create the accessory handler for the newly create accessory
    // this is imported from `platformAccessory.ts`
    new FliprPlatformAccessory(this, fliprAccessory);

    // link the accessory to your platform
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      fliprAccessory,
    ]);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    const res: Response = await fetch('https://apis.goflipr.com/OAuth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: this.config.username,
        password: this.config.password,
      }),
    });

    const { access_token } = await res.json();
    this.access_token = access_token;

    const fliprModulesResponse = await fetch(
      'https://apis.goflipr.com/modules',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      },
    );

    if (!fliprModulesResponse.ok) {
      this.log.debug('Could not fetch Flipr Modules', fliprModulesResponse);
      return;
    }

    const fliprModules: FliprModule[] = await fliprModulesResponse.json();

    for (const fliprModule of fliprModules) {
      const uuid = this.api.hap.uuid.generate(fliprModule.Serial);
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === uuid,
      );
      if (existingAccessory) {
        this.restoreAccessory(existingAccessory);
      } else {
        this.addAccessory(fliprModule, uuid);
      }
    }
  }
}
