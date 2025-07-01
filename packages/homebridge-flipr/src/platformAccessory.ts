import { PlatformAccessory, Service } from 'homebridge';
import { FliprModule } from 'node-flipr-client';
import { FliprHomebridgePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FliprPlatformAccessory {
  waterTemperatureSensorService?: Service;
  lightSensorService?: Service;
  hubSwitchService?: Service;
  hubModeService?: Service;

  private hubState = {
    isOn: false,
    mode: 'manual' as 'manual' | 'auto' | 'planning',
  };

  constructor(
    private readonly platform: FliprHomebridgePlatform,
    private readonly fliprAccessory: PlatformAccessory<{
      fliprModule: FliprModule;
    }>,
  ) {
    // set accessory information
    this.fliprAccessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Flipr')
      .setCharacteristic(
        this.platform.Characteristic.Model,
        this.fliprAccessory.context.fliprModule.CommercialType.Value,
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.fliprAccessory.context.fliprModule.Serial,
      );

    // Only process AnalysR type modules for temperature and chlorine
    const isAnalysR = this.isAnalysRModule();

    if (isAnalysR) {
      this.setupReaderAccessory();
    } else {
      // Skip all other module types (including Start)
      this.platform.log.info(
        `Skipping module ${this.fliprAccessory.context.fliprModule.Serial} of type ${this.fliprAccessory.context.fliprModule.CommercialType.Value}`,
      );
    }
  }

  private isHubModule(): boolean {
    // Hub modules are typically "Start" type modules
    const module = this.fliprAccessory.context.fliprModule;
    return module.CommercialType.Value === 'Start';
  }

  private isAnalysRModule(): boolean {
    // Only AnalysR modules have temperature and chlorine data
    const module = this.fliprAccessory.context.fliprModule;
    return module.CommercialType.Value === 'AnalysR';
  }

  private setupHubAccessory(): void {
    this.platform.log.info(
      `Setting up Hub accessory for module ${this.fliprAccessory.context.fliprModule.Serial}`,
    );

    // Create Switch service for On/Off control
    this.hubSwitchService =
      this.fliprAccessory.getService(this.platform.Service.Switch) ||
      this.fliprAccessory.addService(
        this.platform.Service.Switch,
        'Hub Control',
        'hub-switch',
      );

    // Create Mode service for Auto/Manual/Scheduled modes
    this.hubModeService =
      this.fliprAccessory.getService(this.platform.Service.Switch) ||
      this.fliprAccessory.addService(
        this.platform.Service.Switch,
        'Hub Mode',
        'hub-mode',
      );

    // Set up switch event handlers
    this.hubSwitchService
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleHubSwitch.bind(this))
      .onGet(this.getHubSwitchState.bind(this));

    // Set up mode event handlers
    this.hubModeService
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.handleHubMode.bind(this))
      .onGet(this.getHubModeState.bind(this));

    // Initial state fetch
    this.fetchHubState();

    // Update state every minute
    setInterval(() => {
      this.fetchHubState();
    }, 60000);
  }

  private setupReaderAccessory(): void {
    this.platform.log.info(
      `Setting up Reader accessory for module ${this.fliprAccessory.context.fliprModule.Serial}`,
    );

    const tempSensor = this.platform.Service.TemperatureSensor;
    const lightSensor = this.platform.Service.LightSensor;

    this.waterTemperatureSensorService =
      this.fliprAccessory.getService(tempSensor) ||
      this.fliprAccessory.addService(tempSensor);

    this.lightSensorService =
      this.fliprAccessory.getService(lightSensor) ||
      this.fliprAccessory.addService(lightSensor);

    this.fetchLastSurvey();

    setInterval(() => {
      this.fetchLastSurvey();
    }, 60000);
  }

  // Hub control methods
  async fetchHubState(): Promise<void> {
    if (!this.platform.fliprClient) {
      return;
    }

    try {
      const state = await this.platform.fliprClient.getHubState(
        this.fliprAccessory.context.fliprModule.Serial,
      );

      if (state) {
        // Map the actual API response to our state
        this.hubState.isOn = state.stateEquipment === 1;
        this.hubState.mode = state.behavior || 'manual';

        // Update characteristics
        if (this.hubSwitchService) {
          this.hubSwitchService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.hubState.isOn,
          );
        }

        if (this.hubModeService) {
          this.hubModeService.updateCharacteristic(
            this.platform.Characteristic.On,
            this.hubState.mode === 'auto',
          );
        }

        this.platform.log.info(
          `Hub state: ${this.hubState.isOn ? 'ON' : 'OFF'}, Mode: ${
            this.hubState.mode
          }`,
        );
      }
    } catch (error) {
      this.platform.log.error(
        `Error fetching hub state for module ${this.fliprAccessory.context.fliprModule.Serial}:`,
        error,
      );
    }
  }

  async handleHubSwitch(value: any): Promise<void> {
    if (!this.platform.fliprClient) {
      return;
    }

    const boolValue = Boolean(value);
    try {
      const success = await this.platform.fliprClient.setHubManualState(
        this.fliprAccessory.context.fliprModule.Serial,
        boolValue,
      );

      if (success) {
        this.hubState.isOn = boolValue;
        this.platform.log.info(
          `Hub ${boolValue ? 'started' : 'stopped'} successfully`,
        );
      } else {
        this.platform.log.error('Failed to control hub');
      }
    } catch (error) {
      this.platform.log.error('Error controlling hub:', error);
    }
  }

  async getHubSwitchState(): Promise<boolean> {
    return this.hubState.isOn;
  }

  async handleHubMode(value: any): Promise<void> {
    if (!this.platform.fliprClient) {
      return;
    }

    const boolValue = Boolean(value);
    try {
      const mode = boolValue ? 'auto' : 'manual';
      const success = await this.platform.fliprClient.setHubMode(
        this.fliprAccessory.context.fliprModule.Serial,
        mode,
      );

      if (success) {
        this.hubState.mode = mode;
        this.platform.log.info(`Hub mode set to ${mode}`);
      } else {
        this.platform.log.error('Failed to set hub mode');
      }
    } catch (error) {
      this.platform.log.error('Error setting hub mode:', error);
    }
  }

  async getHubModeState(): Promise<boolean> {
    return this.hubState.mode === 'auto';
  }

  // Reader methods
  async fetchLastSurvey(): Promise<void> {
    if (!this.platform.fliprClient) {
      return;
    }

    try {
      const survey = await this.platform.fliprClient.lastSurvey(
        this.fliprAccessory.context.fliprModule.Serial,
      );

      // Check if survey exists and has data
      if (!survey) {
        this.platform.log.warn(
          `No survey data available for module ${this.fliprAccessory.context.fliprModule.Serial}`,
        );
        return;
      }

      // Check if this is a reader module (has temperature data)
      if (
        survey.Temperature !== null &&
        survey.Temperature !== undefined &&
        this.waterTemperatureSensorService
      ) {
        this.waterTemperatureSensorService.updateCharacteristic(
          this.platform.Characteristic.CurrentTemperature,
          survey.Temperature,
        );
        this.platform.log.info('Setting water temp to', survey.Temperature);
      }

      // Check if this is a reader module (has PH data)
      if (
        survey.PH &&
        survey.PH.Value !== null &&
        survey.PH.Value !== undefined &&
        this.lightSensorService
      ) {
        this.lightSensorService.updateCharacteristic(
          this.platform.Characteristic.CurrentAmbientLightLevel,
          survey.PH.Value,
        );
        this.platform.log.info('Setting PH to', survey.PH.Value);
      }
    } catch (error) {
      this.platform.log.error(
        `Error fetching survey for module ${this.fliprAccessory.context.fliprModule.Serial}:`,
        error,
      );
    }
  }
}
