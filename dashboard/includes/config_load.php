<?php
/**
 * טעינת ההגדרות של הדשבורד — נקודת הכניסה היחידה ל-config.php.
 *
 * config.php כבר לא נמצא במעקב git (הוא ב-.gitignore), ולכן הוא לא מגיע
 * בדיפלוי ויכול פשוט לא להיות קיים בשרת. עד עכשיו כל קובץ ב-includes/ עשה
 * require_once קשיח אליו, כך שהיעדרו הפיל את כל הדשבורד ב-500 — כולל דפים
 * שלא נוגעים בכלל בדטאבייס, כמו logout.php.
 *
 * לכן: טוענים את config.php אם הוא קיים, ואחר כך משלימים ערך ברירת מחדל
 * לכל קבוע שלא הוגדר. הסודות האמיתיים ממילא יושבים בקבצים שמחוץ ל-public_html
 * (db_login.txt, admin_login.txt) — ראה db.php ו-auth.php.
 */

$configFile = dirname(__DIR__) . '/config.php';
if (is_readable($configFile)) {
    require_once $configFile;
}

/**
 * ברירות מחדל לכל קבוע שהקוד באמת משתמש בו. ריק ולא שגוי — כדי ששירות
 * שלא הוגדר ייכשל בקריאה אליו בלבד, במקום להפיל את הדף כולו.
 */
$configDefaults = [
    // db.php — נטענים רק אם db_login.txt חסר או פגום
    'DB_HOST'          => 'localhost',
    'DB_NAME'          => '',
    'DB_USER'          => '',
    'DB_PASS'          => '',

    // mailer.php
    'BREVO_SMTP_LOGIN' => '',
    'BREVO_SMTP_KEY'   => '',
    'GMAIL_USER'       => '',
    'MAIL_FROM_NAME'   => 'CoursyLand',

    // icount.php
    'ICOUNT_API_KEY'   => '',

    // pdf.php
    'PDF_STORAGE_PATH' => dirname(__DIR__) . '/reports_pdf/',
];

foreach ($configDefaults as $configName => $configValue) {
    if (!defined($configName)) {
        define($configName, $configValue);
    }
}
unset($configFile, $configDefaults, $configName, $configValue);

date_default_timezone_set('Asia/Jerusalem');
