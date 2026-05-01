#!/usr/bin/env node
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chromium } from 'playwright';

const userDataDir = path.resolve(process.env.FACEBOOK_MARKETPLACE_USER_DATA_DIR || 'data/facebook-marketplace-browser');

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  locale: 'fr-CH',
  timezoneId: 'Europe/Zurich'
});

try {
  const page = await context.newPage();
  await page.goto('https://www.facebook.com/marketplace', { waitUntil: 'domcontentloaded' });
  console.log(`Facebook Marketplace browser profile: ${userDataDir}`);
  console.log('Log in to Facebook in the opened browser window.');

  const rl = createInterface({ input, output });
  await rl.question('Press Enter here when the Marketplace page is usable...');
  rl.close();
} finally {
  await context.close();
}
