import { resolve } from 'path';

/**
 * Checks if the given path to find matches any of the given paths when they
 * are resolved inside the given base directory.
 *
 * @param baseDirectory Base directory to resolve given paths from.
 * @param pathsToMatch Paths to match the given path against.
 * @param pathToFind Path to match against the list of given paths.
 * @returns `true` if the given path to find matches at least one of the paths
 *          in the list. `false` if none of the given paths matched.
 */
export default function matchesPathInList(baseDirectory: string, pathsToMatch: string[], pathToFind: string): boolean {
  const absolutePathToFind = resolve(baseDirectory, pathToFind);
  return pathsToMatch.some(pathToMatch => absolutePathToFind === resolve(baseDirectory, pathToMatch));
}
