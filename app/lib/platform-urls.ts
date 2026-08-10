const baseUrls: Record<string, string> = {
  "易金在线": "https://www.yjzx.com/",
  "赵涌在线": "https://www.zhaoonline.com/",
  "金币云集": "https://www.chngc.net/common/homep",
  "爱藏": "https://m.airmb.com/",
  "麦稀奇": "https://blog.mxiqi.com/",
  "邮宝": "https://www.youbao360.com/TradePost?type=2",
  "闲鱼": "https://www.goofish.com/",
  "邮币卡一尘": "https://apps.apple.com/cn/app/id1538149062",
};

export function platformSearchUrl(platform: string, term: string) {
  const encoded = encodeURIComponent(term || "钱币");
  if (platform === "邮宝")
    return `https://www.youbao360.com/TradePostMore?name=${encoded}&type=3`;
  if (platform === "赵涌在线")
    return term.includes("熊猫")
      ? "https://zhaoonline.com/trade/xiongmaoxilie/"
      : "https://zhaoonline.com/trade/qianbi/";
  if (platform === "易金在线")
    return term.includes("熊猫")
      ? "https://www.yjzx.com/web2020/sell/list.html?classify_id=34"
      : "https://www.yjzx.com/web2020/material/list.html";
  if (platform === "闲鱼")
    return `https://www.goofish.com/search?q=${encoded}`;
  if (platform === "麦稀奇") return "https://www.mxiqi.com/?c=1";
  return baseUrls[platform] ?? "";
}
