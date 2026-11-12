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
if (($parts['scheme'] ?? '') !== 'https'
    || !preg_match('/^file\d*\.bobaedream\.co\.kr$/', $host)
    || !preg_match('~^/pds/CyberCar/\d+/(\d{4,10})/img_\1_\d+\.(?:jpg|jpeg|png|webp)$~i', $path)
    || isset($parts['user']) || isset($parts['pass']) || isset($parts['port'])) {
    send_json(400, ['error' => '보배드림 차량 사진 주소만 가져올 수 있습니다.']);
}

$photo = fetch_remote($rawUrl, 15_000_000, 'image/jpeg,image/png,image/webp');
if ($photo['status'] !== 200 || !preg_match('~^image/(jpeg|png|webp)(?:;|$)~i', $photo['content_type'])) {
    send_json(502, ['error' => '보배드림 차량 사진을 가져오지 못했습니다.']);
}
header('Content-Type: ' . $photo['content_type']);
header('Cache-Control: private, max-age=300');
header('Content-Length: ' . strlen($photo['body']));
echo $photo['body'];

