// Simple test script to verify screenshot functionality
const { app, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');

async function testScreenshot() {
  console.log('Testing Electron screenshot capabilities...');
  
  try {
    // Test desktopCapturer
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    if (sources.length > 0) {
      const screenshot = sources[0];
      console.log('✅ Screenshot captured successfully!');
      console.log('Screenshot info:', {
        id: screenshot.id,
        name: screenshot.name,
        thumbnailSize: {
          width: screenshot.thumbnail.getSize().width,
          height: screenshot.thumbnail.getSize().height
        }
      });
      
      // Convert to base64
      const base64Data = screenshot.thumbnail.toPNG().toString('base64');
      console.log('✅ Base64 conversion successful, length:', base64Data.length);
      
      return {
        success: true,
        data: base64Data,
        width: screenshot.thumbnail.getSize().width,
        height: screenshot.thumbnail.getSize().height,
        timestamp: Date.now()
      };
    } else {
      console.log('❌ No screenshot sources found');
      return { success: false, error: 'No screenshot sources available' };
    }
  } catch (error) {
    console.log('❌ Screenshot test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function createTestWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'dist/preload.js')
    }
  });

  // Load a simple HTML page
  win.loadFile(path.join(__dirname, '../web/dist/index.html'));
  
  // Test screenshot after window loads
  win.webContents.once('did-finish-load', async () => {
    console.log('Window loaded, testing screenshot...');
    const result = await testScreenshot();
    console.log('Screenshot test result:', result.success ? '✅ SUCCESS' : '❌ FAILED');
    if (!result.success) {
      console.log('Error:', result.error);
    }
  });

  return win;
}

app.whenReady().then(() => {
  console.log('Electron app ready, creating test window...');
  createTestWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
