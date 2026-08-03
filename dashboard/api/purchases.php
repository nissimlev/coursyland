<?php
// API: שליפת רכישות לפי קורס (לשימוש ב-modal)
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';

startSession();
if (!isLoggedIn()) { http_response_code(401); echo json_encode(['error' => 'Unauthorized']); exit; }

header('Content-Type: application/json; charset=utf-8');

$db       = getDB();
$courseId = (int)($_GET['course_id'] ?? 0);
$from     = $_GET['from'] ?? '';
$to       = $_GET['to']   ?? '';

if (!$courseId) { echo json_encode(['purchases' => []]); exit; }

$sql    = "SELECT buyer_name, buyer_email, amount, DATE_FORMAT(purchase_date,'%d/%m/%Y %H:%i') AS purchase_date FROM purchases WHERE course_id=?";
$params = [$courseId];

if ($from) { $sql .= " AND purchase_date >= ?"; $params[] = $from . ' 00:00:00'; }
if ($to)   { $sql .= " AND purchase_date <= ?"; $params[] = $to   . ' 23:59:59'; }
$sql .= " ORDER BY purchase_date DESC";

$stmt = $db->prepare($sql);
$stmt->execute($params);

echo json_encode(['purchases' => $stmt->fetchAll()]);
