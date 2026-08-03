<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/mailer.php';

startSession();
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die('Method Not Allowed');
}

// הגנת CSRF
verifyCsrf();

$db       = getDB();
$reportId = (int)($_POST['report_id'] ?? 0);

if (!$reportId) {
    flashMessage('error', 'מזהה דוח חסר.');
    redirect('/admin/reports/list.php');
}

$stmt = $db->prepare("SELECT r.*, c.name AS client_name, c.email AS client_email FROM reports r JOIN clients c ON r.client_id=c.id WHERE r.id=?");
$stmt->execute([$reportId]);
$report = $stmt->fetch();

if (!$report || !$report['pdf_path'] || !file_exists($report['pdf_path'])) {
    flashMessage('error', 'קובץ PDF לא נמצא. הפק את הדוח תחילה.');
    redirect('/admin/reports/list.php');
}

$subject = "דוח מכירות CoursyLand — {$report['quarter']} — {$report['client_name']}";
$body    = buildReportEmailBody($report, ['name' => $report['client_name']]);
$ok      = sendReportEmail($report['client_email'], $report['client_name'], $subject, $body, $report['pdf_path']);

if ($ok) {
    $db->prepare("UPDATE reports SET sent_at=? WHERE id=?")->execute([date('Y-m-d H:i:s'), $reportId]);
    flashMessage('success', "הדוח נשלח בהצלחה ל-{$report['client_email']}");
} else {
    flashMessage('error', 'שגיאה בשליחת המייל. בדוק הגדרות Brevo.');
}

// מניעת Open Redirect — מאפשר רק URLs פנימיים
$returnUrl = $_POST['return_url'] ?? '';
$safe = preg_match('#^/admin/(reports/(list|view)\.php)#', $returnUrl);
redirect($safe ? $returnUrl : '/admin/reports/list.php');
