<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db   = getDB();
$id   = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT * FROM courses WHERE id=?");
$stmt->execute([$id]);
$data = $stmt->fetch();
if (!$data) { http_response_code(404); die('קורס לא נמצא.'); }

$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $data['name']                  = trim($_POST['name'] ?? '');
    $data['icount_payment_page_id'] = trim($_POST['icount_payment_page_id'] ?? '');
    $data['price']                 = trim($_POST['price'] ?? '');
    $data['status']                = $_POST['status'] ?? 'active';

    if (!$data['name']) $errors[] = 'שם הקורס הוא שדה חובה.';

    if (empty($errors)) {
        $stmt2 = $db->prepare("UPDATE courses SET name=?, icount_payment_page_id=?, price=?, status=? WHERE id=?");
        $stmt2->execute([$data['name'], $data['icount_payment_page_id'], $data['price'] ?: null, $data['status'], $id]);
        flashMessage('success', 'הקורס עודכן בהצלחה.');
        redirect("/admin/clients/view.php?id={$data['client_id']}");
    }
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>עריכת קורס — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('clients'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>עריכת קורס: <?= escape($data['name']) ?></h2>
      <div class="topbar-actions">
        <a href="/admin/clients/view.php?id=<?= $data['client_id'] ?>" class="btn btn-ghost btn-sm">← חזרה</a>
      </div>
    </div>
    <div class="page-body">
      <?php foreach ($errors as $e): ?>
        <div class="alert alert-error"><?= escape($e) ?></div>
      <?php endforeach; ?>

      <div class="card" style="max-width:640px;">
        <form method="POST">
          <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
          <div class="form-group">
            <label>שם הקורס *</label>
            <input type="text" name="name" value="<?= escape($data['name']) ?>" class="form-control" required>
          </div>
          <div class="form-group">
            <label>מזהה דף תשלום iCount *</label>
            <input type="text" name="icount_payment_page_id" value="<?= escape($data['icount_payment_page_id']) ?>" class="form-control" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>מחיר (₪)</label>
              <input type="number" step="0.01" name="price" value="<?= escape($data['price'] ?? '') ?>" class="form-control">
            </div>
            <div class="form-group">
              <label>סטטוס</label>
              <select name="status" class="form-control">
                <option value="active"   <?= $data['status'] === 'active' ? 'selected' : '' ?>>פעיל</option>
                <option value="inactive" <?= $data['status'] === 'inactive' ? 'selected' : '' ?>>לא פעיל</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn btn-primary">שמור שינויים</button>
            <a href="/admin/clients/view.php?id=<?= $data['client_id'] ?>" class="btn btn-ghost">ביטול</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
<script src="/admin/assets/script.js"></script>
</body>
</html>
