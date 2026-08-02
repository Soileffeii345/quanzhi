type SeedRecord = {
  normalizedBoxCode: string;
  displayBoxCode: string;
  gradingCompany: string;
  grade: string;
  coinName: string;
  platform: string;
  detailUrl: string;
  price: number;
  priceWithFee: number;
  transactedAt: string;
  productCode: string;
  verificationStatus: "user_screenshot";
  evidenceNote: string;
};

const seedRecords: SeedRecord[] = [
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
  return Response.json({ ok: true, query, match: exact ? "exact" : "prefix", records, source: "泉知盒号数据库", updatedAt: "2026-08-02T23:55:00+08:00" });
}
