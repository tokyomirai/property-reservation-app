import { prisma } from '../../../utils/db';
import { getSession, unauthorized, isLocalAuthBypass } from '../../../utils/session';
import { DEFAULT_MANUAL_MD, MANUAL_EDITOR_EMAILS } from '../../../utils/manual';

// 利用マニュアル（1ページ目：社員の操作手順）の取得・保存。社内のみ。
// 編集は info@tokyomf.co.jp のみ（ローカル確認時は認証スキップでも可）。

const MANUAL_ID = 'singleton';
const MAX_LEN = 100000;

function canEdit(email: string): boolean {
  // ローカル確認（本番では常に false のガード付き）または許可メールのみ
  return isLocalAuthBypass() || MANUAL_EDITOR_EMAILS.includes(email);
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const doc = await prisma.manualDoc.findUnique({ where: { id: MANUAL_ID } });
  return Response.json({
    contentMd: doc?.contentMd ?? DEFAULT_MANUAL_MD,
    updatedByName: doc?.updatedByName ?? '',
    updatedAt: doc?.updatedAt ?? null,
    isDefault: !doc, // まだ保存が無い（既定本文）か
    canEdit: canEdit(session.email),
  });
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!canEdit(session.email)) {
    return Response.json({ error: 'この操作はマニュアル編集権限者のみ可能です' }, { status: 403 });
  }

  let body: { contentMd?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '不正なリクエストです' }, { status: 400 });
  }
  const contentMd = body.contentMd;
  if (typeof contentMd !== 'string' || contentMd.trim() === '') {
    return Response.json({ error: '本文が空です' }, { status: 400 });
  }
  if (contentMd.length > MAX_LEN) {
    return Response.json({ error: '本文が長すぎます' }, { status: 400 });
  }

  const doc = await prisma.manualDoc.upsert({
    where: { id: MANUAL_ID },
    update: { contentMd, updatedByName: session.name, updatedByEmail: session.email },
    create: {
      id: MANUAL_ID,
      contentMd,
      updatedByName: session.name,
      updatedByEmail: session.email,
    },
  });

  // 編集履歴（世代保存）
  await prisma.manualRevision.create({
    data: { contentMd, editorName: session.name, editorEmail: session.email },
  });

  return Response.json({
    contentMd: doc.contentMd,
    updatedByName: doc.updatedByName,
    updatedAt: doc.updatedAt,
    isDefault: false,
    canEdit: true,
  });
}
