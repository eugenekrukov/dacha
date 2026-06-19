<?php
// nalog-relay.php — ретранслятор запросов «Мой налог» для бэкенда Dacha (Hetzner → RU-хостинг → ФНС).
// Кладётся в public_html на российском хостинге (там, где исходящий доступ к lknpd.nalog.ru открыт).
// Бэкенд Dacha шлёт сюда POST с заголовками:
//   X-Relay-Secret: <секрет>   — защита от чужих запросов (см. NALOG_RELAY_SECRET на сервере Dacha)
//   X-Relay-Path:   /income    — путь в API ФНС (база https://lknpd.nalog.ru/api/v1 — хардкодом)
//   Authorization:  Bearer ... — проброс токена ФНС (если есть)
// Тело (raw JSON) форвардится в ФНС как есть; ответ ФНС возвращается дословно (HTTP-код + тело).
//
// Настройка: задай секрет в переменной окружения NALOG_RELAY_SECRET ЛИБО впиши в $RELAY_SECRET ниже.
// Тот же секрет пропиши в NALOG_RELAY_SECRET на сервере Dacha. Опционально ограничь по IP Hetzner.

declare(strict_types=1);

$RELAY_SECRET = getenv('NALOG_RELAY_SECRET') ?: '__ЗАМЕНИ_НА_ДЛИННЫЙ_СЛУЧАЙНЫЙ_СЕКРЕТ__';
$ALLOWED_IP   = getenv('NALOG_RELAY_ALLOW_IP') ?: ''; // напр. 78.47.58.211; пусто = IP не проверять
$API_BASE     = 'https://lknpd.nalog.ru/api/v1';
$TIMEOUT      = 60;

function fail(int $code, string $msg): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['relayError' => $msg], JSON_UNESCAPED_UNICODE);
  exit;
}

// Только POST (бэкенд всегда шлёт POST).
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail(405, 'method not allowed');

// Опциональный IP-allowlist (защита в дополнение к секрету).
if ($ALLOWED_IP !== '' && ($_SERVER['REMOTE_ADDR'] ?? '') !== $ALLOWED_IP) fail(403, 'ip not allowed');

// Секрет (сравнение в постоянное время).
$gotSecret = $_SERVER['HTTP_X_RELAY_SECRET'] ?? '';
if ($RELAY_SECRET === '' || $RELAY_SECRET === '__ЗАМЕНИ_НА_ДЛИННЫЙ_СЛУЧАЙНЫЙ_СЕКРЕТ__'
    || !hash_equals($RELAY_SECRET, $gotSecret)) {
  fail(403, 'bad secret');
}

// Путь ФНС: только безопасный относительный путь (без схемы/хоста/обхода).
$path = $_SERVER['HTTP_X_RELAY_PATH'] ?? '';
if ($path === '' || $path[0] !== '/' || strpos($path, '..') !== false || strpos($path, '//') !== false
    || !preg_match('#^/[A-Za-z0-9/_-]+$#', $path)) {
  fail(400, 'bad path');
}

$body = file_get_contents('php://input');
if ($body === false) $body = '';

// Проброс Authorization (Apache иногда прячет его в REDIRECT_*).
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');

$headers = ['Content-Type: application/json', 'Accept: application/json'];
if ($auth !== '') $headers[] = 'Authorization: ' . $auth;

$ch = curl_init($API_BASE . $path);
curl_setopt_array($ch, [
  CURLOPT_POST           => true,
  CURLOPT_POSTFIELDS     => $body,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT        => $TIMEOUT,
  CURLOPT_CONNECTTIMEOUT => 15,
]);
$resp = curl_exec($ch);
if ($resp === false) {
  $err = curl_error($ch);
  curl_close($ch);
  fail(502, 'upstream error: ' . $err);
}
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Возвращаем код и тело ФНС дословно — для бэкенда релей прозрачен (вкл. 401 → авто-рефреш токена).
http_response_code($code ?: 502);
header('Content-Type: application/json; charset=utf-8');
echo $resp;
