import { COOKIE } from "@/lib/auth";

export async function GET() {
  return new Response(null, {
    status: 303,
    headers: { Location: "/signin", "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0` },
  });
}
