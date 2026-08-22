<?php
require_once __DIR__ . '/config_load.php';

function sendSecurityHeaders(): void {
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
    // Content Security Policy — מאפשר רק משאבים מהדומיין עצמו
    header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
}

function startSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_start([
            'cookie_httponly' => true,
            'cookie_secure'   => isset($_SERVER['HTTPS']),
            'cookie_samesite' => 'Strict',
        ]);
    }
    sendSecurityHeaders();
}

function isLoggedIn(): bool {
    startSession();
    return !empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

function requireLogin(): void {
    if (!isLoggedIn()) {
        header('Location: /dashboard/login.php');
        exit;
    }
}

/**
 * פרטי הכניסה יושבים מחוץ ל-public_html, כדי שלא יגיעו לגיט ולא ידרסו בדיפלוי.
 * מבנה הקובץ: שורה ראשונה שם משתמש, שורה שנייה סיסמה.
 * מחזיר null אם הקובץ חסר או פגום — כדי שאפשר יהיה להבדיל בין
 * "השרת לא מוגדר" לבין "פרטים שגויים".
 */
function adminCredentials(): ?array {
    $file = dirname(__DIR__, 3) . '/admin_login.txt';
    if (!is_readable($file)) return null;

    $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines || count($lines) < 2) return null;

    $user = trim($lines[0]);
    $pass = trim($lines[1]);
    if ($user === '' || $pass === '') return null;

    return ['user' => $user, 'pass' => $pass];
}

function login(string $username, string $password): bool {
    startSession();

    $creds = adminCredentials();
    if ($creds === null) return false;

    // שתי ההשוואות רצות תמיד, כדי שזמן התגובה לא יסגיר איזה שדה שגוי
    $okUser = hash_equals($creds['user'], $username);
    $okPass = hash_equals($creds['pass'], $password);

    if ($okUser && $okPass) {
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['login_time']      = time();
        return true;
    }
    return false;
}

function logout(): void {
    startSession();
    $_SESSION = [];
    session_destroy();
}

// Session timeout: 8 שעות
function checkSessionTimeout(): void {
    if (isLoggedIn()) {
        $loginTime = $_SESSION['login_time'] ?? 0;
        if ($loginTime && (time() - $loginTime) > 28800) {
            logout();
            header('Location: /dashboard/login.php?timeout=1');
            exit;
        }
    }
}
