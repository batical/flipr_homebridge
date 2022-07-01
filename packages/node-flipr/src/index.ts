import fetch, { Response } from 'node-fetch';

export default class FliprClient {
  async authenticate(username, password): Promise<string> {
    const res: Response = await fetch('https://apis.goflipr.com/OAuth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: username,
        password: password,
      }),
    });

    const { access_token } = await res.json();
    return access_token;
  }
}
