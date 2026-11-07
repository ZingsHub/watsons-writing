// Playwright tests for Watson's Writing. Run one file at a time, for example:
//   npx playwright test -c tests/playwright.config.js tests/first-run.spec.js
// (Playwright is not part of the app; install a recent version wherever you run the tests: an old one can lose touch with a newer Edge.)
const path = require('path');

module.exports = {
  testDir: __dirname,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: {
    channel: 'msedge',         // the Edge already on Windows, so no browser download is needed
    baseURL: 'http://localhost:3077',
    serviceWorkers: 'block',   // always test the copy on disk, never a cached one
    viewport: { width: 1100, height: 800 },
  },
  webServer: {
    command: 'node server.js',
    cwd: path.join(__dirname, '..'),
    env: { PORT: '3077' },
    url: 'http://localhost:3077',
    reuseExistingServer: false,
  },
};
