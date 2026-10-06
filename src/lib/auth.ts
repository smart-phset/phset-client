// Login. Every visitor starts at /signin and either signs in with a team account or continues as a guest.
//   AUTH_USER / AUTH_PASSWORD  the team account. Leave AUTH_PASSWORD empty = no accounts yet (guest only).
//   AUTH_SECRET                signs the session cookie (falls back to AUTH_PASSWORD).
//   ALLOW_GUEST                "false" turns off "Continue without an account". Default: on.
export const COOKIE = "sp_session";
export const GUEST = "guest";
export const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export const accountsEnabled = () => Boolean(process.env.AUTH_PASSWORD);
export const allowGuest = () => process.env.ALLOW_GUEST !== "false";

function secret() {
  // With no accounts, only guest sessions are ever accepted (see verify), so this fallback cannot unlock anything
  // a guest could not already do.
  return process.env.AUTH_SECRET || process.env.AUTH_PASSWORD || "smartphset-guest-only";
}

export async function sign(user: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(user));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${user}.${hex}`;
}

/** The signed-in user ("guest" or a username), or null. Fails closed when accounts or guests are switched off. */
export async function verify(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const user = token.slice(0, token.lastIndexOf("."));
  if (!user || (await sign(user)) !== token) return null;
  if (user === GUEST) return allowGuest() ? user : null;
  // a named user only exists when team accounts are configured with a real secret
  return accountsEnabled() && user === (process.env.AUTH_USER || "team") ? user : null;
}

/** Secure cookies only over HTTPS, so sign-in also works on a phone over plain local Wi-Fi during tests. */
export function sessionCookie(value: string, secure: boolean) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax;${secure ? " Secure;" : ""} Max-Age=${MAX_AGE}`;
}

export function isHttps(req: Request) {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}

/** Where to go after signing in: only a plain same-site path. Checked again after URL normalisation. */
export function safeNext(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  const bad = (p: string) => !p.startsWith("/") || p.startsWith("//") || p.includes("\\") || /[\u0000-\u001f]/.test(p);
  if (bad(s)) return "/";
  try {
    const u = new URL(s, "http://local.invalid");
    const out = u.pathname + u.search;
    return u.origin === "http://local.invalid" && !bad(out) ? out : "/";
  } catch {
    return "/";
  }
}
