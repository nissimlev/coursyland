<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

startSession();
if (!isLoggedIn()) { http_response_code(401); die('Unauthorized'); }

$db   = getDB();
$id   = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT pdf_path, quarter, client_id FROM reports WHERE id=?");
$stmt->execute([$id]);
$report = $stmt->fetch();

if (!$report || !$report['pdf_path'] || !file_exists($report['pdf_path'])) {
    http_response_code(404);
    die('קובץ PDF לא נמצא.');
}

$filename = 'report_' . $report['quarter'] . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($report['pdf_path']));
readfile($report['pdf_path']);
