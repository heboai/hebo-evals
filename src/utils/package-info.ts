import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PackageJson {
  version: string;
  name: string;
  description: string;
}

function findPackageJson(startDir: string): string {
  let currentDir = startDir;
  const root = dirname(currentDir);

  while (currentDir !== root) {
    try {
      const packagePath = join(currentDir, 'package.json');
      readFileSync(packagePath, 'utf8');
      return packagePath;
    } catch {
      currentDir = dirname(currentDir);
    }
  }

  // Fallback to local package.json
  return join(__dirname, '../../package.json');
}

const packagePath = findPackageJson(__dirname);
const packageJson = JSON.parse(
  readFileSync(packagePath, 'utf8'),
) as PackageJson;

export const { version, name, description } = packageJson;
