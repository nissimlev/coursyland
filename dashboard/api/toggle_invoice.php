<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

startSession();
if (!isLoggedIn()) { http_response_code(403); die('Unauthorized'); }

require_once __DIR__ . '/../includes/functions.php';
verifyCsrf();

$id    = (int)($_POST['report_id'] ?? 0);
$value = (int)($_POST['value']     ?? 0);

if (!$id) { http_response_code(400); die('Missing report_id'); }

$db = getDB();
$now = $value ? date('Y-m-d H:i:s') : null;
$db->prepare("UPDATE reports SET invoice_received=?, invoice_received_at=? WHERE id=?")->execute([$value, $now, $id]);

header('Content-Type: application/json');
echo json_encode(['ok' => true]);
