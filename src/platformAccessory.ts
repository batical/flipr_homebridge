import { PlatformAccessory, CharacteristicValue, Service } from 'homebridge';
import fetch, { Response } from 'node-fetch';
import { FliprHomebridgePlatform, FliprModule } from './platform';

interface FliprSurvey {
  MeasureId: number;
  Source: string;
  DateTime: string;
  Temperature: number;
  PH: {
    Label: string;
    Message: string;
    Deviation: number;
    Value: number;
    DeviationSector: string;
  };
  OxydoReductionPotentiel: {
    Label: string;
    Value: number;
  };
  Conductivity: {
    Label: string;
    Level: string;
  };
  UvIndex: number;
  Battery: {
    Label: string;
    Deviation: number;
  };
  Desinfectant: {
    Label: string;
    Message: string;
    Deviation: number;
    Value: number;
    DeviationSector: string;
  };
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FliprPlatformAccessory {
  waterTemperatureSensorService: Service;

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

    this.waterTemperatureSensorService =
      this.fliprAccessory.getService(tempSensor) ||
      this.fliprAccessory.addService(tempSensor);

    this.fetchLastSurvey();

    setInterval(() => {
      this.fetchLastSurvey();
    }, 60000);
  }

  async fetchLastSurvey() {
    const res: Response = await fetch(
      `https://apis.goflipr.com/modules/${this.fliprAccessory.context.fliprModule.Serial}/survey/last`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.platform.access_token}`,
        },
      },
    );

    const survey: FliprSurvey = await res.json();

    this.waterTemperatureSensorService.updateCharacteristic(
      this.platform.Characteristic.CurrentTemperature,
      survey.Temperature,
    );

    this.platform.log.debug('Setting water temp to', survey.Temperature);
  }
}
