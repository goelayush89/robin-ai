#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up Robin Assistant...\n');

try {
  // Install root dependencies
  console.log('📦 Installing root dependencies...');
  execSync('npm install', { stdio: 'inherit', cwd: process.cwd() });

  // Install workspace dependencies
  console.log('\n📦 Installing workspace dependencies...');
  execSync('npm install --workspaces', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n✅ Setup complete!');
  console.log('\n🎯 Next steps:');
  console.log('  npm run dev     # Start all development servers');
  console.log('  npm run build   # Build all packages');
  console.log('\n📖 See README.md for more information.');

} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}
