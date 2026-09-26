const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  use: { browserName: 'chromium', launchOptions: { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } },
  testDir: './tests',
  testMatch: '**/*.spec.js',
  reporter: 'line',
  webServer: {
    command: 'python -m http.server 8090 --directory .',
    url: 'http://127.0.0.1:8090/epasar.html',
    reuseExistingServer: true,
    timeout: 10000
  }
});
