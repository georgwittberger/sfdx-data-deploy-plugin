import { isAbsolute, resolve } from 'path';

/**
 * Get absolute path resolved from the current working directory.
 *
 * @param {string} inputPath Input path (may be relative or absolute).
 * @returns {string} Absolute path.
 */
export default function getAbsolutePath(inputPath: string): string {
  return inputPath && isAbsolute(inputPath) ? inputPath : resolve(process.cwd(), inputPath || '');
}
