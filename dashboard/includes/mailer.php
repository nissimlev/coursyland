<?php
// שליחת מייל עם PHPMailer
// התקנה: composer require phpmailer/phpmailer

require_once __DIR__ . '/../config.php';

$autoloadPaths = [
    __DIR__ . '/../../vendor/autoload.php',
    __DIR__ . '/../vendor/autoload.php',
];
foreach ($autoloadPaths as $path) {
    if (file_exists($path)) { require_once $path; break; }
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception as MailException;

function sendReportEmail(string $toEmail, string $toName, string $subject, string $body, string $pdfPath): bool {
    $mail = new PHPMailer(true);

    try {
        $mail->isSMTP();
        $mail->Host       = 'smtp-relay.brevo.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = BREVO_SMTP_LOGIN;
        $mail->Password   = BREVO_SMTP_KEY;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom(GMAIL_USER, MAIL_FROM_NAME);
        $mail->addAddress($toEmail, $toName);

        $mail->Subject = $subject;
        $mail->Body    = $body;
        $mail->isHTML(false);

        if ($pdfPath && file_exists($pdfPath)) {
            $mail->addAttachment($pdfPath, basename($pdfPath));
        }

        $mail->send();
        return true;
    } catch (MailException $e) {
        error_log("Mailer error to {$toEmail}: " . $mail->ErrorInfo);
        return false;
    }
}

function buildReportEmailBody(array $report, array $client): string {
    $q      = $report['quarter'];
    $net    = '₪' . number_format((float)$report['net_amount'], 2, '.', ',');
    $sales  = $report['total_sales'];
    $name   = $client['name'];

    return <<<TXT
שלום {$name},

מצורף דוח המכירות שלך ל-{$q}.

סיכום קצר:
• סה"כ מכירות: {$sales} עסקאות
• לתשלום נטו: {$net}

הדוח המלא עם פירוט כל הרכישות מצורף כקובץ PDF.

━━━━━━━━━━━━━━━━━━━━━━━━━━
הוראות תשלום:
1. אנא שלח/י חשבונית על הסכום הנ"ל למייל: payments@coursyland.com
2. התשלום יועבר תוך 10 ימי עסקים מרגע קבלת החשבונית.
━━━━━━━━━━━━━━━━━━━━━━━━━━

בכל שאלה אני זמין,
ניסים לוי
CoursyLand | 054-5409021
TXT;
}
