import { cookies } from "next/headers";
import { COOKIE, GUEST, verify } from "./auth";

export interface SessionUser {
  name: string;
  guest: boolean;
}

/** Read the signed-in user in a server component. */
export async function currentUser(): Promise<SessionUser | null> {
  const user = await verify((await cookies()).get(COOKIE)?.value);
  if (!user) return null;
  return user === GUEST ? { name: "Guest", guest: true } : { name: user, guest: false };
}
