import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const response = NextResponse.redirect(`${appUrl}/`);
  response.cookies.set('admin_session', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
  });
  return response;
}
