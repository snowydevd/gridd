/** Esquema de la app (`scheme` en app.json). */
const APP_SCHEME = "gridd://";

/**
 * A dónde puede volver el login con OAuth: la web (`SITE_URL`), la app (`gridd://`)
 * y, sólo si `allowExpoGo`, Expo Go (`exp://<ip>:8081/--/`, cambia según la red).
 */
export function resolveRedirect(
  redirectTo: string,
  { siteUrl, allowExpoGo = false }: { siteUrl: string; allowExpoGo?: boolean },
): string {
  const site = siteUrl.replace(/\/$/, "");
  if (redirectTo.startsWith("/") || redirectTo.startsWith("?")) {
    return `${site}${redirectTo}`;
  }
  if (redirectTo.startsWith(site) && [undefined, "/", "?"].includes(redirectTo[site.length])) {
    return redirectTo;
  }
  if (redirectTo.startsWith(APP_SCHEME)) return redirectTo;
  if (allowExpoGo && redirectTo.startsWith("exp://")) return redirectTo;
  throw new Error(`redirectTo no permitido: ${redirectTo}`);
}
