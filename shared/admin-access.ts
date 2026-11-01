export const ADMIN_ACCESS_MESSAGE =
  'Votre accès administrateur doit être vérifié avec Cloudflare. Vos modifications n’ont pas été renvoyées automatiquement.';
export const ADMIN_ACCESS_URL = '/api/admin/access';
export const isAdminApi = (path: string) => /^\/admin(?:\/|\?|$)/.test(path);
export const requiresDocumentNavigation = (path: string) => /^\/admin(?:\/|[?#]|$)/.test(path);
export const STAFF_REAUTH_MESSAGE =
  'Reconnectez-vous avec votre mot de passe et un nouveau code pour accéder à l’espace équipe.';
export const staffHome = (role: string) => (role === 'admin' ? '/admin' : '/organisation');
export const staffApiPath = (path: string, pathname: string) =>
  pathname === '/organisation' ? path.replace(/^\/admin(?=\/|\?|$)/, '/organisation') : path;
