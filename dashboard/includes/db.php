<?php
require_once __DIR__ . '/config_load.php';

/**
 * פרטי החיבור לדטאבייס.
 *
 * הפרטים האמיתיים יושבים בקובץ שמחוץ ל-public_html, לצד gh_token.txt
 * ו-admin_login.txt — מקום שהדיפלוי לא נוגע בו, ולכן שינוי שנעשה בשרת שורד.
 *
 * מבנה db_login.txt, שורה לכל שדה:
 *   1. host
 *   2. שם הדטאבייס
 *   3. שם משתמש
 *   4. סיסמה
 *
 * אם הקובץ חסר או קצר מדי — נופלים חזרה לקבועים של config.php (או לברירות
 * המחדל של config_load.php, אם גם הוא חסר), כדי שהמנגנון הזה לא יפיל דשבורד שעובד.
 */
function dbCredentials(): array {
    $file = dirname(__DIR__, 3) . '/db_login.txt';

    if (is_readable($file)) {
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines && count($lines) >= 4) {
            $vals = array_map('trim', array_slice($lines, 0, 4));
            if (!in_array('', $vals, true)) {
                return $vals;
            }
        }
    }
    return [DB_HOST, DB_NAME, DB_USER, DB_PASS];
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        [$host, $name, $user, $pass] = dbCredentials();
        $dsn = 'mysql:host=' . $host . ';dbname=' . $name . ';charset=utf8mb4';
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        $pdo = new PDO($dsn, $user, $pass, $options);
    }
    return $pdo;
}
