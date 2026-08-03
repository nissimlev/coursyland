<?php
// API: קורסים לפי לקוח (לדרופדאון תלוי)
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

startSession();
if (!isLoggedIn()) { http_response_code(401); echo json_encode([]); exit; }

header('Content-Type: application/json; charset=utf-8');

$db       = getDB();
$clientId = (int)($_GET['client_id'] ?? 0);

if (!$clientId) { echo json_encode([]); exit; }

$stmt = $db->prepare("SELECT id, name FROM courses WHERE client_id=? AND status='active' ORDER BY name");
$stmt->execute([$clientId]);
echo json_encode($stmt->fetchAll());
