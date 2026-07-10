import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';

try {
  const path = puppeteer.executablePath();
  if (path && existsSync(path)) {
    console.log('Puppeteer Chrome already installed:', path);
    process.exit(0);
  }
} catch {
  // not installed yet
}

console.log('Installing Puppeteer Chrome (one-time setup)...');
execSync('puppeteer browsers install chrome', { stdio: 'inherit' });
