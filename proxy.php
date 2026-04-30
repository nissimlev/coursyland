<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input || empty($input['content']) || empty($input['courseName'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'חסרים שדות נדרשים: content ו-courseName']);
    exit;
}

/* ── Validate API key exists before queuing ── */
function loadApiKey() {
    $p = __DIR__ . '/.env';
    if (!file_exists($p)) return '';
    foreach (file($p, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        if (trim($k) === 'ANTHROPIC_API_KEY') return trim($v);
    }
    return '';
}
$apiKey = loadApiKey();
if (empty($apiKey) || $apiKey === 'your_key_here') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'ANTHROPIC_API_KEY לא מוגדר ב-.env']);
    exit;
}

/* ── Create job ── */
$jobsDir = __DIR__ . '/jobs';
if (!is_dir($jobsDir)) mkdir($jobsDir, 0755, true);

$jobId   = bin2hex(random_bytes(16));
$jobFile = $jobsDir . '/' . $jobId . '.json';

file_put_contents($jobFile, json_encode([
    'status'     => 'processing',
    'created_at' => time(),
    'input'      => $input,
]));

/* ── Spawn process.php in background ── */
$script = __DIR__ . '/process.php';
$arg    = escapeshellarg($jobId);

if (function_exists('exec')) {
    $php = PHP_BINARY ?: 'php';
    exec(escapeshellcmd($php) . ' ' . escapeshellarg($script) . ' ' . $arg . ' > /dev/null 2>&1 &');
} else {
    /* Fallback: trigger via HTTP with 1s timeout — process.php keeps running via ignore_user_abort */
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'coursyland.com';
    $ch = curl_init($scheme . '://' . $host . '/process.php?job_id=' . urlencode($jobId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 1,
        CURLOPT_NOSIGNAL       => 1,
    ]);
    @curl_exec($ch);
    curl_close($ch);
}

echo json_encode(['job_id' => $jobId, 'status' => 'processing']);
