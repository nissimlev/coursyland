<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);

if (!$input || empty($input['content']) || empty($input['courseName'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'חסרים שדות נדרשים: content ו-courseName']);
    exit;
}

/* ── Load API key from .env ── */
function loadApiKey() {
    $envPath = __DIR__ . '/.env';
    if (!file_exists($envPath)) return '';
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$key, $val] = array_pad(explode('=', $line, 2), 2, '');
        if (trim($key) === 'ANTHROPIC_API_KEY') return trim($val);
    }
    return '';
}

$apiKey = loadApiKey();
if (empty($apiKey) || $apiKey === 'your_key_here') {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'ANTHROPIC_API_KEY לא מוגדר ב-.env']);
    exit;
}

/* ── Normalize slug ── */
function makeSlug($name) {
    $slug = strtolower(trim($name));
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    return $slug ?: 'course-' . time();
}

$slug = makeSlug($input['courseName']);

/* ── Save base64 image to disk, return URL ── */
function saveImage($dataUri, $basePath, $baseUrl) {
    if (empty($dataUri)) return '';
    if (preg_match('/^data:image\/(\w+);base64,(.+)$/s', $dataUri, $m)) {
        $ext = ($m[1] === 'jpeg') ? 'jpg' : strtolower($m[1]);
        $ext = in_array($ext, ['jpg','png','gif','webp']) ? $ext : 'jpg';
        $data = base64_decode($m[2]);
        $filename = basename($basePath) . '.' . $ext;
        file_put_contents($basePath . '.' . $ext, $data);
        return $baseUrl . '/' . $filename;
    }
    return '';
}

/* ── Save images to /pages/assets/[slug]/ ── */
$assetsDir = __DIR__ . '/pages/assets/' . $slug;
$assetsUrl = 'https://coursyland.com/pages/assets/' . $slug;
if (!is_dir($assetsDir)) mkdir($assetsDir, 0755, true);

$images = $input['images'] ?? [];
$imgUrls = ['instructor' => '', 'atmosphere' => [], 'lessons' => []];

if (!empty($images['instructor'])) {
    $imgUrls['instructor'] = saveImage($images['instructor'], $assetsDir . '/instructor', $assetsUrl);
}
foreach (($images['atmosphere'] ?? []) as $i => $b64) {
    $url = saveImage($b64, $assetsDir . '/atmosphere-' . ($i + 1), $assetsUrl);
    if ($url) $imgUrls['atmosphere'][] = $url;
}
foreach (($images['lessons'] ?? []) as $i => $b64) {
    $url = saveImage($b64, $assetsDir . '/lesson-' . ($i + 1), $assetsUrl);
    if ($url) $imgUrls['lessons'][] = $url;
}

/* ── Build prompt ── */
$colors  = $input['colors']     ?? ['primary' => '#9B30E8', 'accent' => '#F59E0B'];
$payUrl  = $input['paymentUrl'] ?? '';

$imgSection  = '';
$imgSection .= $imgUrls['instructor'] ? "תמונת מנחה: {$imgUrls['instructor']}\n" : '';
foreach ($imgUrls['atmosphere'] as $i => $u)
    $imgSection .= "תמונת אווירה " . ($i + 1) . ": $u\n";
foreach ($imgUrls['lessons'] as $i => $u)
    $imgSection .= "תמונת שיעור " . ($i + 1) . ": $u\n";

/* ── Load SKILL.md as system prompt ── */
function loadSkill() {
    $skillPath = __DIR__ . '/admintools/sales-page-builder/SKILL.md';
    if (!file_exists($skillPath)) return '';
    $raw = file_get_contents($skillPath);
    // Strip YAML frontmatter (--- ... ---)
    return trim(preg_replace('/^---[\s\S]*?---\s*/m', '', $raw));
}

$skillContent = loadSkill();

$imageInstructions = <<<'EOT'

---

## תמונות — עדכון חשוב

בניגוד לכתוב למעלה, בפריסה זו **יש** תמונות אמיתיות — אל תיצור placeholders.
השתמש ב-URLs שסופקו:
- תמונת מנחה: `<img src="URL">` בעיגול עם border בצבע הראשי
- תמונות אווירה: הצג ברצועה ויזואלית מעוצבת
- תמונות שיעורים: הצג בתוך כרטיס הפרק המתאים

אם לא סופקה תמונה לחלק מסוים — אז (ורק אז) השתמש ב-placeholder CSS.

---

## כללי צבע — חובה מוחלטת

- רקע הדף (body): לבן #FFFFFF או אפור בהיר — לעולם לא שחור
- טקסט גוף: כהה #1A1330 — לעולם לא לבן על רקע בהיר
- sections כהים (hero, CTA): מותרים רק עם טקסט לבן מפורש
- אסור: טקסט כהה על רקע כהה, או טקסט בהיר על רקע בהיר
- הצבע primary ו-accent הם מהנתונים שסופקו — השתמש בהם לכותרות, כפתורים, הדגשות

החזר HTML מלא בלבד — בלי הסברים, בלי markdown backticks.
EOT;

$systemPrompt = $skillContent . $imageInstructions;

$userMessage = "שם הקורס: {$input['courseName']}\n\n"
    . "=== תוכן הדף (15 חלקים) ===\n{$input['content']}\n\n"
    . "=== עיצוב ===\n"
    . "צבע ראשי: {$colors['primary']}\n"
    . "צבע הדגשה: {$colors['accent']}\n"
    . "URL לתשלום: {$payUrl}\n\n"
    . "=== תמונות ===\n"
    . ($imgSection ?: "לא הועלו תמונות.\n");

/* ── Call Anthropic API ── */
$body = json_encode([
    'model'      => 'claude-sonnet-4-6',
    'max_tokens' => 16000,
    'system'     => $systemPrompt,
    'messages'   => [['role' => 'user', 'content' => $userMessage]]
]);

$ch = curl_init('https://api.anthropic.com/v1/messages');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_TIMEOUT        => 120,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: ' . $apiKey,
        'anthropic-version: 2023-06-01',
    ],
]);

$response  = curl_exec($ch);
$httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr   = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'שגיאת חיבור: ' . $curlErr]);
    exit;
}

$apiResp = json_decode($response, true);

if ($httpCode !== 200 || empty($apiResp['content'][0]['text'])) {
    $errMsg = $apiResp['error']['message'] ?? "שגיאה מ-Anthropic (HTTP $httpCode)";
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $errMsg]);
    exit;
}

$html = trim($apiResp['content'][0]['text']);

/* warn if Claude stopped due to token limit */
if (($apiResp['stop_reason'] ?? '') === 'max_tokens') {
    $html .= "\n<!-- אזהרה: הדף נחתך עקב הגעה לגבול הטוקנים -->";
}

/* strip accidental markdown fences */
if (preg_match('/^```(?:html)?\s*\n([\s\S]*?)```\s*$/i', $html, $m)) {
    $html = trim($m[1]);
}

/* safety CSS — ensures readable text regardless of what Claude generated */
$safetyCss = '<style id="coursyland-safety">
body{background:#fff!important;color:#1a1330!important}
body *:not([style*="color:#fff"]):not([style*="color:white"]):not([style*="color:#ffffff"]):not(.hero):not(.cta-section){color:inherit}
</style>';
$html = str_replace('</head>', $safetyCss . '</head>', $html);

/* ── Save page ── */
$pagesDir = __DIR__ . '/pages';
if (!is_dir($pagesDir)) mkdir($pagesDir, 0755, true);

$filePath = $pagesDir . '/' . $slug . '.html';
if (file_put_contents($filePath, $html) === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'לא ניתן לשמור קובץ ב-/pages/']);
    exit;
}

echo json_encode([
    'success' => true,
    'url'     => 'https://coursyland.com/pages/' . $slug . '.html',
]);
