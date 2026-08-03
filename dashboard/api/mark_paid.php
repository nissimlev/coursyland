<?php
// API: סימון דוח כשולם (AJAX)
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
header('Content-Type: application/json; charset=utf-8');

if (!isLoggedIn()) { http_response_code(401); echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['success' => false, 'message' => 'Method Not Allowed']); exit; }

// הגנת CSRF
$token = $_POST['csrf_token'] ?? '';
if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'בקשה לא חוקית']);
    exit;
}

$db       = getDB();
$reportId = (int)($_POST['report_id'] ?? 0);
$isPaid   = (int)($_POST['is_paid'] ?? 0);

if (!$reportId) { echo json_encode(['success' => false, 'message' => 'מזהה דוח חסר']); exit; }

$paidAt = $isPaid ? date('Y-m-d H:i:s') : null;
$stmt   = $db->prepare("UPDATE reports SET is_paid=?, paid_at=? WHERE id=?");
$stmt->execute([$isPaid, $paidAt, $reportId]);

echo json_encode(['success' => true, 'message' => $isPaid ? 'סומן כשולם ✓' : 'סומן כלא שולם']);
