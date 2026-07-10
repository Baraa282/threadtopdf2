import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const cacheDir = process.env.PUPPETEER_CACHE_DIR?.trim() || join(repoRoot, '.cache', 'puppeteer');

process.env.PUPPETEER_CACHE_DIR = cacheDir;
mkdirSync(cacheDir, { recursive: true });

console.log('PUPPETEER_CACHE_DIR =', cacheDir);

const puppeteer = (await import('puppeteer')).default;

function chromePath() {
  return puppeteer.executablePath();
}

try {
  const path = chromePath();
  if (path && existsSync(path)) {
    console.log('Chrome already installed:', path);
    process.exit(0);
  }
} catch {
  // install below
}

console.log('Installing Puppeteer Chrome (this can take a few minutes)...');

execSync('puppeteer browsers install chrome', {
  stdio: 'inherit',
  env: process.env,
});

const installedPath = chromePath();
if (!installedPath || !existsSync(installedPath)) {
  console.error('Chrome install finished but binary was not found.');
  console.error('Expected path:', installedPath ?? '(unknown)');
  process.exit(1);
}

console.log('Chrome installed successfully:', installedPath);
