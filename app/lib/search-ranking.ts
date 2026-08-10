export type SearchableCoin = { coinName: string; keywords?: string; saleCount: number };

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s,，、·._/\\-]+/g, "").trim();
}

export function tokenizeSearchQuery(value: string) {
  const separated = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(\d)(?=[^\d\s])/g, "$1 ")
    .replace(/([^\d\s])(?=\d)/g, "$1 ");
  return separated.split(/[\s,，、·._/\\-]+/).map((item) => item.trim()).filter(Boolean);
}

export function normalizeCertificateQuery(value: string) {
  const upper = value.normalize("NFKC").toUpperCase().trim();
  const company = upper.startsWith("PCGS") ? "PCGS" : upper.startsWith("NGC") ? "NGC" : "";
  const digits = upper.replace(/^(NGC|PCGS)\s*/i, "").replace(/\D/g, "");
  return { company, digits, isLikelyCertificate: digits.length >= 8 && digits.length <= 12 };
}

function isSubsequence(query: string, target: string) {
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti += 1) if (target[ti] === query[qi]) qi += 1;
  return qi === query.length;
}

function editDistanceWithin(left: string, right: string, limit: number) {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= right.length; j += 1) {
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return false;
    previous = current;
  }
  return previous[right.length] <= limit;
}

function scoreToken(rawToken: string, rawName: string, keywordTokens: string[]) {
  const token = normalizeSearchText(rawToken);
  const name = normalizeSearchText(rawName);
  if (!token) return 0;
  if (/^\d+(?:\.\d+)?$/.test(token)) {
    if (name.includes(token)) return 1100;
    if (keywordTokens.some((keyword) => keyword === token || keyword.startsWith(`${token}年`) || keyword.startsWith(`${token}克`))) return 1050;
    return 0;
  }
  if (name === token) return 1200;
  if (name.startsWith(token)) return 1000;
  if (keywordTokens.some((keyword) => keyword === token)) return 950;
  if (keywordTokens.some((keyword) => keyword.startsWith(token))) return 900;
  if (name.includes(token)) return 820;
  if (keywordTokens.some((keyword) => keyword.includes(token))) return 780;
  if (isSubsequence(token, name)) return 560;
  if (keywordTokens.some((keyword) => isSubsequence(token, keyword))) return 520;
  // Edit-distance correction is safe for Latin queries (e.g. "panda" typos),
  // but is too risky for short Chinese product names where one character can
  // change the coin series entirely (中国龙 vs 中国人).
  if (token.length >= 3 && /^[a-z0-9]+$/i.test(token)) {
    const limit = token.length >= 6 ? 2 : 1;
    const candidates = [name, ...keywordTokens].flatMap((candidate) => {
      if (candidate.length <= token.length + limit) return [candidate];
      const windows: string[] = [];
      for (let i = 0; i <= candidate.length - token.length + limit; i += 1) windows.push(candidate.slice(i, i + token.length), candidate.slice(i, i + token.length + 1));
      return windows;
    });
    if (candidates.some((candidate) => editDistanceWithin(token, candidate, limit))) return 360;
  }
  return 0;
}

export function scoreCoinSearch(query: string, coin: SearchableCoin) {
  const tokens = tokenizeSearchQuery(query);
  if (tokens.length === 0) return 0;
  const keywordTokens = (coin.keywords ?? "").split(/[,，、]+/).map(normalizeSearchText).filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    const tokenScore = scoreToken(token, coin.coinName, keywordTokens);
    if (tokenScore === 0) return 0;
    score += tokenScore;
  }
  return score + Math.min(coin.saleCount, 500) / 1000;
}
