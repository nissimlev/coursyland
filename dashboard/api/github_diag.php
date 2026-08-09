<?php
/**
 * אבחון החיבור ל-GitHub, שלב אחר שלב.
 *
 * כל שלב נשלח לדפדפן מיד כשהוא מסתיים. אם התהליך נהרג באמצע —
 * מה שכבר הודפס נשאר על המסך, והשלב הראשון שחסר הוא זה שהרג אותו.
 * זה הדבר היחיד שמראה מה קורה כאן: log_errors כבוי בשרת.
 *
 * שימוש: /dashboard/api/github_diag.php?run=1  (דורש התחברות לדשבורד)
 */
require_once __DIR__ . '/../includes/auth.php';

startSession();
header('Content-Type: text/plain; charset=utf-8');
header('X-Accel-Buffering: no');

if (!isLoggedIn()) {
    echo "לא מחובר. יש להתחבר לדשבורד ואז לרענן.\n";
    exit;
}
if (($_GET['run'] ?? '') !== '1') {
    echo "הוסף ?run=1 לכתובת כדי להריץ.\n";
    exit;
}

@ini_set('output_buffering', '0');
@ini_set('implicit_flush', '1');
while (ob_get_level() > 0) { ob_end_flush(); }
ob_implicit_flush(true);

$step = 0;
function say(string $msg): void {
    global $step;
    printf("%2d. %s\n", ++$step, $msg);
    // ריפוד: חלק מהשכבות לא מעבירות הלאה מנות קטנות
    echo str_repeat(' ', 1024) . "\n";
    flush();
}

say('הסקריפט רץ. PHP ' . PHP_VERSION);

/* ── הטוקן ── */
$tokenFile = dirname(__DIR__, 3) . '/gh_token.txt';
say('נתיב קובץ הטוקן: ' . $tokenFile);
if (!is_readable($tokenFile)) { say('❌ הקובץ לא קריא. עוצר.'); exit; }
$token = trim((string)file_get_contents($tokenFile));
say('הטוקן נקרא: ' . strlen($token) . ' תווים, מתחיל ב-' . substr($token, 0, 8));

/* ── curl ── */
say('curl זמין: ' . (function_exists('curl_init') ? 'כן, ' . curl_version()['version'] : 'לא'));

function call(string $method, string $url, string $token, ?array $body): array {
    $h = [
        'Authorization: Bearer ' . $token,
        'Accept: application/vnd.github+json',
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: coursyland-admintools',
    ];
    if ($body !== null) $h[] = 'Content-Type: application/json';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $h,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT        => 120,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));

    $raw  = curl_exec($ch);
    $info = ['status' => (int)curl_getinfo($ch, CURLINFO_HTTP_CODE), 'err' => curl_error($ch)];
    curl_close($ch);
    $info['body'] = $raw === false ? '' : (string)$raw;
    return $info;
}

$base = 'https://api.github.com/repos/nissimlev/coursyland';

/* ── קריאה ── */
say('שולח GET לפרטי הריפו...');
$r = call('GET', $base, $token, null);
$j = json_decode($r['body'], true) ?: [];
say('GET הריפו: status ' . $r['status'] . ($r['err'] ? ' | curl: ' . $r['err'] : '')
    . ' | הרשאות: ' . json_encode($j['permissions'] ?? 'לא הוחזרו', JSON_UNESCAPED_UNICODE));

say('שולח GET ל-index.html...');
$r = call('GET', $base . '/contents/index.html?ref=main', $token, null);
$j = json_decode($r['body'], true) ?: [];
$sha = (string)($j['sha'] ?? '');
say('GET הקטלוג: status ' . $r['status'] . ' | גודל התשובה ' . number_format(strlen($r['body'])) . ' בייט | sha ' . substr($sha, 0, 10));

/* ── כתיבה: הרגע שבו זה נופל ── */
$path = 'images/courses/diag_' . bin2hex(random_bytes(4)) . '.png';
$png  = base64_encode(hex2bin(
    '89504e470d0a1a0a0000000d4948445200000001000000010806000000' .
    '1f15c4890000000a49444154789c6300010000050001'  .
    '0d0a2db40000000049454e44ae426082'
));
say('שולח PUT ליצירת ' . $path . ' ...');
$r = call('PUT', $base . '/contents/' . $path, $token, [
    'message' => 'diagnostic upload',
    'content' => $png,
    'branch'  => 'main',
]);
$j = json_decode($r['body'], true) ?: [];
say('PUT: status ' . $r['status'] . ($r['err'] ? ' | curl: ' . $r['err'] : '')
    . ' | ' . substr((string)($j['message'] ?? $r['body']), 0, 160));

/* ── ניקוי ── */
if ($r['status'] >= 200 && $r['status'] < 300) {
    $newSha = (string)($j['content']['sha'] ?? '');
    say('מנקה: מוחק את קובץ הבדיקה...');
    $d = call('DELETE', $base . '/contents/' . $path, $token, [
        'message' => 'remove diagnostic upload',
        'sha'     => $newSha,
        'branch'  => 'main',
    ]);
    say('DELETE: status ' . $d['status']);
}

say('הסתיים. אם הגעת לשורה הזו — הכתיבה ל-GitHub עובדת מהשרת.');
