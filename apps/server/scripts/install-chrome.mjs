import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

const isProductionDeploy = process.env.RENDER === 'true' || process.env.CI === 'true';

try {
  const path = puppeteer.executablePath();
  if (path && existsSync(path)) {
    console.log('Puppeteer Chrome already installed:', path);
    process.exit(0);
  }
} catch {
  // not installed yet
}

console.log('Installing Puppeteer Chrome...');
if (process.env.PUPPETEER_CACHE_DIR) {
  console.log('Cache dir:', process.env.PUPPETEER_CACHE_DIR);
}

try {
  execSync('puppeteer browsers install chrome', { stdio: 'inherit' });
  console.log('Puppeteer Chrome installed:', puppeteer.executablePath());
} catch (error) {
  if (isProductionDeploy) {
    throw error;
  }

  console.warn('Puppeteer Chrome install skipped (local dev). Run: pnpm --filter @thread-to-pdf/server install:chrome');
}
