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

set_time_limit(300);

/* Send a single space immediately so LiteSpeed doesn't timeout waiting
   for the first byte during the long Anthropic API call (~90s).
   A leading space is valid JSON whitespace per RFC 8259. */
while (ob_get_level()) @ob_end_flush();
echo ' ';
flush();

$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input || empty($input['content']) || empty($input['courseName'])) {
    http_response_code(400);
    echo json_encode(['error' => 'חסרים שדות נדרשים: content ו-courseName']);
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
    echo json_encode(['error' => 'ANTHROPIC_API_KEY לא מוגדר ב-.env']);
    exit;
}

/* ── Helpers ── */
function makeSlug($name) {
    $s = strtolower(trim($name));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    return trim($s, '-') ?: 'course-' . time();
}

function saveImage($dataUri, $basePath, $baseUrl) {
    if (empty($dataUri)) return '';
    if (!preg_match('/^data:image\/(\w+);base64,(.+)$/s', $dataUri, $m)) return '';
    $ext  = ($m[1] === 'jpeg') ? 'jpg' : strtolower($m[1]);
    $ext  = in_array($ext, ['jpg','png','gif','webp']) ? $ext : 'jpg';
    $file = basename($basePath) . '.' . $ext;
    file_put_contents($basePath . '.' . $ext, base64_decode($m[2]));
    return $baseUrl . '/' . $file;
}

/* ── Prepare job ID and slug ── */
$jobsDir = __DIR__ . '/jobs';
if (!is_dir($jobsDir)) mkdir($jobsDir, 0755, true);
$jobId   = bin2hex(random_bytes(16));
$jobFile = $jobsDir . '/' . $jobId . '.json';

$slug = makeSlug($input['courseName']);

/* ── Save images ── */
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

/* ── Build prompt ── */
$colors = $input['colors'] ?? ['primary' => '#9B30E8', 'accent' => '#F59E0B'];
$payUrl = $input['paymentUrl'] ?? '';

$imgSection  = $imgUrls['instructor'] ? "תמונת מנחה: {$imgUrls['instructor']}\n" : '';
foreach ($imgUrls['atmosphere'] as $i => $u) $imgSection .= "תמונת אווירה " . ($i+1) . ": $u\n";
foreach ($imgUrls['lessons']    as $i => $u) $imgSection .= "תמונת שיעור "  . ($i+1) . ": $u\n";

/* ── Load SKILL.md ── */
function loadSkill() {
    $p = __DIR__ . '/admintools/sales-page-builder/SKILL.md';
    if (!file_exists($p)) return '';
    return trim(preg_replace('/^---[\s\S]*?---\s*/m', '', file_get_contents($p)));
}

$systemPrompt = loadSkill() . <<<'EOT'

---

## תמונות — עדכון חשוב

בניגוד לכתוב למעלה, בפריסה זו **יש** תמונות אמיתיות — אל תיצור placeholders.
השתמש ב-URLs שסופקו:
- תמונת מנחה: `<img src="URL">` בעיגול עם border בצבע הראשי
- תמונות אווירה: הצג ברצועה ויזואלית מעוצבת
- תמונות שיעורים: הצג בתוך כרטיס הפרק המתאים
אם לא סופקה תמונה — השתמש ב-placeholder CSS.

---

## כללי צבע — חובה מוחלטת

- רקע הדף (body): לבן #FFFFFF או אפור בהיר — לעולם לא שחור
- טקסט גוף: כהה #1A1330 — לעולם לא לבן על רקע בהיר
- sections כהים מותרים רק עם טקסט לבן מפורש
- אסור: טקסט כהה על רקע כהה, או טקסט בהיר על רקע בהיר

החזר HTML מלא בלבד — בלי הסברים, בלי markdown backticks.
EOT;

$userMessage = "שם הקורס: {$input['courseName']}\n\n"
    . "=== תוכן הדף ===\n{$input['content']}\n\n"
    . "=== עיצוב ===\n"
    . "צבע ראשי: {$colors['primary']}\n"
    . "צבע הדגשה: {$colors['accent']}\n"
    . "URL לתשלום: {$payUrl}\n\n"
    . "=== תמונות ===\n"
    . ($imgSection ?: "לא הועלו תמונות.\n");

/* ── Call Anthropic API (synchronous — browser waits) ── */
$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode([
        'model'      => 'claude-sonnet-4-6',
        'max_tokens' => 64000,
        'system'     => $systemPrompt,
        'messages'   => [['role' => 'user', 'content' => $userMessage]],
    ]),
    CURLOPT_TIMEOUT        => 290,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    file_put_contents($jobFile, json_encode(['status' => 'error', 'error' => 'שגיאת חיבור: ' . $curlErr]));
    echo json_encode(['job_id' => $jobId, 'status' => 'error', 'error' => 'שגיאת חיבור: ' . $curlErr]);
    exit;
}

$apiResp = json_decode($response, true);
if ($httpCode !== 200 || empty($apiResp['content'][0]['text'])) {
    $errMsg = $apiResp['error']['message'] ?? "שגיאה מ-Anthropic (HTTP $httpCode)";
    file_put_contents($jobFile, json_encode(['status' => 'error', 'error' => $errMsg]));
    echo json_encode(['job_id' => $jobId, 'status' => 'error', 'error' => $errMsg]);
    exit;
}

$html = trim($apiResp['content'][0]['text']);
if (preg_match('/^```(?:html)?\s*\n([\s\S]*?)```\s*$/i', $html, $m)) $html = trim($m[1]);

$css  = '<style id="coursyland-safety">body{background:#fff!important;color:#1a1330!important}</style>';
$html = str_replace('</head>', $css . '</head>', $html);

/* ── Save HTML ── */
$pagesDir = __DIR__ . '/pages';
if (!is_dir($pagesDir)) mkdir($pagesDir, 0755, true);

if (file_put_contents($pagesDir . '/' . $slug . '.html', $html) === false) {
    $errMsg = 'לא ניתן לשמור קובץ HTML';
    file_put_contents($jobFile, json_encode(['status' => 'error', 'error' => $errMsg]));
    echo json_encode(['job_id' => $jobId, 'status' => 'error', 'error' => $errMsg]);
    exit;
}

$pageUrl = 'https://coursyland.com/pages/' . $slug . '.html';
file_put_contents($jobFile, json_encode(['status' => 'done', 'url' => $pageUrl]));

/* ── Return result directly — no polling needed ── */
echo json_encode(['job_id' => $jobId, 'status' => 'done', 'url' => $pageUrl]);
