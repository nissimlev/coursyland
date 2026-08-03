<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/mailer.php';

startSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) { http_response_code(401); echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit; }

$db = getDB();
$pending = $db->query("
    SELECT r.*, c.name AS client_name, c.email AS client_email
    FROM reports r
    JOIN clients c ON r.client_id = c.id
    WHERE r.sent_at IS NULL AND r.pdf_path IS NOT NULL
")->fetchAll();

if (empty($pending)) {
    echo json_encode(['success' => true, 'message' => 'אין דוחות ממתינים.']);
    exit;
}

$sent   = 0;
$failed = 0;
$errors = [];

foreach ($pending as $report) {
    if (!file_exists($report['pdf_path'])) { $failed++; continue; }

    $subject = "דוח מכירות CoursyLand — {$report['quarter']} — {$report['client_name']}";
    $body    = buildReportEmailBody($report, ['name' => $report['client_name']]);
    $ok      = sendReportEmail($report['client_email'], $report['client_name'], $subject, $body, $report['pdf_path']);

    if ($ok) {
        $db->prepare("UPDATE reports SET sent_at=? WHERE id=?")->execute([date('Y-m-d H:i:s'), $report['id']]);
        $sent++;
    } else {
        $failed++;
        $errors[] = $report['client_name'];
    }
}

$msg = "נשלחו {$sent} דוחות בהצלחה.";
if ($failed) $msg .= " נכשלו {$failed}: " . implode(', ', $errors);

echo json_encode(['success' => $failed === 0, 'message' => $msg, 'sent' => $sent, 'failed' => $failed]);
