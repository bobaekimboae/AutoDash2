<?php
declare(strict_types=1);

const AUTODASH_ALLOWED_ORIGIN = 'https://bobaekimboae.github.io';

function send_cors_headers(): void {
    $origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === AUTODASH_ALLOWED_ORIGIN) {
        header('Access-Control-Allow-Origin: ' . AUTODASH_ALLOWED_ORIGIN);
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 86400');
    header('X-Content-Type-Options: nosniff');
}

function send_json(int $status, array $data): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fetch_remote(string $url, int $maxBytes, string $accept): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_MAXFILESIZE => $maxBytes,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; AutoDash2ListingImporter/1.0)',
        CURLOPT_HTTPHEADER => ['Accept: ' . $accept, 'Accept-Language: ko-KR,ko;q=0.9'],
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($ch);
    $error = curl_errno($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $type = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    curl_close($ch);
    if ($body === false || $error !== 0 || strlen($body) > $maxBytes) {
        return ['status' => 0, 'content_type' => '', 'body' => ''];
    }
    return ['status' => $status, 'content_type' => $type, 'body' => $body];
}

