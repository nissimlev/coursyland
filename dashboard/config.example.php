<?php
// העתק קובץ זה ל-config.php ומלא את הפרטים

define('DB_HOST', 'localhost');
define('DB_NAME', 'coursyland_admin');
define('DB_USER', 'DB_USER_HERE');
define('DB_PASS', 'DB_PASS_HERE');

define('ADMIN_PASSWORD', 'STRONG_PASSWORD_HERE');

define('GMAIL_USER', 'your@gmail.com');
define('GMAIL_APP_PASSWORD', 'xxxx xxxx xxxx xxxx');
define('MAIL_FROM_NAME', 'CoursyLand');

define('ICOUNT_API_KEY',    'YOUR_ICOUNT_API_KEY');
define('ICOUNT_COMPANY_ID', 'YOUR_ICOUNT_COMPANY_ID');

define('PDF_STORAGE_PATH', __DIR__ . '/reports_pdf/');
define('SITE_URL', 'https://admin.coursyland.com');

date_default_timezone_set('Asia/Jerusalem');
