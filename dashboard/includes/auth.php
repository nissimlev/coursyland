<?php
require_once __DIR__ . '/../config.php';

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
        header('Location: /admin/login.php');
        exit;
    }
}

function login(string $password): bool {
    startSession();
    if (hash_equals(ADMIN_PASSWORD, $password)) {
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
            header('Location: /admin/login.php?timeout=1');
            exit;
        }
    }
}
