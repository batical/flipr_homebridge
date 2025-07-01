#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline = __importStar(require("readline"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const node_flipr_client_1 = __importDefault(require("node-flipr-client"));
// Load environment variables from .env file if it exists
function loadEnvFile() {
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
async function getCredentials() {
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
    const question = (query) => {
        return new Promise((resolve) => {
            rl.question(query, resolve);
        });
    };
    try {
        console.log('🔑 Please enter your Flipr credentials:');
        const username = await question('Username: ');
        const password = await question('Password: ');
        return { username, password };
    }
    finally {
        rl.close();
    }
}
async function testHubControl() {
    try {
        console.log('🧪 Testing Flipr Hub Control...\n');
        // Load environment variables first
        loadEnvFile();
        // Get credentials (from env or prompt)
        const credentials = await getCredentials();
        // Create client instance
        const client = new node_flipr_client_1.default();
        console.log('\n🔐 Authenticating...');
        // Authenticate
        await client.authenticate(credentials.username, credentials.password);
        console.log('✅ Authentication successful!');
        // Test fetching modules
        console.log('\n📡 Fetching modules...');
        const modules = await client.modules();
        console.log(`✅ Found ${modules.length} module(s):`);
        modules.forEach((module, index) => {
            console.log(`  ${index + 1}. Serial: ${module.Serial || 'N/A'}`);
            console.log(`     Type: ${module.CommercialType?.Value || 'N/A'}`);
            console.log(`     Status: ${module.Status?.Status || 'Unknown'}`);
            console.log(`     Last Measure: ${module.LastMeasureDateTime || 'N/A'}`);
            console.log('');
        });
        // Find hub modules (those without LastMeasureDateTime or with "hub" in type)
        const hubModules = modules.filter((module) => !module.LastMeasureDateTime ||
            module.CommercialType?.Value?.toLowerCase().includes('hub'));
        if (hubModules.length === 0) {
            console.log('⚠️  No hub modules found. All modules appear to be readers.');
            return;
        }
        console.log(`🔧 Found ${hubModules.length} hub module(s):`);
        hubModules.forEach((module, index) => {
            console.log(`  ${index + 1}. Serial: ${module.Serial}`);
            console.log(`     Type: ${module.CommercialType?.Value || 'N/A'}`);
        });
        // Test hub control with first hub module
        const firstHub = hubModules[0];
        console.log(`\n🎛️  Testing hub control for module ${firstHub.Serial}...`);
        // Get current hub state
        console.log('\n📊 Getting current hub state...');
        const hubState = await client.getHubState(firstHub.Serial);
        console.log('Current hub state:', hubState);
        // Test manual control
        console.log('\n🔘 Testing manual control...');
        console.log('Starting hub...');
        const startSuccess = await client.startHub(firstHub.Serial);
        console.log(`Start result: ${startSuccess ? '✅ Success' : '❌ Failed'}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        console.log('Stopping hub...');
        const stopSuccess = await client.stopHub(firstHub.Serial);
        console.log(`Stop result: ${stopSuccess ? '✅ Success' : '❌ Failed'}`);
        // Test mode control
        console.log('\n⚙️  Testing mode control...');
        console.log('Setting to AUTO mode...');
        const autoSuccess = await client.setHubAuto(firstHub.Serial);
        console.log(`Auto mode result: ${autoSuccess ? '✅ Success' : '❌ Failed'}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        console.log('Setting to MANUAL mode...');
        const manualSuccess = await client.setHubManual(firstHub.Serial);
        console.log(`Manual mode result: ${manualSuccess ? '✅ Success' : '❌ Failed'}`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds
        console.log('Setting to SCHEDULED mode...');
        const scheduledSuccess = await client.setHubScheduled(firstHub.Serial);
        console.log(`Scheduled mode result: ${scheduledSuccess ? '✅ Success' : '❌ Failed'}`);
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
// Run the test
testHubControl()
    .then(() => {
    console.log('\n🎉 Hub control test completed!');
    process.exit(0);
})
    .catch((error) => {
    console.error('\n💥 Hub control test failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test-hub.js.map