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

/* ── Load API key ── */
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

/* ── Normalize slug ── */
function makeSlug($name) {
    $s = strtolower(trim($name));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'course-' . time();
}
$slug = makeSlug($input['courseName']);

/* ── Save base64 image ── */
function saveImage($dataUri, $basePath, $baseUrl) {
    if (empty($dataUri)) return '';
    if (!preg_match('/^data:image\/(\w+);base64,(.+)$/s', $dataUri, $m)) return '';
    $ext  = ($m[1] === 'jpeg') ? 'jpg' : strtolower($m[1]);
    $ext  = in_array($ext, ['jpg','png','gif','webp']) ? $ext : 'jpg';
    $file = basename($basePath) . '.' . $ext;
    file_put_contents($basePath . '.' . $ext, base64_decode($m[2]));
    return $baseUrl . '/' . $file;
}

/* ── Save images now (keeps base64 out of job file) ── */
$assetsDir = __DIR__ . '/pages/assets/' . $slug;
$assetsUrl = 'https://coursyland.com/pages/assets/' . $slug;
if (!is_dir($assetsDir)) mkdir($assetsDir, 0755, true);

$images  = $input['images'] ?? [];
$imgUrls = ['instructor' => '', 'atmosphere' => [], 'lessons' => []];

if (!empty($images['instructor']))
    $imgUrls['instructor'] = saveImage($images['instructor'], $assetsDir . '/instructor', $assetsUrl);

foreach (($images['atmosphere'] ?? []) as $i => $b64) {
    $u = saveImage($b64, $assetsDir . '/atmosphere-' . ($i+1), $assetsUrl);
    if ($u) $imgUrls['atmosphere'][] = $u;
}
foreach (($images['lessons'] ?? []) as $i => $b64) {
    $u = saveImage($b64, $assetsDir . '/lesson-' . ($i+1), $assetsUrl);
    if ($u) $imgUrls['lessons'][] = $u;
}

/* ── Write job file ── */
file_put_contents($jobFile, json_encode([
    'status'     => 'processing',
    'created_at' => time(),
    'slug'       => $slug,
    'courseName' => $input['courseName'],
    'content'    => $input['content'],
    'colors'     => $input['colors'] ?? ['primary' => '#9B30E8', 'accent' => '#F59E0B'],
    'paymentUrl' => $input['paymentUrl'] ?? '',
    'imgUrls'    => $imgUrls,
]));

/* ── Respond to browser immediately ── */
echo json_encode(['job_id' => $jobId, 'status' => 'processing']);

/* ── Spawn process.php as detached background process ── */
$spawned = false;

if (function_exists('proc_open')) {
    /* Find a CLI PHP binary (lsphp is the web SAPI, not suitable for CLI) */
    $phpBin = '';
    foreach (['/opt/alt/php83/usr/bin/php', '/usr/bin/php83', '/usr/bin/php8.3', '/usr/bin/php'] as $c) {
        if (is_executable($c)) { $phpBin = $c; break; }
    }
    if (!$phpBin && is_executable(PHP_BINARY)) $phpBin = PHP_BINARY;

    if ($phpBin) {
        $cmd  = escapeshellcmd($phpBin)
              . ' ' . escapeshellarg(__DIR__ . '/process.php')
              . ' ' . escapeshellarg($jobId)
              . ' > /dev/null 2>&1 &';
        $desc = [0 => ['pipe', 'r'], 1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']];
        $proc = @proc_open('/bin/sh -c ' . escapeshellarg($cmd), $desc, $pipes);
        if (is_resource($proc)) {
            fclose($pipes[0]);
            proc_close($proc); /* returns immediately — child runs in background */
            $spawned = true;
        }
    }
}

/* ── Curl fallback: fire-and-forget HTTP request to process.php ── */
if (!$spawned && function_exists('curl_init')) {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host   = $_SERVER['HTTP_HOST'] ?? 'coursyland.com';
    $ch = curl_init($scheme . '://' . $host . '/process.php?job_id=' . urlencode($jobId));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT_MS     => 500,  /* disconnect after 0.5s; process.php keeps running */
        CURLOPT_NOSIGNAL       => true,
        CURLOPT_FOLLOWLOCATION => false,
    ]);
    @curl_exec($ch);
    curl_close($ch);
}
