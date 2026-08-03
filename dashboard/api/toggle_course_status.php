<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); die(); }
verifyCsrf();

$id = (int)($_POST['course_id'] ?? 0);
if (!$id) { http_response_code(400); die(); }

$db = getDB();
$current = $db->prepare("SELECT status, client_id FROM courses WHERE id=?");
$current->execute([$id]);
$course = $current->fetch();
if (!$course) { http_response_code(404); die(); }

$newStatus = $course['status'] === 'active' ? 'inactive' : 'active';
$db->prepare("UPDATE courses SET status=? WHERE id=?")->execute([$newStatus, $id]);

flashMessage('success', 'סטטוס הקורס עודכן.');
redirect("/admin/clients/view.php?id={$course['client_id']}");
