export const routerBrowserPolicy = 'chromium-firefox-webkit';
export const routerBrowserNames = ['chromium', 'firefox', 'webkit'];

export const routerBrowserProjects = routerBrowserNames.map(browserName => ({
  name: `router-${browserName}`,
  use: {
    browserName,
    ...(browserName === 'chromium' ? { launchOptions: {
      chromiumSandbox: true,
      ...(process.env.MARIONETTE_ROUTER_CHROMIUM ? { executablePath: process.env.MARIONETTE_ROUTER_CHROMIUM } : {}),
    } } : {}),
  },
}));
