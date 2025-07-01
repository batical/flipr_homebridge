import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
} from 'homebridge';
import FliprClient, { FliprModule } from 'node-flipr-client';
import { FliprPlatformAccessory } from './platformAccessory';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

interface FliprPlatformConfig extends PlatformConfig {
  username: string;
  password: string;
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

  public fliprClient?: FliprClient;

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

      this.fliprClient = new FliprClient();
      this.fliprClient
        .authenticate(this.config.username, this.config.password)
        .then(() => {
          log.info('Successfully authenticated on Flipr API');
          log.debug('token', this.fliprClient?.access_token);
          this.discoverDevices();
        });
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  restoreAccessory(existingAccessory): void {
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

  addAccessory(fliprModule: FliprModule, uuid): void {
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
  async discoverDevices(): Promise<void> {
    if (!this.fliprClient) {
      return;
    }

    const fliprModules = await this.fliprClient.modules();

    for (const fliprModule of fliprModules) {
      // Only process AnalysR (temperature/chlorine) modules
      const isAnalysR = fliprModule.CommercialType.Value === 'AnalysR';

      if (!isAnalysR) {
        this.log.info(
          `Skipping module ${fliprModule.Serial} of type ${fliprModule.CommercialType.Value}`,
        );
        continue;
      }

      this.log.info(
        `discovered ${fliprModule.CommercialType.Value} module`,
        fliprModule.Serial,
      );

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
