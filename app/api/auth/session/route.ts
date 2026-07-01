import { type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('admin_session');
  const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

  if (!cookie?.value || !jwtSecret) {
    return Response.json({ user: null });
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(cookie.value, secret);
    return Response.json({
      user: {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      },
    });
  } catch {
    return Response.json({ user: null });
  }
}
