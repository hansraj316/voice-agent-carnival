#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Validating Voice Echo Agent setup...\n');

// Check if .env file exists
try {
    const envPath = path.join(__dirname, '.env');
    const envContent = readFileSync(envPath, 'utf8');
    
    if (envContent.includes('OPENAI_API_KEY=your_openai_api_key_here')) {
        console.log('❌ Please configure your OpenAI API key in .env file');
        process.exit(1);
    } else if (envContent.includes('OPENAI_API_KEY=')) {
        console.log('✅ Environment file configured');
    } else {
        console.log('⚠️  OPENAI_API_KEY not found in .env file');
    }
} catch (error) {
    console.log('❌ .env file not found. Run: cp .env.example .env');
    process.exit(1);
}

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
    console.log(`❌ Node.js ${nodeVersion} detected. Please use Node.js 18 or higher.`);
    process.exit(1);
} else {
    console.log(`✅ Node.js ${nodeVersion} is supported`);
}

// Check if dependencies are installed
try {
    const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    // Simple check if node_modules exists
    try {
        readFileSync(path.join(nodeModulesPath, '.package-lock.json'));
        console.log('✅ Dependencies installed');
    } catch {
        console.log('❌ Dependencies not installed. Run: npm install');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ package.json not found');
    process.exit(1);
}

console.log('\n🎉 Setup validation complete! Ready to run:');
console.log('   npm start');
console.log('\n🌐 Then open: http://localhost:3000');