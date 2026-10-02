/**
 * Resolves static asset URLs taking Vite's BASE_URL into account.
 * Essential for GitHub Pages sub-path deployments (e.g., https://boatsensei0804.github.io/chumkhor-Donations/)
 */
export function getAssetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Safe extraction of Vite's BASE_URL in TypeScript
  const meta = import.meta as unknown as { env?: Record<string, string> };
  const base = meta.env?.BASE_URL || '/chumkhor-Donations/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${cleanPath}`;
}
