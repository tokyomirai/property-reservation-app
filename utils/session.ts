import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface SessionUser {
  email: string;
  name: string;
  picture: string;
}

export async function getSession(): Promise<SessionUser | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) return null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_session');
    if (!token?.value) return null;

    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token.value, secret);

    return {
      email: payload.email as string,
      name: payload.name as string,
      picture: payload.picture as string,
    };
  } catch {
    return null;
  }
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
