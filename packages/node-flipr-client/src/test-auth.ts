#!/usr/bin/env ts-node

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import FliprClient from './index';

// Load environment variables from .env file if it exists
function loadEnvFile(): void {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    }
  }
}

async function getCredentials(): Promise<{
  username: string;
  password: string;
}> {
  // First, try to get credentials from environment variables
  const envUsername = process.env.FLIPR_USERNAME;
  const envPassword = process.env.FLIPR_PASSWORD;

  if (envUsername && envPassword) {
    console.log('🔑 Using credentials from environment variables');
    return { username: envUsername, password: envPassword };
  }

  // If not found in environment, prompt interactively
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(query, resolve);
    });
  };

  try {
    console.log('🔑 Please enter your Flipr credentials:');
    const username = await question('Username: ');
    const password = await question('Password: ');
    return { username, password };
  } finally {
    rl.close();
  }
}

async function testFliprClient() {
  try {
    console.log('🧪 Testing Flipr Client Authentication...\n');

    // Load environment variables first
    loadEnvFile();

    // Get credentials (from env or prompt)
    const credentials = await getCredentials();

    // Create client instance
    const client = new FliprClient();

    console.log('\n🔐 Authenticating...');

    // Authenticate
    await client.authenticate(credentials.username, credentials.password);

    console.log('✅ Authentication successful!');
    console.log(`Access token: ${client.access_token.substring(0, 20)}...`);

    // Test fetching modules
    console.log('\n📡 Fetching modules...');
    const modules = await client.modules();

    console.log(`✅ Found ${modules.length} module(s):`);
    modules.forEach((module, index) => {
      console.log(`  ${index + 1}. Serial: ${module.Serial || 'N/A'}`);
      console.log(`     Status: ${module.Status?.Status || 'Unknown'}`);

      console.log(`     Last Measure: ${module.LastMeasureDateTime || 'N/A'}`);
      console.log('');
    });

    // Test fetching last survey for first activated module with last measure
    if (modules.length > 0) {
      const activeModuleWithMeasure = modules.find(
        (module) =>
          module.Status?.Status === 'Activated' && module.LastMeasureDateTime,
      );

      if (!activeModuleWithMeasure) {
        console.log('⚠️  No activated modules with recent measurements found.');
      } else {
        console.log(
          `📊 Fetching last survey for module ${activeModuleWithMeasure.Serial}...`,
        );

        try {
          const survey = await client.lastSurvey(
            activeModuleWithMeasure.Serial,
          );
          if (!survey) {
            console.log('⚠️  No survey data available for this module.');
          } else {
            console.log('✅ Last survey data:');
            console.log(`  Temperature: ${survey.Temperature || 'N/A'}°C`);
            console.log(
              `  pH: ${survey.PH?.Value || 'N/A'} (${
                survey.PH?.Label || 'N/A'
              })`,
            );
            console.log(
              `  ORP: ${survey.OxydoReductionPotentiel?.Value || 'N/A'} mV`,
            );
            console.log(
              `  Conductivity: ${survey.Conductivity?.Level || 'N/A'}`,
            );
            console.log(`  UV Index: ${survey.UvIndex || 'N/A'}`);
            console.log(`  Battery: ${survey.Battery?.Label || 'N/A'}`);
            console.log(
              `  Disinfectant: ${survey.Desinfectant?.Value || 'N/A'} (${
                survey.Desinfectant?.Label || 'N/A'
              })`,
            );
          }
        } catch (error) {
          console.log(`❌ Error fetching survey: ${error}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFliprClient()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
