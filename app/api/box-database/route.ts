type SeedRecord = {
  normalizedBoxCode: string;
  displayBoxCode: string;
  gradingCompany: string;
  grade: string;
  coinName: string;
  platform: string;
  detailUrl: string;
  price: number | null;
  priceWithFee: number | null;
  transactedAt: string;
  productCode: string;
  verificationStatus: "user_screenshot";
  evidenceNote: string;
};

const seedRecords: SeedRecord[] = [
  {
    normalizedBoxCode: "8616098030",
    displayBoxCode: "8616098-030",
    gradingCompany: "NGC",
    grade: "PF70 Ultra Cameo",
    coinName: "2026年30克吉祥文化如鱼得水彩银币",
    platform: "用户提供的评级盒图片",
    detailUrl: "",
    price: null,
    priceWithFee: null,
    transactedAt: "",
    productCode: "",
    verificationStatus: "user_screenshot",
    evidenceNote: "评级盒正面图片可确认盒号、币名与评级；尚未取得可核验的成交详情页，价格和成交时间留空。",
  },
  {
    normalizedBoxCode: "8760880010",
    displayBoxCode: "8760880-010",
    gradingCompany: "NGC",
    grade: "PF69 Ultra Cameo",
    coinName: "2026年30克吉祥文化如鱼得水彩银币",
    platform: "易金在线",
    detailUrl: "",
    price: 1250,
    priceWithFee: 1312,
    transactedAt: "2026-06-25 20:55:04",
    productCode: "AA659912",
    verificationStatus: "user_screenshot",
    evidenceNote: "用户提供的易金在线成交页截图可见这些字段；原始详情链接尚待历史回溯复核。",
  },
];

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").replace(/\D/g, "");
  if (query.length < 7 || query.length > 12) return Response.json({ ok: false, error: "请输入至少7位盒号", records: [] }, { status: 400 });
  const exact = query.length >= 10;
  const records = seedRecords.filter((record) => exact ? record.normalizedBoxCode === query : record.normalizedBoxCode.startsWith(query));
  return Response.json({ ok: true, query, match: exact ? "exact" : "prefix", records, source: "泉知盒号数据库", updatedAt: "2026-08-04T15:05:00+08:00" });
}
