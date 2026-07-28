import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface SessionUser {
  email: string;
  name: string;
  picture: string;
}

// ─────────────────────────────────────────────────────────────
// ローカル確認用の認証スキップ（本番では絶対に無効）
//
// 有効になる条件は「本番(Vercel)ではない」かつ「LOCAL_AUTH_BYPASS=true」の両方。
//   - process.env.VERCEL は Vercel 上で必ず "1" になるため、本番では is-bypass が false。
//   - LOCAL_AUTH_BYPASS は .env.local（.gitignore 済み・デプロイされない）にのみ設定する。
// 仮に Vercel の環境変数へ誤って LOCAL_AUTH_BYPASS=true を入れても、VERCEL ガードにより無効。
// 本番の認証ロジック（下の getSession 本体）は一切変更していない。
// ─────────────────────────────────────────────────────────────
export const LOCAL_BYPASS_USER: SessionUser = {
  email: 'local-admin@tokyomf.co.jp',
  name: 'ローカル確認ユーザー',
  // 1x1 透明画像（Headerのアバターimgに空srcを渡さないためのダミー）
  picture:
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
};

/** ローカル確認用の認証スキップが有効かどうか。本番(Vercel)では常に false。 */
export function isLocalAuthBypass(): boolean {
  return !process.env.VERCEL && process.env.LOCAL_AUTH_BYPASS === 'true';
}

export async function getSession(): Promise<SessionUser | null> {
  // ローカル確認用スキップ（本番では上記ガードにより到達しない）
  if (isLocalAuthBypass()) return LOCAL_BYPASS_USER;

  const jwtSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
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
