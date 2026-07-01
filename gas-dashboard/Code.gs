/**
 * =====================================================================
 * 社内ダッシュボード (Google Apps Script Web App)
 * =====================================================================
 * 対象スプレッドシート:
 *   https://docs.google.com/spreadsheets/d/1GcgM3AJ4A1E2MtiPLRrDsj9RY1_6dyrPXM9AJppCp_I/
 * 使用シート:
 *   ・リアルタイムグラフデータ … 担当者別の実績データ（表示順・粗利・売上など）
 *   ・事業部分析用           … 年間目標 / 実績（売上・各種粗利）
 *
 * 列の位置（何列目か）には一切依存しません。すべて1行目の「見出し名」から
 * 列を自動判定します。実際のシートの見出し表記が下記 HEADER_ALIASES の候補と
 * 異なる場合は、該当項目の配列に実際の見出し文言を追加するだけで動作します。
 * 列の並び替え・列の追加・担当者の増減があってもコード修正は不要です。
 * =====================================================================
 */

var CONFIG = {
  SPREADSHEET_ID: '1GcgM3AJ4A1E2MtiPLRrDsj9RY1_6dyrPXM9AJppCp_I',

  SHEETS: {
    REALTIME: 'リアルタイムグラフデータ',
    DIVISION: '事業部分析用'
  },

  // 担当者コードの特殊値
  SPECIAL_CODES: {
    RENTAL: '9998',  // 賃貸
    RETIRED: '9999'  // 退職者
  },

  RANKING: {
    TOP_N: 10,
    EXCLUDE_NAMES: ['社長'],                 // 名前でランキング除外
    EXCLUDE_CODES: ['9998', '9999']          // 賃貸・退職者はランキング対象外
  },

  // サーバー側の簡易キャッシュ（秒）。クライアントは60秒毎に再取得するため、
  // 同時アクセスが多い場合のスプレッドシート読込負荷を軽減する。
  CACHE_SECONDS: 50,

  // 見出し名のエイリアス（表記ゆれ対応）。左から順に完全一致を探し、
  // 見つからない場合は部分一致でも判定する。
  HEADER_ALIASES: {
    person: {
      code: ['担当者コード', 'コード', '社員コード', '社員番号', 'ID'],
      name: ['担当者名', '担当者', '氏名', '名前', '営業担当'],
      order: ['表示順', '並び順', '順番'],
      settledProfit: ['決済済粗利', '決済済み粗利', '決済粗利', '入金済粗利'],
      stockProfit: ['在庫粗利', '未決済粗利', '仕掛粗利'],
      confirmedProfit: ['確定粗利', '確定利益'],
      stockSales: ['在庫売上', '未決済売上', '仕掛売上'],
      sales: ['売上', '確定売上', '決済済売上']
    },
    division: {
      item: ['項目', '項目名', '科目', '分類', '指標'],
      target: ['年間目標', '目標', '目標値', '年間目標値'],
      actual: ['実績', '実績値', '累計実績', '達成実績']
    }
  },

  // 「事業部分析用」シートの項目名（分類列の値）とのマッチング候補
  DIVISION_ITEMS: {
    sales: ['売上'],
    floor4Profit: ['4階営業部粗利', '４階営業部粗利', '4階粗利'],
    reinsProfit: ['レインズ粗利'],
    annualProfit: ['年間粗利']
  }
};

/**
 * Webアプリのエントリーポイント
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('社内ダッシュボード')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * クライアントから呼び出されるメイン関数。
 * 成功時: { success: true, updatedAt, people, division, ranking }
 * 失敗時: { success: false, error }
 */
function getDashboardData() {
  try {
    var cache = CacheService.getScriptCache();
    var cached = cache.get('dashboardData');
    if (cached) {
      return JSON.parse(cached);
    }

    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var people = getPersonData_(ss);
    var division = getDivisionData_(ss);
    var ranking = buildRanking_(people);

    var result = {
      success: true,
      updatedAt: new Date().toISOString(),
      people: people,
      division: division,
      ranking: ranking
    };

    cache.put('dashboardData', JSON.stringify(result), CONFIG.CACHE_SECONDS);
    return result;
  } catch (err) {
    return {
      success: false,
      error: err && err.message ? err.message : String(err)
    };
  }
}

/**
 * 「リアルタイムグラフデータ」シートを読み込み、担当者ごとのデータを
 * 表示順テーブル（表示順列）でソートして返す。
 */
function getPersonData_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.REALTIME);
  if (!sheet) {
    throw new Error('シート「' + CONFIG.SHEETS.REALTIME + '」が見つかりません');
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0];
  var map = buildHeaderIndexMap_(headers, CONFIG.HEADER_ALIASES.person);

  var required = ['name', 'settledProfit', 'stockProfit', 'confirmedProfit', 'stockSales', 'sales'];
  var missing = required.filter(function (k) { return map[k] === -1; });
  if (missing.length > 0) {
    throw new Error(
      '「' + CONFIG.SHEETS.REALTIME + '」で見出しが見つかりません: ' + missing.join(', ') +
      ' / 実際の見出し: [' + headers.join(', ') + ']'
    );
  }

  var rows = values.slice(1)
    .filter(function (r) { return String(r[map.name] || '').trim() !== ''; })
    .map(function (r) {
      var code = map.code !== -1 ? String(r[map.code]).trim() : '';
      return {
        code: code,
        name: String(r[map.name]).trim(),
        order: map.order !== -1 ? toNumber_(r[map.order]) : Number.MAX_SAFE_INTEGER,
        settledProfit: toNumber_(r[map.settledProfit]),
        stockProfit: toNumber_(r[map.stockProfit]),
        confirmedProfit: toNumber_(r[map.confirmedProfit]),
        stockSales: toNumber_(r[map.stockSales]),
        sales: toNumber_(r[map.sales]),
        isRental: code === CONFIG.SPECIAL_CODES.RENTAL,
        isRetired: code === CONFIG.SPECIAL_CODES.RETIRED
      };
    });

  rows.sort(function (a, b) { return a.order - b.order; });
  return rows;
}

/**
 * 「事業部分析用」シートを読み込み、①年間目標進捗カード用データを返す。
 * 達成率・残額はここで計算する（シート側に列がなくても動作する）。
 */
function getDivisionData_(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEETS.DIVISION);
  if (!sheet) {
    throw new Error('シート「' + CONFIG.SHEETS.DIVISION + '」が見つかりません');
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return {};

  var headers = values[0];
  var map = buildHeaderIndexMap_(headers, CONFIG.HEADER_ALIASES.division);

  var missing = ['item', 'target', 'actual'].filter(function (k) { return map[k] === -1; });
  if (missing.length > 0) {
    throw new Error(
      '「' + CONFIG.SHEETS.DIVISION + '」で見出しが見つかりません: ' + missing.join(', ') +
      ' / 実際の見出し: [' + headers.join(', ') + ']'
    );
  }

  var dataRows = values.slice(1).map(function (r) {
    return {
      item: String(r[map.item] || '').trim(),
      target: toNumber_(r[map.target]),
      actual: toNumber_(r[map.actual])
    };
  });

  function findItem(aliases) {
    var row = dataRows.filter(function (d) { return d.item !== ''; })
      .find(function (d) {
        return aliases.some(function (a) { return d.item.indexOf(a) !== -1; });
      });
    if (!row) return null;
    var rate = row.target !== 0 ? row.actual / row.target : 0;
    return {
      label: row.item,
      target: row.target,
      actual: row.actual,
      rate: rate,
      remaining: row.target - row.actual
    };
  }

  return {
    sales: findItem(CONFIG.DIVISION_ITEMS.sales),
    floor4Profit: findItem(CONFIG.DIVISION_ITEMS.floor4Profit),
    reinsProfit: findItem(CONFIG.DIVISION_ITEMS.reinsProfit),
    annualProfit: findItem(CONFIG.DIVISION_ITEMS.annualProfit)
  };
}

/**
 * ⑤ランキング（社長・賃貸・退職者を除外したTOP10）を作成する。
 */
function buildRanking_(people) {
  var eligible = people.filter(function (p) {
    var excludedByCode = CONFIG.RANKING.EXCLUDE_CODES.indexOf(p.code) !== -1;
    var excludedByName = CONFIG.RANKING.EXCLUDE_NAMES.indexOf(p.name) !== -1;
    return !excludedByCode && !excludedByName;
  });

  var bySettled = eligible.slice()
    .sort(function (a, b) { return b.settledProfit - a.settledProfit; })
    .slice(0, CONFIG.RANKING.TOP_N);

  var bySales = eligible.slice()
    .sort(function (a, b) { return b.sales - a.sales; })
    .slice(0, CONFIG.RANKING.TOP_N);

  return {
    settledProfit: bySettled,
    sales: bySales
  };
}

/**
 * 見出し配列 headers に対して、aliasGroups（{ key: [候補, ...] }）の
 * 各キーがどの列インデックスに対応するかを判定する。
 * 完全一致を優先し、無ければ部分一致で判定する。見つからなければ -1。
 */
function buildHeaderIndexMap_(headers, aliasGroups) {
  var normalized = headers.map(function (h) { return String(h || '').trim(); });
  var map = {};

  Object.keys(aliasGroups).forEach(function (key) {
    var aliases = aliasGroups[key];
    var idx = -1;

    for (var i = 0; i < aliases.length && idx === -1; i++) {
      idx = normalized.indexOf(aliases[i]);
    }

    if (idx === -1) {
      for (var j = 0; j < normalized.length && idx === -1; j++) {
        var hit = aliases.some(function (a) { return normalized[j].indexOf(a) !== -1; });
        if (hit) idx = j;
      }
    }

    map[key] = idx;
  });

  return map;
}

/**
 * "1,234円" のような表記も含めて数値化する。数値化できない場合は0。
 */
function toNumber_(v) {
  if (v === '' || v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  var n = Number(String(v).replace(/[,¥\s]/g, ''));
  return isNaN(n) ? 0 : n;
}
