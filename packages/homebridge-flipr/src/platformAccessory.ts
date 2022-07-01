import { PlatformAccessory, Service } from 'homebridge';
import { FliprModule } from 'node-flipr-client';
import { FliprHomebridgePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FliprPlatformAccessory {
  waterTemperatureSensorService: Service;
  lightSensorService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
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

  async fetchLastSurvey(): Promise<void> {
    if (!this.platform.fliprClient) {
      return;
    }

    const survey = await this.platform.fliprClient.lastSurvey(
      this.fliprAccessory.context.fliprModule.Serial,
    );

    this.waterTemperatureSensorService.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      survey.Temperature,
    );

    this.lightSensorService.updateCharacteristic(
      this.platform.Characteristic.CurrentAmbientLightLevel,
      survey.PH.Value,
    );

    this.platform.log.info('Setting water temp to', survey.Temperature);
    this.platform.log.info('Setting PH to', survey.PH.Value);
  }
}
