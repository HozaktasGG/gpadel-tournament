/** True when `pathname` equals or is nested under one of `prefixes` (exact match for "/"). */
export function isActive(pathname: string, prefixes: string[]) {
  return prefixes.some(p => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')))
}

/** Routes where the mobile bottom nav is hidden (full-screen auth flows). */
export const HIDE_BOTTOM_NAV = ['/signin', '/signup', '/auth', '/register', '/verify', '/ticket', '/cancel']
