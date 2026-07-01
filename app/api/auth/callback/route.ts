import { type NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const ALLOWED_DOMAIN = 'tokyomf.co.jp';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Googleがキャンセルまたはエラーを返した場合
  if (error || !code) {
    return Response.redirect(`${appUrl}/admin?error=cancelled`);
  }

  try {
    // 1. 認証コードをトークンに交換
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        redirect_uri: `${appUrl}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', await tokenResponse.text());
      return Response.redirect(`${appUrl}/admin?error=token_failed`);
    }

    const tokens = await tokenResponse.json();

    // 2. ユーザー情報を取得
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResponse.ok) {
      return Response.redirect(`${appUrl}/admin?error=user_info_failed`);
    }

    const userInfo = await userResponse.json();
    const email: string = userInfo.email ?? '';

    // 3. ドメイン検証
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return Response.redirect(`${appUrl}/admin?error=domain_mismatch&email=${encodeURIComponent(email)}`);
    }

    // 4. JWTセッションを作成してCookieにセット
    const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!jwtSecret) {
      return Response.redirect(`${appUrl}/admin?error=server_config`);
    }

    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      email,
      name: userInfo.name ?? email,
      picture: userInfo.picture ?? '',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(secret);

    const response = Response.redirect(`${appUrl}/admin`);
    response.headers.set(
      'Set-Cookie',
      `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${
        appUrl.startsWith('https') ? '; Secure' : ''
      }`
    );
    return response;
  } catch (e) {
    console.error('OAuth callback error:', e);
    return Response.redirect(`${appUrl}/admin?error=server_error`);
  }
}
