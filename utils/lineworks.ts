// utils/lineworks.ts
// LINE WORKS カレンダー連携。
// 内見予約が確定（承認済）になった際に、LINE WORKSカレンダーへ予定を自動登録する。
//
// 必要な環境変数（未設定の場合は登録をスキップし、予約処理自体は正常に完了させる）:
//   LINEWORKS_CLIENT_ID       Developer Console で発行した Client ID
//   LINEWORKS_CLIENT_SECRET   Client Secret
//   LINEWORKS_SERVICE_ACCOUNT サービスアカウントID（xxxx.serviceaccount@example）
//   LINEWORKS_PRIVATE_KEY     サービスアカウントの秘密鍵（PEM形式 / 改行は \n でも可）
//   LINEWORKS_CALENDAR_USER   予定を登録するユーザーID（省略時は "me"）
//   LINEWORKS_CALENDAR_ID     特定カレンダーに登録する場合のみ指定（省略時は基本カレンダー）
import { SignJWT, importPKCS8 } from 'jose';

const TOKEN_URL = 'https://auth.worksmobile.com/oauth2/v2.0/token';
const API_BASE = 'https://www.worksapis.com/v1.0';
const SCOPE = 'calendar';
const TIME_ZONE = 'Asia/Tokyo';

interface LineWorksConfig {
  clientId: string;
  clientSecret: string;
  serviceAccount: string;
  privateKey: string;
  calendarUser: string;
  calendarId: string;
}

function getConfig(): LineWorksConfig | null {
  const clientId = (process.env.LINEWORKS_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.LINEWORKS_CLIENT_SECRET ?? '').trim();
  const serviceAccount = (process.env.LINEWORKS_SERVICE_ACCOUNT ?? '').trim();
  // Vercel等の環境変数は改行を含められないため、"\n" のエスケープを実際の改行へ戻す
  const privateKey = (process.env.LINEWORKS_PRIVATE_KEY ?? '').replace(/\\n/g, '\n').trim();

  if (!clientId || !clientSecret || !serviceAccount || !privateKey) return null;

  return {
    clientId,
    clientSecret,
    serviceAccount,
    privateKey,
    calendarUser: (process.env.LINEWORKS_CALENDAR_USER ?? 'me').trim() || 'me',
    calendarId: (process.env.LINEWORKS_CALENDAR_ID ?? '').trim(),
  };
}

// アクセストークンは有効期間内であれば使い回す（サーバーレスの同一インスタンス内でのみ有効）
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: LineWorksConfig): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const key = await importPKCS8(config.privateKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(config.clientId)
    .setSubject(config.serviceAccount)
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 30) // 最大60分。余裕をもって30分。
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: SCOPE,
    }),
  });

  if (!res.ok) {
    throw new Error(`アクセストークン取得に失敗しました (HTTP ${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in?: number };
  const expiresIn = Number(data.expires_in ?? 3600);
  cachedToken = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return data.access_token;
}

export interface CalendarEventInput {
  /** 件名に使用する物件名 */
  propertyName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  /** HH:MM */
  endTime: string;
  companyName: string;
  agentName: string;
  phone: string;
  notes: string;
  /** 件名の先頭に付ける区分（例: 内見 / 社内案内） */
  category?: string;
}

/**
 * LINE WORKSカレンダーへ予定を登録する。
 * 設定が未投入の場合や API 呼び出しに失敗した場合は null を返す（呼び出し元の処理は止めない）。
 * @returns 登録された予定のID（取得できない場合は空文字）／未実行・失敗時は null
 */
export async function createCalendarEvent(input: CalendarEventInput): Promise<string | null> {
  const config = getConfig();
  if (!config) {
    console.warn('⚠️ LINE WORKSの設定が未投入のためカレンダー登録をスキップしました:', {
      summary: `${input.category ?? '内見'}：${input.propertyName}`,
      date: input.date,
      time: `${input.startTime}〜${input.endTime}`,
    });
    return null;
  }

  const summary = `【${input.category ?? '内見'}】${input.propertyName}`;
  const description = [
    `物件名　　：${input.propertyName}`,
    `日時　　　：${input.date} ${input.startTime}〜${input.endTime}`,
    `仲介会社名：${input.companyName || '（なし）'}`,
    `担当者名　：${input.agentName || '（なし）'}`,
    `電話番号　：${input.phone || '（未入力）'}`,
    `備考　　　：${input.notes || '（なし）'}`,
  ].join('\n');

  const body = {
    eventComponents: [
      {
        summary,
        description,
        start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone: TIME_ZONE },
        end: { dateTime: `${input.date}T${input.endTime}:00`, timeZone: TIME_ZONE },
        visibility: 'PUBLIC',
      },
    ],
  };

  const url = config.calendarId
    ? `${API_BASE}/users/${encodeURIComponent(config.calendarUser)}/calendars/${encodeURIComponent(config.calendarId)}/events`
    : `${API_BASE}/users/${encodeURIComponent(config.calendarUser)}/calendar/events`;

  try {
    const token = await getAccessToken(config);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error(`❌ LINE WORKSカレンダー登録エラー (HTTP ${res.status}):`, await res.text());
      return null;
    }

    const data = (await res.json().catch(() => null)) as
      | { eventComponents?: { eventId?: string }[]; eventId?: string }
      | null;
    const eventId = data?.eventComponents?.[0]?.eventId ?? data?.eventId ?? '';
    console.log(`✅ LINE WORKSカレンダー登録成功: ${summary} (${input.date} ${input.startTime}〜${input.endTime})`);
    return eventId;
  } catch (err) {
    // カレンダー登録の失敗が承認処理自体を失敗させないよう、ここで握りつぶす
    console.error('❌ LINE WORKSカレンダー登録で例外:', err);
    return null;
  }
}
