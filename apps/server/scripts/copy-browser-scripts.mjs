import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
cpSync(join(root, 'src/browser'), join(root, 'dist/browser'), { recursive: true });
console.log('Copied src/browser -> dist/browser');
