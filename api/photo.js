const allowedOrigins = ["https://bobaekimboae.github.io"];

export default async function handler(req, res) {
  const origin = req.headers.origin;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET 요청만 지원합니다." });

  let imageUrl;
  try {
    imageUrl = new URL(String(req.query?.url || ""));
  } catch {
    return res.status(400).json({ error: "이미지 주소가 올바르지 않습니다." });
  }
  if (imageUrl.protocol !== "https:" || !/^file\d*\.bobaedream\.co\.kr$/.test(imageUrl.hostname)
    || !/^\/pds\/CyberCar\/\d+\/\d+\/img_\d+_\d+\.(?:jpg|jpeg|png|webp)$/i.test(imageUrl.pathname)) {
    return res.status(400).json({ error: "보배드림 차량 사진 주소만 가져올 수 있습니다." });
  }

  try {
    const response = await fetch(imageUrl.href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoDash2ListingImporter/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return res.status(502).json({ error: "차량 사진 서버 응답 오류" });
    const type = response.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return res.status(415).json({ error: "이미지 파일이 아닙니다." });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 15_000_000) return res.status(413).json({ error: "사진 용량이 너무 큽니다." });
    res.setHeader("Content-Type", type);
    res.setHeader("Content-Length", String(bytes.length));
    return res.status(200).send(bytes);
  } catch {
    return res.status(502).json({ error: "차량 사진을 가져오지 못했습니다." });
  }
}

