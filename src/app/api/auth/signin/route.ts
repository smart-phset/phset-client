import { GUEST, accountsEnabled, allowGuest, isHttps, safeNext, sessionCookie, sign } from "@/lib/auth";

// Relative Location headers keep the browser on whatever host it used (localhost, LAN address or the live domain).
const go = (path: string, cookie?: string) =>
  new Response(null, { status: 303, headers: cookie ? { Location: path, "Set-Cookie": cookie } : { Location: path } });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return go("/signin?error=wrong");
  }
  const next = safeNext(form.get("next"));
  const fail = (code: string) => go(`/signin?error=${code}&next=${encodeURIComponent(next)}`);
  const ok = async (user: string) => go(next, sessionCookie(await sign(user), isHttps(req)));

  if (form.get("mode") === "guest") {
    return allowGuest() ? ok(GUEST) : fail("noguest");
  }
  if (!accountsEnabled()) return fail("noaccounts");
  const user = String(form.get("username") || "").trim();
  const pass = String(form.get("password") || "");
  if (user !== (process.env.AUTH_USER || "team") || pass !== process.env.AUTH_PASSWORD) return fail("wrong");
  return ok(user);
}
