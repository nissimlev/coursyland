<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db     = getDB();
$errors = [];
$data   = ['name' => '', 'email' => '', 'phone' => '', 'business_id' => '', 'join_date' => date('Y-m-d'), 'subscription_type' => 'authorized', 'notes' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $data['name']              = trim($_POST['name'] ?? '');
    $data['email']             = trim($_POST['email'] ?? '');
    $data['phone']             = trim($_POST['phone'] ?? '');
    $data['business_id']       = trim($_POST['business_id'] ?? '');
    $data['join_date']         = $_POST['join_date'] ?? date('Y-m-d');
    $data['subscription_type'] = $_POST['subscription_type'] ?? 'authorized';
    $data['notes']             = trim($_POST['notes'] ?? '');

    if (!$data['name'])  $errors[] = 'שם הלקוח הוא שדה חובה.';
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'כתובת מייל לא תקינה.';

    if (empty($errors)) {
        $stmt = $db->prepare("INSERT INTO clients (name, email, phone, business_id, join_date, subscription_type, notes) VALUES (?,?,?,?,?,?,?)");
        $stmt->execute([$data['name'], $data['email'], $data['phone'], $data['business_id'], $data['join_date'], $data['subscription_type'], $data['notes']]);
        flashMessage('success', 'הלקוח נוסף בהצלחה.');
        redirect('/admin/clients/list.php');
    }
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הוספת לקוח — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('clients'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>הוספת לקוח חדש</h2>
      <div class="topbar-actions"><a href="list.php" class="btn btn-ghost btn-sm">← חזרה</a></div>
    </div>
    <div class="page-body">
      <?php foreach ($errors as $e): ?>
        <div class="alert alert-error"><?= escape($e) ?></div>
      <?php endforeach; ?>

      <div class="card" style="max-width:640px;">
        <form method="POST">
          <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
          <div class="form-row">
            <div class="form-group">
              <label>שם מלא *</label>
              <input type="text" name="name" value="<?= escape($data['name']) ?>" class="form-control" required>
            </div>
            <div class="form-group">
              <label>כתובת מייל *</label>
              <input type="email" name="email" value="<?= escape($data['email']) ?>" class="form-control" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>טלפון</label>
              <input type="tel" name="phone" value="<?= escape($data['phone']) ?>" class="form-control">
            </div>
            <div class="form-group">
              <label>מספר ח"פ / עוסק</label>
              <input type="text" name="business_id" value="<?= escape($data['business_id']) ?>" class="form-control" placeholder="123456789">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>תאריך כניסה ל-CoursyLand *</label>
              <input type="date" name="join_date" value="<?= escape($data['join_date']) ?>" class="form-control" required>
            </div>
            <div class="form-group">
              <label>סוג עוסק</label>
              <select name="subscription_type" class="form-control">
                <option value="authorized" <?= $data['subscription_type'] === 'authorized' ? 'selected' : '' ?>>עוסק מורשה (5%)</option>
                <option value="exempt"     <?= $data['subscription_type'] === 'exempt'     ? 'selected' : '' ?>>עוסק פטור (23%)</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>הערות</label>
            <textarea name="notes" class="form-control" rows="3"><?= escape($data['notes']) ?></textarea>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn btn-primary">שמור לקוח</button>
            <a href="list.php" class="btn btn-ghost">ביטול</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
<script src="/admin/assets/script.js"></script>
</body>
</html>
