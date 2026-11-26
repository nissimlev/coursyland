<?php
/**
 * Lead form for "מתנת הפערים" (present-of-gaps.html).
 *
 * Receives name / email / phone from the page and emails them to Dikla and to
 * Valead. Uses Brevo SMTP if dashboard/config.php has its keys (read-only,
 * via config_load.php); otherwise Hostinger's own mail(). As of Nov 2026 the
 * server has no Brevo keys, so mail() is the path in use.
 *
 * Recipients are fixed here on purpose: the browser never chooses where mail
 * goes, so this endpoint can't be used as an open relay.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const LEAD_RECIPIENTS = [
    'valead.marketing@gmail.com',
    'diklateller1@gmail.com',
];
const LEAD_SUBJECT = 'ליד חדש: מתנת הפערים';

function respond(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'method']);
}

// Honeypot: real visitors never see or fill this field.
if (!empty($_POST['website'])) {
    respond(200, ['ok' => true]);
}

$clean = static function (string $key, int $max): string {
    $v = trim((string)($_POST[$key] ?? ''));
    $v = preg_replace('/[\r\n\t]+/', ' ', $v);
    return mb_substr($v, 0, $max, 'UTF-8');
};

$name  = $clean('name', 100);
$email = $clean('email', 150);
$phone = $clean('phone', 30);
$digits = preg_replace('/\D+/', '', $phone);

$errors = [];
if (mb_strlen($name, 'UTF-8') < 2)                 $errors[] = 'name';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))    $errors[] = 'email';
if (strlen($digits) < 9 || strlen($digits) > 13)   $errors[] = 'phone';
if ($errors) {
    respond(422, ['ok' => false, 'error' => 'invalid', 'fields' => $errors]);
}

// Light per-IP throttle: at most 5 submissions per 10 minutes.
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$throttleFile = sys_get_temp_dir() . '/cl_lead_' . md5($ip);
$now = time();
$hits = array_filter(
    is_readable($throttleFile) ? (array)json_decode((string)file_get_contents($throttleFile), true) : [],
    static fn($t) => is_int($t) && $t > $now - 600
);
if (count($hits) >= 5) {
    respond(429, ['ok' => false, 'error' => 'rate']);
}
$hits[] = $now;
@file_put_contents($throttleFile, json_encode(array_values($hits)), LOCK_EX);

$dashboard = dirname(__DIR__, 2) . '/dashboard';
require_once $dashboard . '/includes/config_load.php';
require_once $dashboard . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as MailException;

$when = date('d/m/Y H:i');
$page = (string)($_SERVER['HTTP_REFERER'] ?? '');
$body = "ליד חדש מדף הנחיתה \"מתנת הפערים\"\n\n"
      . "שם: {$name}\n"
      . "אימייל: {$email}\n"
      . "טלפון: {$phone}\n\n"
      . "נשלח: {$when}\n"
      . ($page !== '' ? "דף: {$page}\n" : '');

$mail = new PHPMailer(true);
try {
    $mail->CharSet = 'UTF-8';
    if (BREVO_SMTP_LOGIN !== '' && BREVO_SMTP_KEY !== '' && GMAIL_USER !== '') {
        // Brevo, when the dashboard config has its keys.
        $mail->isSMTP();
        $mail->Host       = 'smtp-relay.brevo.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = BREVO_SMTP_LOGIN;
        $mail->Password   = BREVO_SMTP_KEY;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->setFrom(GMAIL_USER, MAIL_FROM_NAME);
    } else {
        // No SMTP keys on the server: send through Hostinger's own mail().
        // The domain's SPF includes Hostinger, so a @coursyland.com sender passes.
        $mail->isMail();
        $mail->setFrom('no-reply@coursyland.com', 'CoursyLand', true);
    }
    foreach (LEAD_RECIPIENTS as $to) {
        $mail->addAddress($to);
    }
    $mail->addReplyTo($email, $name);

    $mail->Subject = LEAD_SUBJECT . ' - ' . $name;
    $mail->Body    = $body;
    $mail->isHTML(false);

    $mail->send();
    respond(200, ['ok' => true]);
} catch (MailException $e) {
    error_log('Dikla lead mail failed: ' . $mail->ErrorInfo);
    respond(500, ['ok' => false, 'error' => 'mail']);
}
