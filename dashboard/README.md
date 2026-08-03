# CoursyLand Admin — מדריך התקנה

## דרישות מערכת
- PHP 8.0+
- MySQL 5.7+ / MariaDB 10.3+
- Composer
- Hostinger Shared Hosting / VPS

---

## שלב 1 — מסד נתונים

**ב-phpMyAdmin ב-Hostinger:**
1. צור database חדש: `coursyland_admin` (charset: `utf8mb4`)
2. לחץ "Import" ובחר את הקובץ `schema.sql`
3. לחץ "Go"

---

## שלב 2 — config.php

ערוך את `config.php` עם הפרטים שלך:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'coursyland_admin');
define('DB_USER', 'u123456789_admin');   // מה-Hostinger
define('DB_PASS', 'YOUR_DB_PASSWORD');

define('ADMIN_PASSWORD', 'choose_strong_password');

define('GMAIL_USER', 'your@gmail.com');
define('GMAIL_APP_PASSWORD', 'xxxx xxxx xxxx xxxx');

define('ICOUNT_API_KEY',    'YOUR_KEY');
define('ICOUNT_COMPANY_ID', 'YOUR_ID');

define('PDF_STORAGE_PATH', '/home/u123456789/domains/admin.coursyland.com/reports_pdf/');
define('SITE_URL', 'https://admin.coursyland.com');
```

---

## שלב 3 — Gmail App Password

1. כנס ל: [myaccount.google.com/security](https://myaccount.google.com/security)
2. הפעל **2-Step Verification** (אם עדיין לא)
3. חפש "App passwords" → בחר App: **Mail**, Device: **Other** → קרא לו "CoursyLand"
4. העתק את הסיסמה (16 תווים) לתוך `GMAIL_APP_PASSWORD` בקונפיג

---

## שלב 4 — iCount API Key

1. התחבר ל-iCount → הגדרות חשבון
2. API → צור מפתח API חדש
3. העתק את ה-Key וה-Company ID לקונפיג

---

## שלב 5 — התקנת ספריות (Composer)

```bash
cd /path/to/admin
composer require mpdf/mpdf phpmailer/phpmailer
```

**אם אין Composer ב-Hostinger:**
- השתמש ב-SSH: `php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');" && php composer-setup.php`
- או הורד את `vendor.zip` מוכן מראש (ניתן לבנות לוקאלי ולהעלות)

---

## שלב 6 — Cron Jobs ב-Hostinger

**Hostinger Control Panel → Advanced → Cron Jobs**

### סנכרון iCount (כל 6 שעות):
```
0 */6 * * * php /home/u123456789/domains/admin.coursyland.com/public_html/admin/api/icount_sync.php
```

### הפקת דוחות רבעוניים (תחילת כל רבעון):
```
0 0 1 1,4,7,10 * php /home/u123456789/domains/admin.coursyland.com/public_html/admin/api/generate_quarterly_reports.php
```

---

## שלב 7 — הגדרת תיקיית reports_pdf

```bash
mkdir -p /home/u123456789/domains/admin.coursyland.com/reports_pdf
chmod 755 /home/u123456789/domains/admin.coursyland.com/reports_pdf
```

ודא שה-`PDF_STORAGE_PATH` ב-config.php מצביע לתיקייה זו.

**אבטחה:** הוסף `.htaccess` לתיקיית `reports_pdf`:
```apache
Deny from all
```

---

## שלב 8 — .htaccess (root admin)

צור `/admin/.htaccess`:
```apache
Options -Indexes
```

---

## מבנה URL

- דשבורד: `https://admin.coursyland.com/admin/`
- לקוחות: `https://admin.coursyland.com/admin/clients/list.php`
- מכירות: `https://admin.coursyland.com/admin/sales/dashboard.php`
- דוחות:  `https://admin.coursyland.com/admin/reports/list.php`

---

## זרימת עבודה רבעונית

1. ה-Cron מריץ `generate_quarterly_reports.php` ב-1 לינואר/אפריל/יולי/אוקטובר
2. הדוחות מופקים כ-PDF ונשמרים בשרת
3. בדשבורד מופיעה התראה: "X דוחות מוכנים לשליחה"
4. לוחצים "שלח את כל הממתינים" — נשלח מייל לכל לקוח
5. מסמנים "שולם" לאחר העברה

---

## פתרון בעיות

| בעיה | פתרון |
|------|--------|
| PDF לא נוצר | וודא mPDF מותקן + תיקיית reports_pdf כתיבה |
| מייל לא נשלח | בדוק GMAIL_APP_PASSWORD, Gmail 2FA פעיל |
| iCount לא מסנכרן | בדוק API Key + Company ID |
| שגיאת DB | בדוק DB_USER/DB_PASS ב-Hostinger |

---

## אבטחה

- config.php **לא** מועלה ל-git (הוסף ל-.gitignore)
- Session cookie מוגדר עם HttpOnly + Secure + SameSite
- CSRF token בכל טופס POST
- PDO Prepared Statements בכל שאילתה
