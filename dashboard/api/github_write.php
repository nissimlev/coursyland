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
        fail(424, 'שגיאת רשת מול GitHub: ' . $curlEr);
    }
    return ['status' => $status, 'body' => json_decode($raw, true) ?: []];
}

/* ── תרגום שגיאות GitHub לעברית ── */
/*
 * הקודים כאן הם 424 ולא 502 בכוונה: Cloudflare מזהה 502/503/504 כתקלת שער,
 * מיירט את התשובה ומחליף את גוף ההודעה בדף השגיאה שלו — כך שההסבר שכתבנו
 * נמחק בדרך והמשתמש רואה "Bad gateway" בלבד. 4xx עובר בלי שאיש נוגע בו.
 */
function ghGuard(array $res): array {
    if ($res['status'] >= 200 && $res['status'] < 300) return $res['body'];

    // ההודעה של GitHub נשמרת תמיד — היא זו שמבדילה בין הרשאה חסרה,
    // ריפו לא נגיש ומגבלת קצב, וכל השלושה נראים אחרת מהניסוח שלנו
    $msg  = (string)($res['body']['message'] ?? '');
    $tail = ' [GitHub ' . $res['status'] . ($msg !== '' ? ': ' . $msg : '') . ']';

    if ($res['status'] === 401) fail(424, 'הטוקן שבשרת נדחה על ידי GitHub. יש להחליף אותו.' . $tail);
    if ($res['status'] === 403) fail(424, 'GitHub חסם את הבקשה — סביר שלטוקן אין הרשאת כתיבה (Contents: Read and write).' . $tail);
    if ($res['status'] === 404) fail(424, 'GitHub לא מצא את הריפו או הנתיב — לרוב סימן שהטוקן לא קיבל גישה לריפו הזה.' . $tail);
    if ($res['status'] === 409) fail(409, 'הקובץ שונה בינתיים. רענן ונסה שוב.' . $tail);
    if ($res['status'] === 422) fail(424, 'GitHub דחה את הבקשה כלא תקינה.' . $tail);
    fail(424, 'GitHub החזיר שגיאה.' . $tail);
}

/* ── עבודה על מערך הקורסים שבתוך index.html ── */
const COURSES_START = 'const courses = [';
const COURSES_END   = "\n];";

/** מביא את הקטלוג ומאתר את גבולות המערך. הקטלוג לא עוזב את השרת. */
function loadCatalog(string $token): array {
    $file = ghGuard(gh('GET', 'index.html?ref=' . GH_BRANCH, $token));
    $html = base64_decode(str_replace("\n", '', (string)($file['content'] ?? '')), true);
    if ($html === false || $html === '') fail(424, 'לא ניתן לקרוא את הקטלוג מ-GitHub.');

    $start = strpos($html, COURSES_START);
    if ($start === false) fail(500, 'לא נמצא מערך courses בקובץ.');

    $contentStart = $start + strlen(COURSES_START);
    $end = strpos($html, COURSES_END, $contentStart);
    if ($end === false) fail(500, 'לא נמצאה סגירת המערך בקובץ.');

    return [
        'html'         => $html,
        'sha'          => (string)($file['sha'] ?? ''),
        'contentStart' => $contentStart,
        'end'          => $end,
        'region'       => substr($html, $contentStart, $end - $contentStart),
    ];
}

/** מייצר רשומה בפורמט של המערך הקיים — אותו ריווח ואותו סדר שדות. */
function jsEntry(array $course): string {
    $parts = [];
    foreach ($course as $k => $v) {
        if ($v === null || $v === '') continue;
        if (is_bool($v)) {
            $val = $v ? 'true' : 'false';
        } elseif (is_int($v)) {
            $val = (string)$v;
        } else {
            $s   = str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$v);
            $s   = str_replace("\r", '', $s);
            $s   = str_replace("\n", '\\n', $s);
            $val = '"' . $s . '"';
        }
        $parts[] = '    ' . $k . ': ' . $val;
    }
    return "  {\n" . implode(",\n", $parts) . "\n  }";
}

/**
 * מאתר את גבולות כל רשומה במערך.
 *
 * סורק תו-תו ועוקב אחרי מחרוזות ותווי בריחה, כי תיאור של קורס יכול להכיל
 * סוגריים מסולסלים — ספירת סוגריים תמימה הייתה נשברת עליהם.
 *
 * מחזיר לכל רשומה: start, end (כולל), id.
 */
function splitEntries(string $region): array {
    $entries  = [];
    $depth    = 0;
    $inString = false;
    $escape   = false;
    $objStart = 0;
    $len      = strlen($region);

    for ($i = 0; $i < $len; $i++) {
        $c = $region[$i];

        if ($inString) {
            if ($escape)            { $escape = false; }
            elseif ($c === '\\')    { $escape = true; }
            elseif ($c === '"')     { $inString = false; }
            continue;
        }

        if ($c === '"')      { $inString = true; }
        elseif ($c === '{')  { if (++$depth === 1) $objStart = $i; }
        elseif ($c === '}')  {
            if (--$depth === 0) {
                $text = substr($region, $objStart, $i - $objStart + 1);
                preg_match('/\bid:\s*(\d+)/', $text, $m);
                $entries[] = [
                    'start' => $objStart,
                    'end'   => $i,
                    'id'    => isset($m[1]) ? (int)$m[1] : null,
                    'text'  => $text,
                ];
            }
        }
    }
    return $entries;
}

/** שולף ערך של שדה מתוך רשומה, ומפענח את תווי הבריחה שנכתבו בה. */
function entryField(string $text, string $name): string {
    if (!preg_match('/\b' . preg_quote($name, '/') . ':\s*"((?:[^"\\\\]|\\\\.)*)"/', $text, $m)) {
        return '';
    }
    $decoded = json_decode('"' . $m[1] . '"');
    return is_string($decoded) ? $decoded : $m[1];
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

    case 'list_categories': {
        $cat = loadCatalog($ghToken);
        preg_match_all('/\bcategory:\s*"((?:[^"\\\\]|\\\\.)*)"/', $cat['region'], $m);
        $cats = array_values(array_unique(array_filter(array_map('stripslashes', $m[1] ?? []))));
        sort($cats, SORT_NATURAL | SORT_FLAG_CASE);
        echo json_encode(['categories' => $cats], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'add_course': {
        // הדפדפן שולח רק את פרטי הקורס — כמה מאות בייט.
        // הקטלוג עצמו נקרא ונכתב כאן, ולא עובר דרך הרשת פעמיים.
        $f = [];
        foreach (['title','desc','category','price','oldPrice','duration','instructor','img','link'] as $k) {
            $f[$k] = trim((string)($_POST[$k] ?? ''));
        }
        foreach (['title','desc','category','price','duration','instructor'] as $req) {
            if ($f[$req] === '') fail(400, "חסר שדה חובה: {$req}");
        }

        $cat = loadCatalog($ghToken);

        preg_match_all('/\bid:\s*(\d+)/', $cat['region'], $m);
        $maxId = $m[1] ? max(array_map('intval', $m[1])) : 0;

        $course = [
            'id'         => $maxId + 1,
            'title'      => $f['title'],
            'desc'       => $f['desc'],
            'category'   => $f['category'],
            'price'      => $f['price'],
            'oldPrice'   => $f['oldPrice'],   // ריק = בלי מחיר לפני הנחה; jsEntry מדלג על ריקים
            'duration'   => $f['duration'],
            'instructor' => $f['instructor'],
            'img'        => $f['img'],
            'sample'     => false,
        ];
        if ($f['link'] !== '') $course['link'] = $f['link'];

        // הקורס החדש נכנס בראש המערך ולא בסופו, כדי שיופיע ראשון בקטלוג.
        // renderGrid ב-index.html ממיין רק לפי דגל sample, ומיון ב-JS יציב —
        // ולכן סדר המערך נשמר בתוך קבוצת הקורסים הרגילים.
        $hasEntries = splitEntries($cat['region']) !== [];

        $updated = substr($cat['html'], 0, $cat['contentStart'])
                 . "\n" . jsEntry($course) . ($hasEntries ? ',' : '')
                 . substr($cat['html'], $cat['contentStart']);

        ghGuard(gh('PUT', 'index.html', $ghToken, [
            'message' => 'Add course: ' . $f['title'] . ' by ' . $f['instructor'],
            'content' => base64_encode($updated),
            'sha'     => $cat['sha'],
            'branch'  => GH_BRANCH,
        ]));

        echo json_encode(['id' => $course['id']], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'list_courses': {
        $cat  = loadCatalog($ghToken);
        $out  = [];
        foreach (splitEntries($cat['region']) as $e) {
            if ($e['id'] === null) continue;
            $out[] = [
                'id'         => $e['id'],
                'title'      => entryField($e['text'], 'title'),
                'price'      => entryField($e['text'], 'price'),
                'instructor' => entryField($e['text'], 'instructor'),
                'category'   => entryField($e['text'], 'category'),
                'img'        => entryField($e['text'], 'img'),
            ];
        }
        echo json_encode(['courses' => $out], JSON_UNESCAPED_UNICODE);
        break;
    }

    case 'delete_course': {
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) fail(400, 'מזהה קורס לא תקין.');

        $cat     = loadCatalog($ghToken);
        $region  = $cat['region'];
        $entries = splitEntries($region);

        $pos = null;
        foreach ($entries as $i => $e) {
            if ($e['id'] === $id) { $pos = $i; break; }
        }
        if ($pos === null) fail(404, 'הקורס לא נמצא בקטלוג.');

        $title = entryField($entries[$pos]['text'], 'title');

        // חיתוך כירורגי: כל שאר הרשומות נשארות בדיוק כפי שהן, תו בתו.
        // חותכים גם את הפסיק המפריד — זה שלפני הרשומה, ואם היא הראשונה אז זה שאחריה.
        if (count($entries) === 1) {
            $newRegion = "\n";
        } elseif ($pos > 0) {
            $newRegion = substr($region, 0, $entries[$pos - 1]['end'] + 1)
                       . substr($region, $entries[$pos]['end'] + 1);
        } else {
            $newRegion = substr($region, 0, $entries[$pos]['start'])
                       . substr($region, $entries[$pos + 1]['start']);
        }

        $updated = substr($cat['html'], 0, $cat['contentStart'])
                 . $newRegion
                 . substr($cat['html'], $cat['end']);

        ghGuard(gh('PUT', 'index.html', $ghToken, [
            'message' => 'Delete course: ' . ($title !== '' ? $title : ('#' . $id)),
            'content' => base64_encode($updated),
            'sha'     => $cat['sha'],
            'branch'  => GH_BRANCH,
        ]));

        echo json_encode(['deleted' => $id, 'title' => $title], JSON_UNESCAPED_UNICODE);
        break;
    }

    default:
        fail(400, 'פעולה לא מוכרת.');
}
