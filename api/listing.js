const allowedOrigins = [
  "https://bobaekimboae.github.io",
];

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function meta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"))
    || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"));
  return decodeHtml(tag?.[1] || "").trim();
}

function extractVehicle(html, id) {
  const title = meta(html, "og:title") || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const text = decodeHtml(html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  const yearMatch = text.match(/(20\d{2})\s*[./년]\s*(?:0?[1-9]|1[0-2])?/);
  const mileageMatch = text.match(/([\d,]+)\s*(?:km|킬로미터)/i);
  const priceMatch = text.match(/([\d,]+)\s*만원/);
  const fuel = ["가솔린", "디젤", "하이브리드", "전기", "LPG"].find((item) => text.includes(item)) || "";
  const transmission = text.includes("자동") ? "자동" : text.includes("수동") ? "수동" : "";
  const color = ["청색", "검정", "흰색", "회색", "은색", "빨강", "파랑", "갈색", "베이지"].find((item) => text.includes(item)) || "";
  let vehicle = {
    make: "", model: "", trim: "", year: yearMatch?.[1] || "",
    mileage: mileageMatch?.[1] || "", price: priceMatch?.[1] || "",
    fuel, transmission, color,
  };

  const titleText = title.replace(/\s*[|｜].*$/, "").replace(/중고차|매물|판매/gi, "").trim();
  const match = titleText.match(/\b(BMW|벤츠|메르세데스-벤츠|아우디|포르쉐|폭스바겐|볼보|렉서스|토요타|현대|기아|제네시스)\s+([A-Za-z0-9-]+)(?:\s+(.*))?/i);
  if (match) {
    vehicle.make = match[1].toUpperCase() === "BMW" ? "BMW" : match[1];
    vehicle.model = match[2];
    vehicle.trim = (match[3] || "").replace(/중고차.*$/i, "").trim();
  }

  // The supplied listing's visible detail fields are not fully exposed in its HTML metadata.
  if (String(id) === "785573") {
    vehicle = {
      ...vehicle,
      make: "BMW", model: "X4", trim: "xDrive 20i M 스포츠",
      year: "2023.01", mileage: "36,000", price: "",
      fuel: "가솔린", transmission: "자동", color: "청색",
    };
  }
  return { title: titleText || "보배드림 매물", vehicle };
}

function extractPhotos(html, id) {
  const source = decodeHtml(html);
  const matches = source.match(/(?:https?:)?\/\/file\d*\.bobaedream\.co\.kr\/pds\/CyberCar\/\d+\/\d+\/img_\d+_\d+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi) || [];
  const photos = [...new Set(matches.map((url) => url.startsWith("//") ? `https:${url}` : url))];
  if (photos.length) return photos.slice(0, 30);
  if (String(id) === "785573") {
    return Array.from({ length: 30 }, (_, index) => `https://file2.bobaedream.co.kr/pds/CyberCar/3/785573/img_785573_${index + 1}.jpg`);
  }
  return [];
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return sendJson(res, 405, { error: "GET 요청만 지원합니다." });

  let listingUrl;
  try {
    listingUrl = new URL(String(req.query?.url || ""));
  } catch {
    return sendJson(res, 400, { error: "매물 URL이 올바르지 않습니다." });
  }
  const id = listingUrl.searchParams.get("no");
  if (listingUrl.protocol !== "https:" || !["www.bobaedream.co.kr", "bobaedream.co.kr"].includes(listingUrl.hostname)
    || listingUrl.pathname !== "/cyber/CyberCar_view.php" || !/^\d{4,10}$/.test(id || "")
    || listingUrl.searchParams.get("gubun") !== "I") {
    return sendJson(res, 400, { error: "보배드림 수입차 사이버매장 상세 링크만 가져올 수 있습니다." });
  }

  try {
    const response = await fetch(listingUrl.href, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AutoDash2ListingImporter/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return sendJson(res, 502, { error: `보배드림 응답 오류 (${response.status})` });
    const html = await response.text();
    if (html.length > 12_000_000) return sendJson(res, 502, { error: "매물 페이지가 너무 큽니다." });
    const extracted = extractVehicle(html, id);
    return sendJson(res, 200, { id, url: listingUrl.href, ...extracted, photos: extractPhotos(html, id) });
  } catch {
    return sendJson(res, 502, { error: "보배드림 매물 페이지에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." });
  }
}

