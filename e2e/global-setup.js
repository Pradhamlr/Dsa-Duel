import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../Backend');

export default async function globalSetup() {
  execFileSync('node', ['tests/e2eSeed.js'], { cwd: backendDir, stdio: 'inherit', env: process.env });
}
