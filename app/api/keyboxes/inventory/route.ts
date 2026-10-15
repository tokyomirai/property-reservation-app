import { prisma } from '../../../../utils/db';
import { getSession, unauthorized } from '../../../../utils/session';
import { normalizeKb, isNoneNumber, isKinNumber, isCompanyKb } from '../../../../utils/keybox';

// キーボックス在庫照合（社内のみ）。
// 物件の「管理番号(keyBoxNumber)」と当社KB番号マスタを突き合わせ、
// 各番号が今どこに割り当てられているか（社内在庫/物件使用中/重複使用/未登録番号）を返す。
// 現地確認・棚卸履歴は扱わない。既存データ（物件・マスタ）を参照するのみ。

export type KbState = '社内在庫' | '物件使用中' | '重複使用' | '未登録番号' | '回収待ち' | '番号なし' | '他社所有';

interface AssignedProperty {
  id: string;
  name: string;
  address: string;
  setupLocation: string; // 保管場所
  unlockCode: string;    // 解除番号
  hasSlippers: string;   // スリッパ有無
  hasSignboard: string;  // 売り看板有無
  notes: string;         // 物件備考
  lastUpdatedBy: string;
  updatedAt: string;
}

export interface KbRow {
  number: string;
  state: KbState;
  inMaster: boolean;
  isActive: boolean;
  kbNotes: string;
  // 社内在庫時の保管場所（"4F"/自由入力。空＝未設定）
  storageLocation: string;
  properties: AssignedProperty[];
  warning?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const [master, properties, pendingRecoveries] = await Promise.all([
    prisma.keyBox.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.property.findMany({
      // 売却済み物件は在庫照合の対象外（現地割当から外れたとみなす。回収状況は回収待ちで管理）
      where: { soldAt: null },
      select: {
        id: true, name: true, address: true, keyBoxNumber: true,
        setupLocation: true, unlockCode: true, hasSlippers: true, hasSignboard: true,
        notes: true, lastUpdatedBy: true, updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.keyBoxRecovery.findMany({
      where: { status: '回収待ち' },
      orderBy: { requestedAt: 'asc' },
    }),
  ]);

  // 回収待ちの番号 → スナップショット（表示用に AssignedProperty 形へ）
  const pendingByNumber = new Map<string, AssignedProperty[]>();
  for (const rec of pendingRecoveries) {
    const n = normalizeKb(rec.keyBoxNumber);
    if (!isCompanyKb(n)) continue;
    const arr = pendingByNumber.get(n) ?? [];
    arr.push({
      id: rec.propertyId,
      name: rec.propertyName || '（売却済み物件）',
      address: rec.propertyAddress,
      setupLocation: rec.setupLocation,
      unlockCode: rec.unlockCode,
      hasSlippers: '',
      hasSignboard: '',
      notes: rec.notes,
      lastUpdatedBy: rec.requestedBy,
      updatedAt: rec.requestedAt.toISOString(),
    });
    pendingByNumber.set(n, arr);
  }

  const toAssigned = (p: (typeof properties)[number]): AssignedProperty => ({
    id: p.id, name: p.name, address: p.address,
    setupLocation: p.setupLocation, unlockCode: p.unlockCode, hasSlippers: p.hasSlippers, hasSignboard: p.hasSignboard,
    notes: p.notes, lastUpdatedBy: p.lastUpdatedBy, updatedAt: p.updatedAt.toISOString(),
  });

  // 当社番号 → その番号を使っている物件一覧（00・金・空は除外）
  const usage = new Map<string, AssignedProperty[]>();
  let none00 = 0; // 番号なし（00・未入力）
  let kin = 0;    // 他社所有（金）
  const none00Props: AssignedProperty[] = []; // 番号なし(00)の物件（一覧表示用）
  const kinProps: AssignedProperty[] = [];    // 他社所有(金)の物件（一覧表示用）
  const excluded: { none00: { name: string; address: string }[]; kin: { name: string; address: string }[] } = {
    none00: [], kin: [],
  };

  for (const p of properties) {
    const n = normalizeKb(p.keyBoxNumber);
    if (isKinNumber(n)) {
      kin++;
      kinProps.push(toAssigned(p));
      excluded.kin.push({ name: p.name, address: p.address });
      continue;
    }
    if (isNoneNumber(n)) {
      // "00" のみを番号なしとして計上（未入力の空は在庫照合の対象外・件数にも含めない）
      if (n === '00') {
        none00++;
        none00Props.push(toAssigned(p));
        excluded.none00.push({ name: p.name, address: p.address });
      }
      continue;
    }
    if (isCompanyKb(n)) {
      const arr = usage.get(n) ?? [];
      arr.push(toAssigned(p));
      usage.set(n, arr);
    }
  }

  const activeMaster = master.filter((m) => m.isActive);
  const activeNumbers = new Set(activeMaster.map((m) => normalizeKb(m.number)));
  const masterByNumber = new Map(master.map((m) => [normalizeKb(m.number), m]));

  const rows: KbRow[] = [];
  const rendered = new Set<string>();

  // 1) マスタ（有効）番号ごとの状態
  //    使用中（売却前の物件に割当）＞ 回収待ち ＞ 社内在庫 の優先で判定する。
  for (const m of activeMaster) {
    const num = normalizeKb(m.number);
    const props = usage.get(num) ?? [];
    const pending = pendingByNumber.get(num) ?? [];
    let state: KbState;
    let properties: AssignedProperty[];
    let warning: string | undefined;
    if (props.length > 0) {
      state = props.length === 1 ? '物件使用中' : '重複使用';
      properties = props;
      warning = state === '重複使用' ? '同じキーボックス番号が複数物件で使用されています' : undefined;
    } else if (pending.length > 0) {
      state = '回収待ち';
      properties = pending;
      warning = '売却済み物件から未回収です。回収完了まで社内在庫に戻しません';
    } else {
      state = '社内在庫';
      properties = [];
    }
    rows.push({ number: num, state, inMaster: true, isActive: true, kbNotes: m.notes, storageLocation: m.storageLocation, properties, warning });
    rendered.add(num);
  }

  // 2) マスタ(有効)に無い当社番号が物件に登録されている → 未登録番号
  let unregistered = 0;
  for (const [num, props] of usage) {
    if (activeNumbers.has(num)) continue;
    unregistered++;
    rendered.add(num);
    const m = masterByNumber.get(num); // 廃止マスタに存在する可能性
    rows.push({
      number: num, state: '未登録番号', inMaster: Boolean(m), isActive: false,
      kbNotes: m?.notes ?? '', storageLocation: m?.storageLocation ?? '', properties: props,
      warning: m
        ? '廃止済みのキーボックス番号が物件に登録されています'
        : 'マスタに未登録のキーボックス番号が物件に登録されています',
    });
  }

  // 3) 使用中でもマスタ行にも出ていない回収待ち番号（廃止番号など）→ 回収待ち行として追加
  for (const [num, pending] of pendingByNumber) {
    if (rendered.has(num)) continue;
    rendered.add(num);
    const m = masterByNumber.get(num);
    rows.push({
      number: num, state: '回収待ち', inMaster: Boolean(m), isActive: Boolean(m?.isActive),
      kbNotes: m?.notes ?? '', storageLocation: m?.storageLocation ?? '', properties: pending,
      warning: '売却済み物件から未回収です。回収完了まで社内在庫に戻しません',
    });
  }

  // 4) 番号なし(00)・他社所有(金) も一覧に表示（集計タイルのクリック絞り込み対象）。
  //    番号が共通のため、それぞれ1行に該当物件をまとめる（集計件数＝物件数と一致）。
  // 番号なし(00)は「管理番号」ではなく未設定を意味するため、物件ごとに1行ずつ表示する（まとめない）。
  for (const prop of none00Props) {
    rows.push({ number: '00', state: '番号なし', inMaster: false, isActive: false, kbNotes: '', storageLocation: '', properties: [prop] });
  }
  if (kinProps.length > 0) {
    rows.push({ number: '金', state: '他社所有', inMaster: false, isActive: false, kbNotes: '', storageLocation: '', properties: kinProps });
  }

  // 並び順: 番号を数値優先で昇順（先頭ゼロは表示上は保持）
  rows.sort((a, b) => {
    const na = Number(a.number), nb = Number(b.number);
    const aNum = Number.isFinite(na), bNum = Number.isFinite(nb);
    if (aNum && bNum && na !== nb) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    return a.number.localeCompare(b.number);
  });

  const aggregates = {
    total: activeMaster.length,                                   // 当社KB総数（有効マスタ）
    inStock: rows.filter((r) => r.state === '社内在庫').length,   // 社内在庫
    inUse: rows.filter((r) => r.state === '物件使用中').length,   // 物件使用中
    duplicate: rows.filter((r) => r.state === '重複使用').length, // 重複使用
    pending: pendingRecoveries.length,                            // 回収待ち（未回収）
    unregistered,                                                 // 未登録番号
    none00,                                                       // 番号なし(00)
    kin,                                                          // 他社所有(金)
  };

  return Response.json({ aggregates, rows, excluded });
}
