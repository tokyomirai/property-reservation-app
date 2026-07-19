import { type NextRequest, NextResponse } from 'next/server';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const redirectUri = `${appUrl}/api/auth/callback`;

  if (!clientId) {
    return new Response('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID.', {
      status: 503,
    });
  }

  // CSRF対策: ランダムな state を発行し、Cookieにも保存してコールバックで照合する
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  });

  const response = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  response.cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600, // 10分で失効
    secure: appUrl.startsWith('https'),
  });
  return response;
}
