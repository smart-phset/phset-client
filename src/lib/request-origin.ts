/** Nginx preserves the public Host and overwrites X-Forwarded-Proto. Next's
 * Request URL can use the internal container hostname/port. Browser Origin must
 * match the public host, never an arbitrary X-Forwarded-Host supplied by a client.
 * Bind Next to loopback/private ingress so only the trusted proxy sets protocol.
 */
export function sameOrigin(req: Request): boolean {
  if (req.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (origin === null) return true; // Non-browser clients; command route additionally requires Origin.
  const expected = new URL(req.url);
  const host = req.headers.get("host");
  if (host) {
    try {
      const publicUrl = new URL(`${expected.protocol}//${host}`);
      if (publicUrl.host !== host.toLowerCase() || publicUrl.username || publicUrl.password || publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash) return false;
      expected.hostname = publicUrl.hostname;
      expected.port = publicUrl.port;
    } catch { return false; }
  }
  const protocol = req.headers.get("x-forwarded-proto");
  if (protocol === "https" || protocol === "http") expected.protocol = `${protocol}:`;
  return origin === expected.origin;
}
