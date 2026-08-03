<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); die('Method Not Allowed'); }
verifyCsrf();

$id = (int)($_POST['client_id'] ?? 0);
if (!$id) { flashMessage('error', 'מזהה לקוח חסר.'); redirect('/admin/clients/list.php'); }

$db = getDB();

// ודא שהלקוח קיים
$client = $db->prepare("SELECT name FROM clients WHERE id=?");
$client->execute([$id]);
$client = $client->fetch();
if (!$client) { flashMessage('error', 'לקוח לא נמצא.'); redirect('/admin/clients/list.php'); }

// מחיקה מדורגת (CASCADE על courses/purchases/reports)
$db->prepare("DELETE FROM clients WHERE id=?")->execute([$id]);

flashMessage('success', "הלקוח \"{$client['name']}\" נמחק בהצלחה.");
redirect('/admin/clients/list.php');
