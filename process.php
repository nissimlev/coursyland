<?php
set_time_limit(300);
ignore_user_abort(true);

/* Accept job_id from CLI argv or GET param */
$jobId = isset($argv[1]) ? $argv[1] : ($_GET['job_id'] ?? '');
$jobId = preg_replace('/[^a-f0-9]/', '', $jobId);
if (strlen($jobId) !== 32) exit;

$jobsDir = __DIR__ . '/jobs';
$jobFile = $jobsDir . '/' . $jobId . '.json';
if (!file_exists($jobFile)) exit;

$jobData = json_decode(file_get_contents($jobFile), true);
if (!$jobData || ($jobData['status'] ?? '') !== 'processing') exit;

/* ── Helpers ── */
function updateJob($file, $data) { file_put_contents($file, json_encode($data)); }

function failJob($file, &$data, $error) {
    $data['status'] = 'error';
    $data['error']  = $error;
    updateJob($file, $data);
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
if (empty($apiKey)) { failJob($jobFile, $jobData, 'ANTHROPIC_API_KEY חסר'); exit; }

/* ── Read job fields ── */
$slug       = $jobData['slug']       ?? '';
$courseName = $jobData['courseName'] ?? '';
$content    = $jobData['content']    ?? '';
$colors     = $jobData['colors']     ?? ['primary' => '#9B30E8', 'accent' => '#F59E0B'];
$payUrl     = $jobData['paymentUrl'] ?? '';
$imgUrls    = $jobData['imgUrls']    ?? ['instructor' => '', 'atmosphere' => [], 'lessons' => []];

if (!$slug || !$courseName || !$content) {
    failJob($jobFile, $jobData, 'Job data incomplete');
    exit;
}

/* ── Build image section for prompt ── */
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

$userMessage = "שם הקורס: {$courseName}\n\n"
    . "=== תוכן הדף ===\n{$content}\n\n"
    . "=== עיצוב ===\n"
    . "צבע ראשי: {$colors['primary']}\n"
    . "צבע הדגשה: {$colors['accent']}\n"
    . "URL לתשלום: {$payUrl}\n\n"
    . "=== תמונות ===\n"
    . ($imgSection ?: "לא הועלו תמונות.\n");

/* ── Call Anthropic API ── */
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

if ($curlErr) { failJob($jobFile, $jobData, 'שגיאת חיבור: ' . $curlErr); exit; }

$apiResp = json_decode($response, true);
if ($httpCode !== 200 || empty($apiResp['content'][0]['text'])) {
    failJob($jobFile, $jobData, $apiResp['error']['message'] ?? "שגיאה מ-Anthropic (HTTP $httpCode)");
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
    failJob($jobFile, $jobData, 'לא ניתן לשמור קובץ HTML');
    exit;
}

/* ── Mark done ── */
$jobData['status'] = 'done';
$jobData['url']    = 'https://coursyland.com/pages/' . $slug . '.html';
unset($jobData['content']); /* free space */
updateJob($jobFile, $jobData);
