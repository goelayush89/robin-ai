#!/usr/bin/env node

/**
 * Development server with HTTPS support for testing Screen Capture API
 * 
 * The Screen Capture API requires a secure context (HTTPS) to work.
 * This script creates a simple HTTPS development server for testing.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');

// Create a simple self-signed certificate for development
const createSelfSignedCert = () => {
  const forge = require('node-forge');
  
  // Generate a key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Create a certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }, {
    name: 'countryName',
    value: 'US'
  }, {
    shortName: 'ST',
    value: 'Test'
  }, {
    name: 'localityName',
    value: 'Test'
  }, {
    name: 'organizationName',
    value: 'Robin Assistant Dev'
  }, {
    shortName: 'OU',
    value: 'Development'
  }];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  
  return {
    key: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(cert)
  };
};

const startServer = () => {
  const app = express();
  const port = process.env.PORT || 3001;
  
  // Serve static files from dist directory
  const distPath = path.join(__dirname, '../dist');
  
  if (!fs.existsSync(distPath)) {
    console.error('❌ Build directory not found. Please run "npm run build" first.');
    process.exit(1);
  }
  
  app.use(express.static(distPath));
  
  // Handle SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
  
  try {
    // Try to use existing certificates or create new ones
    let credentials;
    const keyPath = path.join(__dirname, 'dev-key.pem');
    const certPath = path.join(__dirname, 'dev-cert.pem');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      credentials = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      };
      console.log('📜 Using existing development certificates');
    } else {
      console.log('🔐 Creating self-signed certificate for development...');
      credentials = createSelfSignedCert();
      
      // Save certificates for reuse
      fs.writeFileSync(keyPath, credentials.key);
      fs.writeFileSync(certPath, credentials.cert);
      console.log('💾 Certificates saved for future use');
    }
    
    const server = https.createServer(credentials, app);
    
    server.listen(port, () => {
      console.log('🚀 Robin Assistant HTTPS Development Server');
      console.log('');
      console.log(`   Local:    https://localhost:${port}`);
      console.log(`   Network:  https://192.168.x.x:${port}`);
      console.log('');
      console.log('🔒 HTTPS enabled - Screen Capture API will work!');
      console.log('⚠️  You may see a security warning - click "Advanced" and "Proceed to localhost"');
      console.log('');
      console.log('📱 Test screen capture functionality:');
      console.log('   1. Configure an AI model in Settings');
      console.log('   2. Go to Chat page');
      console.log('   3. Grant screen capture permission');
      console.log('   4. Try: "Take a screenshot and describe what you see"');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to start HTTPS server:', error.message);
    console.log('');
    console.log('💡 Alternative options:');
    console.log('   1. Use the desktop app for full functionality');
    console.log('   2. Deploy to a hosting service with HTTPS');
    console.log('   3. Use a reverse proxy like ngrok');
    process.exit(1);
  }
};

// Check if we have the required dependencies
try {
  require('node-forge');
} catch (error) {
  console.error('❌ Missing dependency: node-forge');
  console.log('');
  console.log('Please install it with:');
  console.log('   npm install --save-dev node-forge');
  console.log('');
  process.exit(1);
}

startServer();
