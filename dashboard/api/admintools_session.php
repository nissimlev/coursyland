<?php
/**
 * בדיקת session עבור admintools.
 * admintools הוא HTML סטטי ולכן אינו יכול להטמיע csrf_token בזמן רינדור —
 * הוא מושך אותו מכאן, ורק אם ה-session של הדשבורד פעיל.
 */
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['authenticated' => false], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'authenticated' => true,
    'csrf_token'    => csrfToken(),
], JSON_UNESCAPED_UNICODE);
