<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); die('Method Not Allowed'); }
verifyCsrf();

$id = (int)($_POST['course_id'] ?? 0);
if (!$id) { flashMessage('error', 'מזהה קורס חסר.'); redirect('/admin/clients/list.php'); }

$db = getDB();

$course = $db->prepare("SELECT name, client_id FROM courses WHERE id=?");
$course->execute([$id]);
$course = $course->fetch();
if (!$course) { flashMessage('error', 'קורס לא נמצא.'); redirect('/admin/clients/list.php'); }

$clientId = $course['client_id'];

$db->prepare("DELETE FROM courses WHERE id=?")->execute([$id]);

flashMessage('success', "הקורס \"{$course['name']}\" נמחק בהצלחה.");
redirect("/admin/clients/view.php?id={$clientId}");
