import { type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { isLocalAuthBypass, LOCAL_BYPASS_USER } from '../../../../utils/session';

export async function GET(request: NextRequest) {
  // ローカル確認用の認証スキップ（本番では isLocalAuthBypass() が常に false）
  if (isLocalAuthBypass()) {
    return Response.json({ user: LOCAL_BYPASS_USER });
  }

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
