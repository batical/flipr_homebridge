import debug from 'debug';
import fetch, { BodyInit, HeaderInit, Response } from 'node-fetch';
import { URLSearchParams } from 'url';

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

export default class FliprClient {
  declare access_token: string;

  debug = debug('node-flipr-client');
  origin = 'https://apis.goflipr.com';

  async authenticate(username, password): Promise<void> {
    const res = await this.post(
      '/OAuth2/token',
      new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password,
      }),
    );

    const json = await res.json();

    if (!res.ok) {
      throw `${res.status} ${res.statusText}: ${json.error} ${json.error_description}`;
    }

    this.access_token = json.access_token;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT',
    path,
    body?: BodyInit,
  ): Promise<Response> {
    let headers: HeaderInit = {};

    if (method === 'GET') {
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.access_token}`,
      };
    }

    if (method === 'POST') {
      headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    if (method === 'PUT') {
      headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    }

    return await fetch(`${this.origin}/${path}`, {
      method,
      headers,
      body,
    });
  }

  async get(path: `/${string}`): Promise<Response> {
    return await this.request('GET', path);
  }

  async post(path, body: BodyInit): Promise<Response> {
    return await this.request('POST', path, body);
  }

  async put(path, body: BodyInit): Promise<Response> {
    return await this.request('PUT', path, body);
  }

  async modules(): Promise<FliprModule[]> {
    const fliprModulesResponse = await this.get('/modules');

    if (!fliprModulesResponse.ok) {
      this.debug('Could not fetch Flipr Modules', fliprModulesResponse);
      return [];
    }

    return await fliprModulesResponse.json();
  }

  async lastSurvey(serial: FliprModule['Serial']): Promise<FliprSurvey | null> {
    const res = await this.get(`/modules/${serial}/survey/last`);

    if (!res.ok) {
      this.debug(`Could not fetch survey for module ${serial}`, res);
      return null;
    }

    const data = await res.json();
    return data;
  }

  // Hub control methods based on Flipr API documentation
  async getHubState(serial: FliprModule['Serial']): Promise<any> {
    const res = await this.get(`/hub/${serial}/state`);

    if (!res.ok) {
      this.debug(`Could not fetch hub state for module ${serial}`, res);
      return null;
    }

    return await res.json();
  }

  async setHubManualState(
    serial: FliprModule['Serial'],
    state: boolean,
  ): Promise<boolean> {
    try {
      const stateValue = state ? 'true' : 'false';
      const res = await this.post(`/hub/${serial}/Manual/${stateValue}`, '');

      if (!res.ok) {
        this.debug(`Could not set hub manual state for module ${serial}`, res);
        return false;
      }

      return true;
    } catch (error) {
      this.debug(`Error setting hub manual state for module ${serial}:`, error);
      return false;
    }
  }

  async setHubMode(
    serial: FliprModule['Serial'],
    behavior: 'auto' | 'planning' | 'manual',
  ): Promise<boolean> {
    try {
      const res = await this.put(`/hub/${serial}/mode/${behavior}`, '');

      if (!res.ok) {
        this.debug(`Could not set hub mode for module ${serial}`, res);
        return false;
      }

      return true;
    } catch (error) {
      this.debug(`Error setting hub mode for module ${serial}:`, error);
      return false;
    }
  }

  // Convenience methods
  async startHub(serial: FliprModule['Serial']): Promise<boolean> {
    return this.setHubManualState(serial, true);
  }

  async stopHub(serial: FliprModule['Serial']): Promise<boolean> {
    return this.setHubManualState(serial, false);
  }

  async setHubAuto(serial: FliprModule['Serial']): Promise<boolean> {
    return this.setHubMode(serial, 'auto');
  }

  async setHubScheduled(serial: FliprModule['Serial']): Promise<boolean> {
    return this.setHubMode(serial, 'planning');
  }

  async setHubManual(serial: FliprModule['Serial']): Promise<boolean> {
    return this.setHubMode(serial, 'manual');
  }
}
