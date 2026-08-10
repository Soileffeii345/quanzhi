import { database } from './database.mjs';

function extractKeywords(name) {
  const kw = new Set();
  if (!name) return '';

  // 金属
  if (/金/.test(name)) kw.add('金');
  if (/银/.test(name)) kw.add('银');
  if (/铜/.test(name)) kw.add('铜');
  if (/铂|钯/.test(name)) kw.add('贵金属');

  // 类型
  if (/币/.test(name)) kw.add('币');
  if (/钞|票/.test(name)) kw.add('钞');
  if (/章/.test(name)) kw.add('章');

  // 年份
  const year = name.match(/(\d{4})年/);
  if (year) kw.add(year[1] + '年');

  // 重量
  const weight = name.match(/(\d+(?:\.\d+)?)\s*(?:克|盎司|oz|公斤)/);
  if (weight) kw.add(weight[0]);

  // 系列
  if (/熊猫/.test(name)) kw.add('熊猫');
  if (/生肖|[龙蛇马羊猴鸡狗猪鼠牛虎兔]年/.test(name)) kw.add('生肖');
  if (/观音|佛|寿星|罗汉|菩萨/.test(name)) kw.add('宗教');
  if (/奥运|冬奥/.test(name)) kw.add('奥运');
  if (/建国|建党|改革|抗战|世博/.test(name)) kw.add('重大事件');
  if (/吉祥|贺岁|福字/.test(name)) kw.add('吉祥文化');
  if (/书法|和字/.test(name)) kw.add('书法');
  if (/京剧|昆曲|黄梅/.test(name)) kw.add('戏曲');
  if (/泰山|武夷|黄山|峨眉/.test(name)) kw.add('名山');

  // 历史币
  if (/大清|光绪|宣统|民国|苏维埃|袁大头|孙小头|船洋/.test(name)) kw.add('历史币');

  // ── 别名/俗称映射 ──
  // 袁大头 → 袁像银元
  if (/袁像/.test(name)) { kw.add('袁大头'); kw.add('大头'); kw.add('袁头'); }
  // 孙小头 / 船洋 → 孙像银元
  if (/孙像|孙小头/.test(name)) { kw.add('孙小头'); kw.add('小头'); }
  if (/船洋/.test(name)) kw.add('船洋');
  // 龙洋 → 大清/光绪/宣统 + 银
  if (/大清|光绪|宣统/.test(name) && /银/.test(name)) { kw.add('龙洋'); kw.add('龙'); }
  if (/光绪元宝/.test(name)) { kw.add('龙洋'); kw.add('龙'); kw.add('元宝'); }
  // 宣统三年 → 宣三
  if (/宣统三年/.test(name)) kw.add('宣三');
  // 造币总厂 → 造总
  if (/造币总厂/.test(name)) kw.add('造总');
  // 北洋/江南/湖北/广东/四川/云南/吉林 造
  if (/北洋/.test(name)) { kw.add('北洋'); kw.add('北洋造'); }
  if (/江南/.test(name) && /造/.test(name)) { kw.add('江南'); kw.add('江南造'); }
  if (/湖北/.test(name) && /造/.test(name)) { kw.add('湖北'); kw.add('鄂造'); }
  if (/广东/.test(name) && /造/.test(name)) { kw.add('广东'); kw.add('粤造'); }
  if (/四川/.test(name) && /造/.test(name)) { kw.add('四川'); kw.add('川造'); }
  if (/云南/.test(name) && /造/.test(name)) { kw.add('云南'); kw.add('滇造'); }
  if (/吉林/.test(name) && /造/.test(name)) kw.add('吉林');
  if (/奉天/.test(name)) kw.add('奉天');
  // 站洋/坐洋/鹰洋
  if (/站洋|坐洋/.test(name)) kw.add('站洋');
  if (/鹰洋/.test(name)) kw.add('鹰洋');
  // 唐继尧 → 唐头
  if (/唐继尧/.test(name)) { kw.add('唐头'); kw.add('唐正'); }
  // 孙中山 → 孙像
  if (/孙中山/.test(name)) { kw.add('孙小头'); kw.add('孙中山'); kw.add('小头'); }
  // 苏维埃 → 苏区
  if (/苏维埃/.test(name)) kw.add('苏区');
  // 军阀币
  if (/曹锟|段祺瑞|徐世昌|黎元洪|张作霖|褚玉璞|袁世凯/.test(name)) { kw.add('军阀'); kw.add('军阀币'); }
  // 甘肃/新疆版
  if (/甘肃/.test(name)) kw.add('甘肃版');
  if (/新疆/.test(name)) kw.add('新疆版');
  // 加盖/戳记
  if (/加盖|戳记|墨戳/.test(name)) kw.add('戳记');
  // 样币/试铸
  if (/样币|试铸|试样/.test(name)) kw.add('样币');

  // ── 中文 bigram（连续两字）补充部分匹配 ──
  // Extract only Chinese characters for bigram generation
  const chinese = name.replace(/[^一-鿿]/g, '');
  for (let i = 0; i < chinese.length - 1; i++) {
    kw.add(chinese.slice(i, i + 2));
  }

  // 评级
  if (/NGC|PCGS|MS|PF|PR|SP|精制/.test(name)) kw.add('评级');

  // 国别
  if (/美国|英国|德国|法国|日本|加拿大|澳大利亚|巴西|墨西哥|比利时|俄罗斯|苏联|香港|澳门/.test(name)) {
    kw.add('外国/特区');
  }

  // 精制/普制
  if (/精制/.test(name)) kw.add('精制');
  if (/普制/.test(name)) kw.add('普制');

  // 彩色
  if (/彩色/.test(name)) kw.add('彩色');

  return [...kw].join(',');
}

// Backfill: --force rebuilds all records; default only fills empty ones
const forceAll = process.argv.includes('--force');
const rows = database.prepare(
  forceAll
    ? `SELECT normalized_box_code, platform, detail_url, coin_name FROM box_sales`
    : `SELECT normalized_box_code, platform, detail_url, coin_name FROM box_sales WHERE keywords IS NULL OR keywords = ''`
).all();
console.log(`Backfilling keywords for ${rows.length} records${forceAll ? ' (--force: all)' : ''}...`);

database.exec('BEGIN IMMEDIATE');
try {
  // A certificate number may occur in records from more than one source.
  // Update the exact record, never every row sharing a box number.
  const update = database.prepare(`
    UPDATE box_sales SET keywords = ?
    WHERE normalized_box_code = ? AND platform = ? AND detail_url = ?
  `);
  for (const r of rows) {
    const kw = extractKeywords(r.coin_name);
    update.run(kw, r.normalized_box_code, r.platform, r.detail_url);
  }
  database.exec('COMMIT');
  console.log('Done. Sample:');
} catch(e) {
  database.exec('ROLLBACK');
  throw e;
}

// Show samples
const samples = database.prepare('SELECT coin_name, keywords FROM box_sales WHERE keywords != \'\' LIMIT 8').all();
samples.forEach(r => console.log('  ' + r.keywords + '\n    ← ' + r.coin_name.slice(0, 60)));
