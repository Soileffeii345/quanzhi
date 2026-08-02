const destinations: Record<string, (query: string) => string> = {
  yijin: (query) => `https://www.yjzx.com/web2020/search/speed/history?status=3&searchFlag=2&query=${encodeURIComponent(query)}`,
  jinbiyunji: () => "https://www.ecgci.com/",
  maixiqi: () => "https://www.mxiqi.com/auction/item",
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const name = url.searchParams.get("name") ?? "";
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 80);

  if (name === "zhao") {
    const safeQuery = escapeHtml(query);
    return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>正在前往赵涌在线</title></head><body><p>正在前往赵涌在线搜索“${safeQuery}”…</p><form id="search" action="https://zhaoonline.com/query.shtml" method="post"><input type="hidden" name="keyword" value="${safeQuery}"><input type="hidden" name="q.types" value="1"></form><script>document.getElementById('search').submit()</script></body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const destination = destinations[name];
  if (!destination) return Response.json({ error: "未知平台" }, { status: 404 });
  return Response.redirect(destination(query), 302);
}
