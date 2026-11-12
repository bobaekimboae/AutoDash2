import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, Check, ChevronDown, Clapperboard,
  Download, FileImage, ImagePlus, Info, LoaderCircle, Pause, Play,
  Plus, RotateCcw, Sparkles, Trash2, Upload, VolumeX, X,
} from "lucide-react";

const MAX_PHOTOS = 20;
const MAX_SELECTED = 5;
const LISTING_API = "https://121-78-125-73.sslip.io/autodash2-api";
const THEMES = {
  prism: { label: "프리즘 그리드", accent: "#f7bc4b", ink: "#16120a", wash: "#fff5df" },
  dolly: { label: "돌리", accent: "#e9e1d3", ink: "#27211b", wash: "#f6f2eb" },
  showroom: { label: "쇼룸", accent: "#e4be72", ink: "#171614", wash: "#f8f2e7" },
  listing: { label: "리스팅", accent: "#94c9b0", ink: "#0f211a", wash: "#eaf4ee" },
  trailer: { label: "트레일러", accent: "#fa694c", ink: "#250c08", wash: "#fff0eb" },
  gallery: { label: "무빙 갤러리", accent: "#f2d6a0", ink: "#281e10", wash: "#faf3e5" },
  parallax: { label: "패럴랙스 윈도우", accent: "#8cbdcc", ink: "#0d1e25", wash: "#eaf4f7" },
  chrome: { label: "크롬 모션", accent: "#cad3dc", ink: "#111923", wash: "#eef2f6" },
  film: { label: "필름 스캔", accent: "#eab763", ink: "#261a08", wash: "#f8efdf" },
  type: { label: "타입 뉴트럴", accent: "#fff", ink: "#111", wash: "#f4f4f4" },
};

const emptyVehicle = {
  make: "BMW", model: "X4", trim: "", year: "2023", mileage: "36,000", price: "", currency: "EUR · €",
  fuel: "", transmission: "", color: "", dealer: "",
};

function makeSceneLines(vehicle, index, total) {
  const title = [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "오늘의 추천 차량";
  const year = vehicle.year ? `${vehicle.year}년식` : "꼼꼼히 확인한 매물";
  const mileage = vehicle.mileage ? `${Number(vehicle.mileage.replaceAll(",", "")).toLocaleString("ko-KR")}km 주행` : "사진으로 만나보세요";
  const closing = index === total - 1 ? "지금 문의해 보세요" : "디테일까지 확인해 보세요";
  const lines = [
    { kicker: "오늘의 매물", title, detail: [year, vehicle.fuel].filter(Boolean).join(" · ") },
    { kicker: "주행 정보", title: mileage, detail: [vehicle.transmission, vehicle.color].filter(Boolean).join(" · ") || "차량 상태를 영상으로 확인하세요" },
    { kicker: "차량 포인트", title: vehicle.trim || "매력적인 디자인", detail: "실물 사진으로 확인하는 차량 컨디션" },
    { kicker: "가격 안내", title: vehicle.price ? `${vehicle.currency.split("·").at(-1).trim()}${Number(vehicle.price.replaceAll(",", "")).toLocaleString("ko-KR")}` : "합리적인 매물", detail: "상세 조건은 상담으로 안내해 드립니다" },
    { kicker: "상담 안내", title: closing, detail: vehicle.dealer || "편하게 문의해 주세요" },
  ];
  return lines[index % lines.length];
}

function coverImage(ctx, image, width, height, progress = 0) {
  const scale = Math.max(width / image.width, height / image.height) * (1.04 + progress * 0.09);
  const w = image.width * scale;
  const h = image.height * scale;
  const pan = Math.sin(progress * Math.PI) * Math.min(26, width * 0.05);
  ctx.drawImage(image, (width - w) / 2 + pan, (height - h) / 2, w, h);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(" ");
  let line = "";
  let row = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + row * lineHeight, maxWidth);
      row += 1;
      line = word;
      if (row >= maxLines - 1) break;
    } else line = candidate;
  }
  if (line && row < maxLines) ctx.fillText(line, x, y + row * lineHeight, maxWidth);
}

function drawFrame(canvas, image, scene, vehicle, theme, progress, photoIndex, totalPhotos, showPrice, logoImage) {
  if (!canvas || !image) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  coverImage(ctx, image, w, h, progress);

  const topFade = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  topFade.addColorStop(0, "rgba(8, 14, 10, .63)");
  topFade.addColorStop(1, "rgba(8, 14, 10, 0)");
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, w, h * 0.55);

  const lowerFade = ctx.createLinearGradient(0, h * 0.42, 0, h);
  lowerFade.addColorStop(0, "rgba(8, 14, 10, 0)");
  lowerFade.addColorStop(0.34, "rgba(8, 14, 10, .38)");
  lowerFade.addColorStop(1, "rgba(8, 14, 10, .88)");
  ctx.fillStyle = lowerFade;
  ctx.fillRect(0, h * 0.4, w, h * 0.6);

  const palette = THEMES[theme] || THEMES.prism;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  if (theme === "prism") {
    ctx.globalAlpha = 0.46;
    for (let gx = 42; gx < w; gx += 76) { ctx.beginPath(); ctx.moveTo(gx, 110); ctx.lineTo(gx, h - 340); ctx.stroke(); }
    for (let gy = 130; gy < h - 340; gy += 76) { ctx.beginPath(); ctx.moveTo(36, gy); ctx.lineTo(w - 36, gy); ctx.stroke(); }
    ctx.globalAlpha = 1;
  } else if (theme === "showroom" || theme === "chrome") {
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.strokeRect(31, 31, w - 62, h - 62);
  } else if (theme === "trailer") {
    ctx.fillStyle = "rgba(8,10,12,.48)";
    ctx.fillRect(0, h - 380, w, 380);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(0, h - 380, 11, 380);
  } else if (theme === "listing") {
    ctx.fillStyle = "rgba(10,18,15,.62)";
    ctx.beginPath(); ctx.roundRect(28, 24, 186, 48, 9); ctx.fill();
    ctx.fillStyle = palette.accent; ctx.fillRect(28, 24, 5, 48);
  } else if (theme === "dolly" || theme === "gallery") {
    ctx.fillStyle = "rgba(16,13,10,.46)"; ctx.fillRect(0, h - 350, w, 350);
    ctx.fillStyle = palette.accent; ctx.fillRect(42, h - 342, w - 84, 2);
  } else if (theme === "parallax") {
    ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(w - 60, 90); ctx.lineTo(w - 60, h - 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w - 78, 108); ctx.lineTo(w - 42, 108); ctx.stroke(); ctx.globalAlpha = 1;
  } else if (theme === "film") {
    ctx.fillStyle = "rgba(5,5,5,.56)"; ctx.fillRect(0, 0, 24, h); ctx.fillRect(w - 24, 0, 24, h);
    ctx.fillStyle = palette.accent; for (let sy = 22; sy < h; sy += 34) { ctx.fillRect(8, sy, 8, 15); ctx.fillRect(w - 16, sy, 8, 15); }
  } else if (theme === "type") {
    ctx.fillStyle = "rgba(0,0,0,.66)"; ctx.fillRect(0, h - 304, w, 304);
    ctx.fillStyle = palette.accent; ctx.fillRect(42, h - 286, 46, 4);
  }
  ctx.fillStyle = palette.accent;
  ctx.beginPath();
  ctx.roundRect(36, 42, 9, 34, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.font = "600 24px Pretendard, Arial, sans-serif";
  ctx.fillText(`${photoIndex + 1} / ${totalPhotos}`, 62, 68);

  const vehicleTitle = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "차량 매물 소개";
  ctx.fillStyle = "#fff";
  ctx.font = theme === "trailer" ? "800 60px Pretendard, Arial, sans-serif" : theme === "dolly" || theme === "gallery" ? "600 54px Georgia, serif" : theme === "type" ? "800 48px Pretendard, Arial, sans-serif" : "700 54px Pretendard, Arial, sans-serif";
  wrapCanvasText(ctx, scene.title || vehicleTitle, 42, h - 302, w - 84, 66, 2);
  ctx.fillStyle = palette.accent;
  ctx.font = "700 23px Pretendard, Arial, sans-serif";
  ctx.fillText(scene.kicker || "차량 소개", 44, h - 164);
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.font = "500 25px Pretendard, Arial, sans-serif";
  wrapCanvasText(ctx, scene.detail || "사진으로 살펴보는 차량의 매력", 44, h - 118, w - 88, 36, 2);

  const meta = [vehicle.year && `${vehicle.year}년식`, vehicle.mileage && `${Number(vehicle.mileage.replaceAll(",", "")).toLocaleString("ko-KR")}km`, showPrice && vehicle.price && `${vehicle.currency.split("·").at(-1).trim()}${Number(vehicle.price.replaceAll(",", "")).toLocaleString("ko-KR")}`].filter(Boolean).join("  ·  ");
  if (meta) {
    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = "500 18px Pretendard, Arial, sans-serif";
    ctx.fillText(meta, 44, h - 38, w - 88);
  }
  if (logoImage) {
    const ratio = Math.min(108 / logoImage.width, 52 / logoImage.height);
    const logoW = logoImage.width * ratio;
    const logoH = logoImage.height * ratio;
    ctx.fillStyle = "rgba(255,255,255,.94)";
    ctx.beginPath();
    ctx.roundRect(w - logoW - 34, 34, logoW + 18, logoH + 18, 12);
    ctx.fill();
    ctx.drawImage(logoImage, w - logoW - 25, 43, logoW, logoH);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function Field({ label, value, onChange, placeholder, suffix, type = "text" }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {suffix && <small>{suffix}</small>}
      </div>
    </label>
  );
}

export function App() {
  const [vehicle, setVehicle] = useState(emptyVehicle);
  const [credits, setCredits] = useState(5);
  const [photos, setPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scenes, setScenes] = useState({});
  const [theme, setTheme] = useState("prism");
  const [startMode, setStartMode] = useState("manual");
  const [listingUrl, setListingUrl] = useState("");
  const [listingLoading, setListingLoading] = useState(false);
  const [logo, setLogo] = useState(null);
  const [showPrice, setShowPrice] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentScene, setCurrentScene] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);
  const logoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaVideoRef = useRef(null);

  const selectedPhotos = useMemo(() => photos.filter((photo) => selectedIds.includes(photo.id)), [selectedIds, photos]);
  const activePhoto = selectedPhotos[currentScene] || selectedPhotos[0];

  const updateVehicle = (key, value) => setVehicle((previous) => ({ ...previous, [key]: value }));
  const getScene = useCallback((photo, index, count) => scenes[photo?.id] || makeSceneLines(vehicle, index, count), [scenes, vehicle]);

  const importListing = async () => {
    let url;
    try {
      url = new URL(listingUrl.trim());
      if (url.protocol !== "https:" || !["www.bobaedream.co.kr", "bobaedream.co.kr"].includes(url.hostname)) {
        throw new Error("보배드림 매물 링크를 입력해 주세요.");
      }
      if (!url.pathname.startsWith("/cyber/CyberCar_view.php")) throw new Error("보배드림 사이버매장 상세 링크를 입력해 주세요.");
    } catch (error) {
      setNotice(error.message || "올바른 매물 URL을 입력해 주세요.");
      return;
    }

    setListingLoading(true);
    try {
      const listingResponse = await fetch(`${LISTING_API}/listing?url=${encodeURIComponent(url.href)}`);
      const listing = await listingResponse.json();
      if (!listingResponse.ok) throw new Error(listing.error || "매물 정보를 가져오지 못했습니다.");
      setVehicle((previous) => ({ ...previous, ...listing.vehicle, currency: "KRW · ₩" }));

      const remaining = Math.max(0, MAX_PHOTOS - photos.length);
      const photoUrls = (listing.photos || []).slice(0, Math.min(remaining, MAX_PHOTOS));
      const results = await Promise.allSettled(photoUrls.map(async (photoUrl, index) => {
        const response = await fetch(`${LISTING_API}/photo?url=${encodeURIComponent(photoUrl)}`);
        if (!response.ok) throw new Error("차량 사진을 가져오지 못했습니다.");
        const blob = await response.blob();
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
        return new File([blob], `보배드림-${listing.id}-${String(index + 1).padStart(2, "0")}.${extension}`, { type: blob.type || "image/jpeg" });
      }));
      const imageFiles = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      if (imageFiles.length) addPhotos(imageFiles);
      const failed = results.length - imageFiles.length;
      setNotice(imageFiles.length
        ? `차량 정보와 사진 ${imageFiles.length}장을 가져왔습니다.${failed ? ` 사진 ${failed}장은 불러오지 못했습니다.` : ""} 영상에 사용할 사진 5장을 확인해 주세요.`
        : `${listing.title || "차량 정보"}를 가져왔습니다. 사진은 불러오지 못해 직접 업로드해 주세요.`);
    } catch (error) {
      setNotice(error.message || "매물 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setListingLoading(false);
    }
  };

  const addPhotos = (files) => {
    const available = MAX_PHOTOS - photos.length;
    const accepted = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, available);
    if (!accepted.length) {
      setNotice(photos.length >= MAX_PHOTOS ? "사진은 최대 20장까지 추가할 수 있습니다." : "JPG, PNG 또는 WebP 사진을 선택해 주세요.");
      return;
    }
    const added = accepted.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), name: file.name }));
    setPhotos((previous) => [...previous, ...added]);
    setSelectedIds((previous) => [...previous, ...added.map((photo) => photo.id)].slice(0, MAX_SELECTED));
    setCurrentScene(0);
    setVideoUrl("");
    setNotice(accepted.length < files.length ? `최대 ${MAX_PHOTOS}장까지 등록되어 ${accepted.length}장을 추가했습니다.` : "사진을 추가했습니다. 영상에 넣을 사진을 선택해 주세요.");
  };

  const removePhoto = (id) => {
    setPhotos((previous) => {
      const photo = previous.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return previous.filter((item) => item.id !== id);
    });
    setSelectedIds((previous) => previous.filter((item) => item !== id));
    setScenes((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setVideoUrl("");
    setCurrentScene(0);
  };

  const togglePhoto = (id) => {
    setVideoUrl("");
    setSelectedIds((previous) => {
      if (previous.includes(id)) return previous.filter((item) => item !== id);
      if (previous.length >= MAX_SELECTED) {
        setNotice(`영상에는 사진을 최대 ${MAX_SELECTED}장까지 넣을 수 있습니다.`);
        return previous;
      }
      return [...previous, id];
    });
  };

  const movePhoto = (id, direction) => {
    setPhotos((previous) => {
      const index = previous.findIndex((photo) => photo.id === id);
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setVideoUrl("");
  };

  const generateCaptions = () => {
    setScenes((previous) => {
      const next = { ...previous };
      selectedPhotos.forEach((photo, index) => { next[photo.id] = makeSceneLines(vehicle, index, selectedPhotos.length); });
      return next;
    });
    setNotice("장면 문구를 차량 정보에 맞춰 채웠습니다. 각 문구는 직접 수정할 수 있습니다.");
  };

  const updateScene = (photoId, key, value, sceneIndex) => {
    setScenes((previous) => ({ ...previous, [photoId]: { ...(previous[photoId] || makeSceneLines(vehicle, sceneIndex, selectedPhotos.length)), [key]: value } }));
    setVideoUrl("");
  };

  useEffect(() => {
    let cancelled = false;
    let frameId;
    let startedAt = 0;
    const paint = async () => {
      if (!activePhoto || !canvasRef.current) return;
      const image = await loadImage(activePhoto.url).catch(() => null);
      const logoImage = logo?.url ? await loadImage(logo.url).catch(() => null) : null;
      if (cancelled || !image) return;
      const run = (now) => {
        if (cancelled) return;
        if (!startedAt) startedAt = now;
        const progress = playing ? ((now - startedAt) % 3600) / 3600 : 0.18;
        drawFrame(canvasRef.current, image, getScene(activePhoto, currentScene, selectedPhotos.length), vehicle, theme, progress, currentScene, selectedPhotos.length, showPrice, logoImage);
        if (playing) frameId = requestAnimationFrame(run);
      };
      frameId = requestAnimationFrame(run);
    };
    if (!videoUrl) paint();
    return () => { cancelled = true; cancelAnimationFrame(frameId); };
  }, [activePhoto, currentScene, selectedPhotos.length, scenes, vehicle, theme, showPrice, logo, playing, videoUrl, getScene]);

  useEffect(() => {
    if (!playing || selectedPhotos.length < 2) return undefined;
    const timer = window.setInterval(() => setCurrentScene((index) => (index + 1) % selectedPhotos.length), 3600);
    return () => window.clearInterval(timer);
  }, [playing, selectedPhotos.length]);

  useEffect(() => () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    if (logo?.url) URL.revokeObjectURL(logo.url);
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, []);

  const setLogoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      setNotice("로고는 5MB 이하의 이미지 파일을 선택해 주세요.");
      return;
    }
    setLogo((previous) => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return { file, url: URL.createObjectURL(file) };
    });
  };

  const createVideo = async () => {
    if (selectedPhotos.length !== MAX_SELECTED) {
      setNotice("영상에 사용할 사진을 정확히 5장 선택해 주세요.");
      return;
    }
    if (credits < 1) {
      setNotice("사용 가능한 크레딧이 없습니다.");
      return;
    }
    if (!canvasRef.current?.captureStream || !window.MediaRecorder) {
      setNotice("현재 브라우저는 영상 내보내기를 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari를 사용해 주세요.");
      return;
    }
    setIsRendering(true);
    setRenderProgress(0);
    setVideoUrl("");
    setPlaying(false);
    const canvas = canvasRef.current;
    let scenesToRender;
    let logoImage;
    try {
      scenesToRender = await Promise.all(selectedPhotos.map(async (photo, index) => ({
        photo,
        image: await loadImage(photo.url),
        scene: getScene(photo, index, selectedPhotos.length),
      })));
      if (scenesToRender.length !== MAX_SELECTED || scenesToRender.some((scene) => !scene?.image)) {
        throw new Error("The selected photos could not be prepared for rendering.");
      }
      logoImage = logo?.url ? await loadImage(logo.url).catch(() => null) : null;
    } catch {
      setIsRendering(false);
      setNotice("사진을 읽을 수 없습니다. 다른 JPG, PNG 또는 WebP 파일로 다시 시도해 주세요.");
      return;
    }
    const mimeCandidates = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
    const stream = canvas.captureStream(30);
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setIsRendering(false);
      setNotice("이 브라우저의 영상 인코더를 사용할 수 없습니다.");
      return;
    }
    const chunks = [];
    let renderFailed = false;
    const durationPerScene = 3200;
    const totalDuration = durationPerScene * scenesToRender.length;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => {
      renderFailed = true;
      stream.getTracks().forEach((track) => track.stop());
      setIsRendering(false);
      setNotice("영상 생성 중 오류가 발생했습니다. 사진 수를 줄여 다시 시도해 주세요.");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (renderFailed) {
        setIsRendering(false);
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setVideoType(blob.type.includes("mp4") ? "mp4" : "webm");
      setCredits((value) => Math.max(0, value - 1));
      setIsRendering(false);
      setRenderProgress(100);
      setNotice("영상이 완성됐습니다. 미리보기 후 내려받을 수 있습니다.");
    };
    recorder.start(250);
    const start = performance.now();
    const render = (now) => {
      const elapsed = now - start;
      const globalProgress = Math.min(elapsed / totalDuration, 1);
      const sceneIndex = Math.max(0, Math.min(Math.floor(elapsed / durationPerScene), scenesToRender.length - 1));
      const sceneProgress = (elapsed % durationPerScene) / durationPerScene;
      const current = scenesToRender[sceneIndex] || scenesToRender.at(-1);
      if (!current?.image) {
        renderFailed = true;
        setNotice("영상 장면을 준비하지 못했습니다. 사진 5장을 다시 선택해 주세요.");
        try { recorder.stop(); } catch { stream.getTracks().forEach((track) => track.stop()); setIsRendering(false); }
        return;
      }
      try {
        drawFrame(canvas, current.image, current.scene, vehicle, theme, sceneProgress, sceneIndex, scenesToRender.length, showPrice, logoImage);
      } catch {
        renderFailed = true;
        setNotice("영상 장면을 그리는 중 오류가 발생했습니다. 사진을 다시 선택해 주세요.");
        try { recorder.stop(); } catch { stream.getTracks().forEach((track) => track.stop()); setIsRendering(false); }
        return;
      }
      setRenderProgress(Math.round(globalProgress * 100));
      if (elapsed >= totalDuration) {
        const finalScene = scenesToRender.at(-1);
        if (!finalScene?.image) {
          renderFailed = true;
          setNotice("마지막 장면을 준비하지 못했습니다. 다시 제작해 주세요.");
          try { recorder.stop(); } catch { stream.getTracks().forEach((track) => track.stop()); setIsRendering(false); }
          return;
        }
        drawFrame(canvas, finalScene.image, finalScene.scene, vehicle, theme, 1, scenesToRender.length - 1, scenesToRender.length, showPrice, logoImage);
        recorder.stop();
        return;
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const anchor = document.createElement("a");
    anchor.href = videoUrl;
    anchor.download = `${[vehicle.make, vehicle.model].filter(Boolean).join("-") || "차량-숏폼"}.${videoType || "webm"}`;
    anchor.click();
  };

  const photoSelectLabel = selectedPhotos.length ? `${selectedPhotos.length}장 선택` : "선택된 사진 없음";
  const hasVehicle = Boolean(vehicle.make.trim() && vehicle.model.trim() && vehicle.year.trim());
  const canCreate = hasVehicle && selectedPhotos.length === MAX_SELECTED && credits > 0 && !isRendering;

  return (
    <div className="app-shell">
      <nav className="app-sidebar" aria-label="작업 공간 메뉴">
        <a className="sidebar-brand" href="#top"><span className="sidebar-brand-dot" />오토대시<span>.</span></a>
        <p className="sidebar-label">작업 공간</p>
        <a className="sidebar-link" href="#vehicle-title"><span>▦</span> 차량</a>
        <a className="sidebar-link selected" href="#photos-title"><span>＋</span> 새 차량</a>
        <div className="sidebar-credit"><small>크레딧</small><strong>{credits}</strong><button type="button" onClick={() => setNotice("크레딧 결제는 연결되어 있지 않습니다. 영상 제작은 브라우저에서 진행됩니다.")}>구입하기</button></div>
        <a className="sidebar-help" href="#guide">?　도움말</a>
      </nav>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="AutoDash 홈">
          <span>AutoDash</span>
        </a>
        <div className="topbar-note">크레딧　<strong>{credits}</strong></div>
        <button className="language-button" type="button">한국어</button><span className="avatar-dot">●</span>
      </header>

      <main className="workspace" id="top">
        <section className="editor-column">
          <div className="intro-row">
            <div>
              <a className="back-link" href="#vehicle-title">← 차량 목록으로 돌아가기</a>
              <p className="eyebrow">새 영상</p>
              <h1>{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "차량 영상"}</h1>
              <p className="intro-copy">사진을 추가하고, 스타일을 선택하고, 나만의 영상을 만들어 보세요.</p>
            </div>
            <span className="saved-status"><i /> 변경 사항은 현재 브라우저에서 처리됩니다.</span>
          </div>

          <div className="welcome-banner">환영합니다! 5크레딧이 주어졌습니다. 1크레딧으로 영상 하나를 완성할 수 있습니다.</div>

          <section className="section-block start-block" aria-labelledby="start-title">
            <div className="section-heading"><div><span className="section-number">01</span><div><h2 id="start-title">시작하는 방법</h2><p>목록에서 가져오거나 모든 정보를 직접 입력하세요.</p></div></div></div>
            <div className="start-options">
              <button className={startMode === "listing" ? "active" : ""} onClick={() => setStartMode("listing")}>목록 링크</button>
              <button className={startMode === "manual" ? "active" : ""} onClick={() => setStartMode("manual")}>수동으로 입력하세요</button>
            </div>
            {startMode === "listing" ? <div className="listing-import"><p>보배드림 사이버매장 매물 링크를 붙여넣으면 차량 정보와 사진을 가져옵니다.</p><div><input aria-label="차량 매물 링크" value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") importListing(); }} placeholder="https://www.bobaedream.co.kr/cyber/CyberCar_view.php?..."/><button className="outline-button compact" onClick={importListing} disabled={!listingUrl.trim() || listingLoading}>{listingLoading ? <><LoaderCircle className="spin" size={15} /> 가져오는 중</> : "정보 불러오기"}</button></div></div> : <p className="start-hint">세부 정보를 입력한 후 사진을 업로드하세요.</p>}
          </section>

          <section className="section-block vehicle-block" aria-labelledby="vehicle-title">
            <div className="section-heading">
              <div><span className="section-number">02</span><div><h2 id="vehicle-title">차량 상세 정보</h2><p>영상에 표시할 정보입니다.</p></div></div>
              <button className="text-action" onClick={() => setVehicle(emptyVehicle)}><RotateCcw size={15} /> 초기화</button>
            </div>
            <div className="vehicle-grid">
              <Field label="제조사" value={vehicle.make} onChange={(value) => updateVehicle("make", value)} placeholder="예: BMW" />
              <Field label="모델" value={vehicle.model} onChange={(value) => updateVehicle("model", value)} placeholder="예: X4" />
              <Field label="세부 트림" value={vehicle.trim} onChange={(value) => updateVehicle("trim", value)} placeholder="예: xDrive20i M 스포츠" />
              <Field label="연식" value={vehicle.year} onChange={(value) => updateVehicle("year", value)} placeholder="예: 2022" suffix="년식" />
              <Field label="주행거리" value={vehicle.mileage} onChange={(value) => updateVehicle("mileage", value)} placeholder="예: 32,000" suffix="km" />
              <Field label="가격" value={vehicle.price} onChange={(value) => updateVehicle("price", value)} placeholder="가격" />
              <label className="field"><span>통화</span><div className="input-wrap"><select value={vehicle.currency} onChange={(event) => updateVehicle("currency", event.target.value)}>{["EUR · €", "KRW · ₩", "USD · $", "GBP · £", "JPY · ¥"].map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></div></label>
              <label className="field"><span>연료</span><div className="input-wrap"><select value={vehicle.fuel} onChange={(event) => updateVehicle("fuel", event.target.value)}><option value="">선택</option><option>가솔린</option><option>디젤</option><option>하이브리드</option><option>전기</option><option>LPG</option></select><ChevronDown size={15} /></div></label>
              <label className="field"><span>변속기</span><div className="input-wrap"><select value={vehicle.transmission} onChange={(event) => updateVehicle("transmission", event.target.value)}><option value="">선택</option><option>자동</option><option>수동</option><option>CVT</option></select><ChevronDown size={15} /></div></label>
              <Field label="차량 색상" value={vehicle.color} onChange={(value) => updateVehicle("color", value)} placeholder="예: 사파이어 블랙" />
              <Field label="판매처 이름" value={vehicle.dealer} onChange={(value) => updateVehicle("dealer", value)} placeholder="영상에 표시할 상호" />
            </div>
            <div className="logo-row">
              <div className="logo-copy"><span className="logo-title">딜러 로고 <small>(선택 사항)</small></span><span className="muted">PNG, JPEG 또는 WebP 형식 · 최대 5MB</span></div>
              <div className="logo-control">
                {logo ? <><img src={logo.url} alt="업로드한 판매처 로고" /><span className="filename">{logo.file.name}</span><button className="icon-button small" aria-label="로고 삭제" onClick={() => { URL.revokeObjectURL(logo.url); setLogo(null); }}><X size={15} /></button></> : <button className="outline-button compact" onClick={() => logoRef.current?.click()}><ImagePlus size={16} /> 로고 추가</button>}
                <input ref={logoRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogoFile(event.target.files?.[0])} />
              </div>
            </div>
          </section>

          <section className="section-block photo-block" aria-labelledby="photos-title">
            <div className="section-heading">
              <div><span className="section-number">03</span><div><h2 id="photos-title">차량 사진</h2><p>최대 20장을 올리고 영상에 사용할 사진 5장을 선택하세요.</p></div></div>
              <span className="count-pill">{photoSelectLabel}</span>
            </div>
            <input ref={inputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => { addPhotos(event.target.files || []); event.target.value = ""; }} />
            {photos.length === 0 ? (
                  <button className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addPhotos(event.dataTransfer.files); }}>
                <span className="upload-icon"><Upload size={21} /></span>
                <strong>차량 사진을 여기에 놓거나 선택하세요</strong>
                <span>JPG · PNG · WebP · HEIC · 최대 20장</span>
                <span className="upload-cta">사진 선택</span>
              </button>
            ) : (
              <>
                <div className="photo-toolbar"><span>{photos.length}장 등록됨 <i /> 영상 선택 {selectedPhotos.length}/{MAX_SELECTED}</span><button className="outline-button compact" onClick={() => inputRef.current?.click()} disabled={photos.length >= MAX_PHOTOS}><Plus size={15} /> 사진 추가</button></div>
                <div className="photo-grid">
                  {photos.map((photo, index) => {
                    const checked = selectedIds.includes(photo.id);
                    return <div className={`photo-card ${checked ? "chosen" : ""}`} key={photo.id}>
                      <button className="photo-thumb" onClick={() => togglePhoto(photo.id)} aria-pressed={checked} aria-label={`${photo.name} ${checked ? "선택 해제" : "영상에 선택"}`}><img src={photo.url} alt={photo.name} /><span className="selection-check">{checked ? <Check size={14} /> : index + 1}</span></button>
                      <div className="photo-meta"><span title={photo.name}>{photo.name}</span><div><button className="mini-icon" title="앞으로" disabled={index === 0} onClick={() => movePhoto(photo.id, -1)}><ArrowLeft size={13} /></button><button className="mini-icon" title="뒤로" disabled={index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)}><ArrowRight size={13} /></button><button className="mini-icon danger" title="사진 삭제" onClick={() => removePhoto(photo.id)}><Trash2 size={13} /></button></div></div>
                    </div>;
                  })}
                  {photos.length < MAX_PHOTOS && <button className="add-photo-tile" onClick={() => inputRef.current?.click()}><Plus size={22} /><span>사진 추가</span></button>}
                </div>
              </>
            )}
          </section>

          <section className="section-block style-block" aria-labelledby="styles-title">
            <div className="section-heading">
              <div><span className="section-number">04</span><div><h2 id="styles-title">영상 스타일</h2><p>차량 분위기에 어울리는 디자인을 선택하세요.</p></div></div>
            </div>
            <div className="style-grid">
              {Object.entries(THEMES).map(([key, value], index) => <button type="button" className={`style-card ${theme === key ? "selected" : ""}`} key={key} onClick={() => { setTheme(key); setVideoUrl(""); }} aria-pressed={theme === key}>
                <span className={`style-art style-art-${index + 1}`} style={{ "--style-accent": value.accent }}><i /><i /><i /></span><strong>{value.label}</strong><small>{index < 3 ? "프리미엄" : index < 7 ? "다이내믹" : "클래식"}</small>
              </button>)}
            </div>
          </section>

          <section className="section-block caption-block" aria-labelledby="captions-title">
            <div className="section-heading caption-heading">
              <div><span className="section-number">05</span><div><h2 id="captions-title">장면 문구 검토</h2><p>자동 작성한 문구를 확인하고 원하는 내용으로 수정하세요.</p></div></div>
              <button className="outline-button compact" onClick={generateCaptions} disabled={!selectedPhotos.length}><Sparkles size={15} /> 문구 채우기</button>
            </div>
            {selectedPhotos.length ? <div className="scene-list">
              {selectedPhotos.map((photo, index) => {
                const scene = getScene(photo, index, selectedPhotos.length);
                return <article className={`scene-row ${currentScene === index ? "scene-active" : ""}`} key={photo.id}>
                  <button className="scene-photo" onClick={() => { setCurrentScene(index); setVideoUrl(""); }} aria-label={`${index + 1}번 장면 미리보기`}><img src={photo.url} alt="" /><span>{String(index + 1).padStart(2, "0")}</span></button>
                  <div className="scene-fields">
                    <div className="scene-label"><span>장면 {index + 1}</span><small>{index * 3}–{(index + 1) * 3}초</small></div>
                    <input aria-label={`${index + 1}번 장면 제목`} value={scene.title} maxLength={40} onChange={(event) => updateScene(photo.id, "title", event.target.value, index)} placeholder="장면 제목" />
                    <input aria-label={`${index + 1}번 장면 설명`} value={scene.detail} maxLength={60} onChange={(event) => updateScene(photo.id, "detail", event.target.value, index)} placeholder="짧은 설명" />
                  </div>
                </article>;
              })}
            </div> : <div className="empty-scenes"><FileImage size={20} /><span>사진을 선택하면 장면 문구를 편집할 수 있습니다.</span></div>}
          </section>
          <div className="privacy-note"><Info size={16} /><span>사진과 차량 정보는 이 브라우저에서 영상으로 처리됩니다. 서버에 업로드하지 않습니다. 생성 영상에는 음성이나 배경 음악이 포함되지 않습니다.</span></div>
        </section>

        <aside className="preview-column" aria-label="영상 설정 요약">
          <div className="summary-card">
            <p className="eyebrow">당신의 영상</p><h2>{canCreate ? "영상 제작을 시작하세요" : "설정을 완료하세요"}</h2>
            <p className="summary-cost">영상당 1크레딧 · 잔액: {credits}크레딧</p>
            <div className="summary-checks">
              <div className={hasVehicle ? "done" : ""}><i>{hasVehicle ? "✓" : "1"}</i> 차량 상세 정보</div>
              <div className={selectedPhotos.length === MAX_SELECTED ? "done" : ""}><i>{selectedPhotos.length === MAX_SELECTED ? "✓" : "2"}</i> 사진 5장 중 {selectedPhotos.length}장</div>
              <div className="done"><i>✓</i> {THEMES[theme].label}</div>
              <div className={selectedPhotos.length ? "done" : ""}><i>{selectedPhotos.length ? "✓" : "4"}</i> 장면 문구</div>
            </div>
            {isRendering && <div className="rendering-panel"><div className="rendering-label"><span><LoaderCircle className="spin" size={16} /> 영상 만드는 중</span><b>{renderProgress}%</b></div><div className="progress-track"><i style={{ width: `${renderProgress}%` }} /></div><small>이 탭을 열어 두세요. 사진 수에 따라 잠시 걸릴 수 있습니다.</small></div>}
            {videoUrl && <button className="download-button" onClick={downloadVideo}><Download size={17} /> 영상 내려받기 <span>{videoType.toUpperCase()}</span></button>}
            <button className="create-button" onClick={createVideo} disabled={!canCreate}>{isRendering ? <><LoaderCircle className="spin" size={18} /> 영상 제작 중</> : <><Clapperboard size={18} /> {videoUrl ? "다시 만들기" : credits < 1 ? "크레딧이 부족합니다." : canCreate ? "영상 제작" : "필수 입력란을 모두 작성하세요."}</>}</button>
            <p className="export-hint"><VolumeX size={14} /> 무음 영상 · {videoType ? `${videoType.toUpperCase()} 파일` : "브라우저 지원 형식으로 저장"}</p>
          </div>
          <div className="preview-head"><div><p className="eyebrow">LIVE PREVIEW</p><h2>영상 미리보기</h2></div><span className="ratio-badge">9:16</span></div>
          <div className="preview-frame"><div className="phone-screen">
            {videoUrl ? <video ref={mediaVideoRef} src={videoUrl} controls playsInline className="result-video" onPlay={() => setPlaying(false)} /> : <canvas ref={canvasRef} width="540" height="960" aria-label="선택한 사진으로 구성한 세로 영상 미리보기" />}
            {!selectedPhotos.length && !videoUrl && <div className="preview-empty"><span className="preview-empty-mark"><FileImage size={25} /></span><strong>사진을 추가하면<br />미리보기가 시작됩니다</strong><span>9:16 세로 영상</span></div>}
            {selectedPhotos.length > 0 && !videoUrl && <div className="preview-controls"><button className="play-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "미리보기 멈춤" : "미리보기 재생"}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><div className="preview-dots">{selectedPhotos.map((photo, index) => <button className={index === currentScene ? "on" : ""} key={photo.id} aria-label={`${index + 1}번 장면`} onClick={() => { setCurrentScene(index); setVideoUrl(""); }} />)}</div><span>0:{String((currentScene + 1) * 3).padStart(2, "0")}</span></div>}
          </div></div>
          <div className="preview-caption"><span className="preview-caption-dot" />{selectedPhotos.length ? `${selectedPhotos.length}개 장면 · 약 ${Math.round(selectedPhotos.length * 3.2)}초` : "사진을 올려 제작을 시작하세요"}</div>
          <label className="switch-row"><span><strong>판매 가격 표시</strong><small>영상 하단에 가격을 표시합니다.</small></span><input type="checkbox" checked={showPrice} onChange={(event) => { setShowPrice(event.target.checked); setVideoUrl(""); }} /><i /></label>
          <div className="help-panel" id="guide"><strong>사용 안내</strong><ol><li>차량 정보를 입력하세요.</li><li>사진 5장을 선택하고 순서를 조정하세요.</li><li>스타일과 문구를 확인한 뒤 영상을 제작하세요.</li></ol></div>
        </aside>
      </main>

      <footer className="site-footer"><span>AutoDash</span><span>사진과 차량 정보는 이 브라우저에서 처리됩니다.</span></footer>
      {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="알림 닫기"><X size={15} /></button></div>}
    </div>
  );
}

