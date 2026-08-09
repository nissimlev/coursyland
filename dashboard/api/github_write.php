<?php
/**
 * פרוקסי לכתיבה ל-GitHub עבור admintools.
 *
 * הטוקן יושב בקובץ מחוץ ל-public_html ולעולם אינו מגיע לדפדפן.
 * כל בקשה מחייבת session פעיל של הדשבורד + csrf_token.
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
header('Content-Type: application/json; charset=utf-8');

const GH_REPO       = 'nissimlev/coursyland';
const GH_BRANCH     = 'main';
const MAX_IMAGE_MB  = 8;

/* ── יציאה עם שגיאה ── */
function fail(int $code, string $message): void {
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * גם קריסה בלתי צפויה תחזור כ-JSON.
 * בלי זה הדפדפן מקבל תשובה ריקה ומציג "שגיאת שרת" גנרית בלי סיבה,
 * ו-log_errors כבוי בשרת כך שאין לאן להסתכל.
 */
register_shutdown_function(function (): void {
    $e = error_get_last();
    if ($e === null || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => 'קריסה בשרת: ' . $e['message']], JSON_UNESCAPED_UNICODE);
});

/* ── שער כניסה ── */
// isLoggedIn ולא requireLogin: הקריאות מגיעות מ-fetch, והפניה ל-login.php
// הייתה מוחזרת כ-HTML עם status 200 ומבלבלת את הצד הלקוח.
if (!isLoggedIn()) {
    fail(401, 'לא מחובר. יש להתחבר לדשבורד.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'שיטה לא נתמכת.');
}

// אותה בדיקה כמו verifyCsrf(), אבל מחזירה JSON במקום טקסט
if (!hash_equals($_SESSION['csrf_token'] ?? '', $_POST['csrf_token'] ?? '')) {
    fail(403, 'בקשה לא חוקית.');
}

/* ── קריאת הטוקן ── */
// מחוץ לתיקיית הדיפלוי: /home/.../domains/coursyland.com/gh_token.txt
$tokenFile = dirname(__DIR__, 3) . '/gh_token.txt';
if (!is_readable($tokenFile)) {
    fail(500, 'קובץ הטוקן לא נמצא בשרת.');
}
$ghToken = trim((string)file_get_contents($tokenFile));
if ($ghToken === '') {
    fail(500, 'קובץ הטוקן ריק.');
}

/* ── רק הנתיבים שהכלים באמת צריכים ניתנים לכתיבה ── */
function pathAllowed(string $path): bool {
    if ($path === 'index.html') return true;
    return (bool)preg_match('#^images/courses/[A-Za-z0-9._-]+\.(jpe?g|png|webp|gif)$#i', $path);
}

/* ── קריאה ל-GitHub ── */
function gh(string $method, string $path, string $token, ?array $body = null): array {
    $url     = 'https://api.github.com/repos/' . GH_REPO . '/contents/' . $path;
    $headers = [
        'Authorization: Bearer ' . $token,
        'Accept: application/vnd.github+json',
        'X-GitHub-Api-Version: 2022-11-28',
        'User-Agent: coursyland-admintools',
    ];
    if ($body !== null) $headers[] = 'Content-Type: application/json';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        // תמונה נשלחת מקודדת ב-base64 ותופחת בשליש, כך שהעלאה של כמה
        // מגה־בייט יכולה לקחת הרבה יותר מ-30 שניות. max_execution_time
        // בשרת הוא 360, אז יש מרווח.
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT        => 180,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $raw    = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlEr = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        fail(502, 'שגיאת רשת מול GitHub: ' . $curlEr);
    }
    return ['status' => $status, 'body' => json_decode($raw, true) ?: []];
}

/* ── תרגום שגיאות GitHub לעברית ── */
function ghGuard(array $res): array {
    if ($res['status'] >= 200 && $res['status'] < 300) return $res['body'];
    $msg = $res['body']['message'] ?? '';
    if ($res['status'] === 401) fail(502, 'הטוקן שבשרת נדחה על ידי GitHub. יש להחליף אותו.');
    if ($res['status'] === 403) fail(502, 'GitHub חסם את הבקשה (הרשאות או מגבלת קצב).');
    if ($res['status'] === 404) fail(502, 'הקובץ או הריפו לא נמצאו ב-GitHub.');
    if ($res['status'] === 409) fail(409, 'הקובץ שונה בינתיים. רענן ונסה שוב.');
    fail(502, 'GitHub החזיר שגיאה ' . $res['status'] . ($msg ? ': ' . $msg : ''));
}

/* ── פעולות ── */
$action = $_POST['action'] ?? '';

switch ($action) {

    case 'get_file': {
        $path = (string)($_POST['path'] ?? 'index.html');
        if (!pathAllowed($path)) fail(400, 'נתיב לא מורשה.');
        $data = ghGuard(gh('GET', $path . '?ref=' . GH_BRANCH, $ghToken));
        echo json_encode([
            'content' => $data['content'] ?? '',
            'sha'     => $data['sha'] ?? '',
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'put_file': {
        $path    = (string)($_POST['path'] ?? 'index.html');
        $content = (string)($_POST['content'] ?? '');
        $sha     = (string)($_POST['sha'] ?? '');
        $message = trim((string)($_POST['message'] ?? '')) ?: 'Update via admintools';

        if (!pathAllowed($path))                        fail(400, 'נתיב לא מורשה.');
        if ($content === '' || base64_decode($content, true) === false) fail(400, 'תוכן לא תקין.');
        if ($sha === '')                                fail(400, 'חסר sha.');

        $data = ghGuard(gh('PUT', $path, $ghToken, [
            'message' => $message,
            'content' => $content,
            'sha'     => $sha,
            'branch'  => GH_BRANCH,
        ]));
        echo json_encode(['commit' => $data['commit']['sha'] ?? ''], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'upload_image': {
        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            fail(400, 'העלאת התמונה נכשלה.');
        }
        if ($_FILES['image']['size'] > MAX_IMAGE_MB * 1024 * 1024) {
            fail(413, 'התמונה גדולה מ-' . MAX_IMAGE_MB . 'MB.');
        }

        $mime    = (string)(new finfo(FILEINFO_MIME_TYPE))->file($_FILES['image']['tmp_name']);
        $byMime  = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
        if (!isset($byMime[$mime])) fail(400, 'סוג קובץ לא נתמך. מותר: JPG, PNG, WEBP, GIF.');

        // שם הקובץ נקבע בשרת — שם מהלקוח לא נכנס לנתיב
        $path = 'images/courses/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $byMime[$mime];
        if (!pathAllowed($path)) fail(500, 'נתיב שנוצר אינו תקין.');

        $binary = file_get_contents($_FILES['image']['tmp_name']);
        if ($binary === false) fail(500, 'קריאת התמונה נכשלה.');

        ghGuard(gh('PUT', $path, $ghToken, [
            'message' => 'Upload course image: ' . basename($path),
            'content' => base64_encode($binary),
            'branch'  => GH_BRANCH,
        ]));

        echo json_encode([
            'url' => 'https://raw.githubusercontent.com/' . GH_REPO . '/' . GH_BRANCH . '/' . $path,
        ], JSON_UNESCAPED_UNICODE);
        break;
    }

    default:
        fail(400, 'פעולה לא מוכרת.');
}
