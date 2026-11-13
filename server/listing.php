<?php
declare(strict_types=1);
require_once __DIR__ . '/common.php';

send_cors_headers();
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    send_json(405, ['error' => 'GET 요청만 지원합니다.']);
}

$rawUrl = (string)($_GET['url'] ?? '');
$parts = parse_url($rawUrl);
$host = strtolower((string)($parts['host'] ?? ''));
$path = (string)($parts['path'] ?? '');
$query = [];
parse_str((string)($parts['query'] ?? ''), $query);
$id = (string)($query['no'] ?? '');
if (($parts['scheme'] ?? '') !== 'https'
    || !in_array($host, ['bobaedream.co.kr', 'www.bobaedream.co.kr'], true)
    || $path !== '/cyber/CyberCar_view.php'
    || !preg_match('/^\d{4,10}$/', $id)
    || ($query['gubun'] ?? '') !== 'I'
    || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
    send_json(400, ['error' => '보배드림 수입차 사이버매장 상세 링크만 가져올 수 있습니다.']);
}

$url = 'https://' . $host . $path . '?' . http_build_query(['no' => $id, 'gubun' => 'I']);
$fetched = fetch_remote($url, 12_000_000, 'text/html,application/xhtml+xml');
if ($fetched['status'] !== 200 || !str_contains(strtolower($fetched['content_type']), 'text/html')) {
    send_json(502, ['error' => '보배드림 매물 페이지에서 정보를 가져오지 못했습니다.']);
}
$html = html_entity_decode($fetched['body'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
$plain = preg_replace('~<(script|style)[^>]*>[\s\S]*?</\1>~i', ' ', $html) ?? $html;
$plain = html_entity_decode(strip_tags($plain), ENT_QUOTES | ENT_HTML5, 'UTF-8');
$plain = preg_replace('/\s+/u', ' ', $plain) ?? $plain;

$title = first_match($html, [
    '~<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']~i',
    '~<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title["\']~i',
    '~<title[^>]*>(.*?)</title>~is',
]);
$title = trim(html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
$title = preg_replace('/\s*[|｜].*$/u', '', $title) ?? $title;
$title = preg_replace('/\s*중고차\s*$/u', '', $title) ?? $title;
$vehicle = extract_vehicle($title, $plain, $html);
$photos = extract_photos($html, $id);

if (!$photos) {
    send_json(502, ['error' => '매물 사진 주소를 찾지 못했습니다.']);
}
send_json(200, [
    'id' => $id,
    'url' => $url,
    'title' => $title,
    'vehicle' => $vehicle,
    'photos' => $photos,
]);

function first_match(string $text, array $patterns): string {
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text, $matches)) return trim($matches[1] ?? '');
    }
    return '';
}

function extract_vehicle(string $title, string $plain, string $html): array {
    $vehicle = [
        'make' => '', 'model' => '', 'trim' => '', 'year' => '', 'mileage' => '',
        'price' => '', 'currency' => 'KRW · ₩', 'fuel' => '', 'transmission' => '',
        'color' => '', 'dealer' => '',
    ];
    if (preg_match('/(20\d{2})\s*[.년]\s*(0?[1-9]|1[0-2])\s*(?:월식)?/u', $plain, $m)) {
        $vehicle['year'] = $m[1] . '.' . str_pad($m[2], 2, '0', STR_PAD_LEFT);
    } elseif (preg_match('/(\d{2})년\s*(0?[1-9]|1[0-2])월식/u', $plain, $m)) {
        $vehicle['year'] = '20' . $m[1] . '.' . str_pad($m[2], 2, '0', STR_PAD_LEFT);
    }
    if (preg_match('/([\d,]+)\s*km\b/i', $plain, $m)) $vehicle['mileage'] = $m[1];
    if (preg_match('/([\d,]+)\s*만원/u', $plain, $m)) $vehicle['price'] = $m[1];
    foreach (['가솔린', '디젤', '하이브리드', '전기', 'LPG'] as $fuel) {
        if (mb_strpos($plain, $fuel) !== false) { $vehicle['fuel'] = $fuel; break; }
    }
    foreach (['자동', '수동', 'CVT'] as $transmission) {
        if (mb_strpos($plain, $transmission) !== false) { $vehicle['transmission'] = $transmission; break; }
    }
    // The listing's spec table is authoritative. Searching all page text can miss
    // colors such as 노란색 and can match unrelated copy, so read the labeled cell.
    $vehicle['color'] = extract_table_value($html, '색상');
    if ($vehicle['color'] === '') {
        foreach (['진주색', '노란색', '주황색', '보라색', '초록색', '하늘색', '남색', '검정색', '흰색', '회색', '은색', '청색', '빨간색', '베이지색', '갈색'] as $color) {
            if (mb_strpos($plain, $color) !== false) { $vehicle['color'] = $color; break; }
        }
    }

    $sellerName = first_match($html, [
        '~<div[^>]+class=["\'][^"\']*seller-state[^"\']*["\'][^>]*>[\s\S]*?<dt[^>]*>\s*<b[^>]*>\s*([^<]+?)\s*</b>\s*[^<]*</dt>~i',
        '~<div[^>]+class=["\'][^"\']*seller-state[^"\']*["\'][^>]*>[\s\S]*?<dt[^>]*>\s*([^<]+?)\s*딜러\s*</dt>~i',
    ]);
    $sellerName = trim(html_entity_decode(strip_tags($sellerName), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    if ($sellerName !== '') $vehicle['dealer'] = $sellerName;

    $normalized = preg_replace('/^(?:20\d{2}\s*|\d{2}년\s*)/u', '', $title) ?? $title;
    $normalized = preg_replace('/\s*중고차\s*$/u', '', $normalized) ?? $normalized;
    $normalized = preg_replace('/\s*[-|｜]\s*$/u', '', $normalized) ?? $normalized;
    $brands = ['롤스로이스', '메르세데스-벤츠', '벤츠', '페라리', '람보르기니', '포르쉐', '맥라렌', '애스턴마틴', '마세라티', 'BMW', '아우디', '폭스바겐', '볼보', '렉서스', '토요타', '제네시스', '현대', '기아'];
    foreach ($brands as $brand) {
        if (preg_match('/^' . preg_quote($brand, '/') . '\s+(.+)$/u', $normalized, $m)) {
            $vehicle['make'] = $brand;
            $rest = trim($m[1]);
            if ($brand === '롤스로이스' && preg_match('/^(컬리넌)(?:\s+(.*))?$/u', $rest, $model)) {
                $vehicle['model'] = $model[1];
                $vehicle['trim'] = trim($model[2] ?? '');
            } elseif ($brand === 'BMW' && preg_match('/^(X\d|[0-9]{1,2}\s?시리즈|M\d)(?:\s+(.*))?$/iu', $rest, $model)) {
                $vehicle['model'] = strtoupper(str_replace(' ', '', $model[1]));
                $vehicle['trim'] = trim($model[2] ?? '');
            } elseif ($brand === '페라리' && preg_match('/^(로마|포르토피노|푸로산게|296|488|812|F8|SF90|라페라리)(?:\s+(.*))?$/iu', $rest, $model)) {
                $vehicle['model'] = $model[1];
                $vehicle['trim'] = trim($model[2] ?? '');
            } else {
                $chunks = preg_split('/\s+/u', $rest, 2) ?: [$rest];
                $vehicle['model'] = $chunks[0];
                $vehicle['trim'] = trim($chunks[1] ?? '');
            }
            $vehicle['trim'] = trim(preg_replace('/\s*[-|｜]+\s*$/u', '', $vehicle['trim']) ?? $vehicle['trim']);
            break;
        }
    }
    return $vehicle;
}

function extract_table_value(string $html, string $label): string {
    if (!class_exists(DOMDocument::class)) return '';
    $document = new DOMDocument();
    $previous = libxml_use_internal_errors(true);
    $document->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NOWARNING | LIBXML_NOERROR);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    $xpath = new DOMXPath($document);
    foreach ($xpath->query('//tr') ?: [] as $row) {
        $cells = [];
        foreach ($xpath->query('./th|./td', $row) ?: [] as $cell) {
            $cells[] = trim(preg_replace('/\s+/u', ' ', $cell->textContent) ?? $cell->textContent);
        }
        foreach ($cells as $index => $cellText) {
            if ($cellText === $label && isset($cells[$index + 1])) {
                return trim(preg_replace('/\s+/u', ' ', $cells[$index + 1]) ?? $cells[$index + 1]);
            }
        }
    }
    return '';
}

function extract_photos(string $html, string $id): array {
    $html = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $pattern = '~(?:https?:)?//(file\d*\.bobaedream\.co\.kr)(/pds/CyberCar/\d+/' . preg_quote($id, '~') . '/img_' . preg_quote($id, '~') . '_\d+\.(?:jpg|jpeg|png|webp))(?:\?[^"\'\s<>]*)?~i';
    if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER)) return [];
    $items = [];
    foreach ($matches as $match) $items[$match[2]] = 'https://' . strtolower($match[1]) . $match[2];
    uksort($items, static function (string $a, string $b): int {
        preg_match('/_(\d+)\./', $a, $ma);
        preg_match('/_(\d+)\./', $b, $mb);
        return ((int)($ma[1] ?? 0)) <=> ((int)($mb[1] ?? 0));
    });
    return array_slice(array_values($items), 0, 30);
}

