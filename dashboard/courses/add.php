<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db        = getDB();
$client_id = (int)($_GET['client_id'] ?? $_POST['client_id'] ?? 0);
$errors    = [];
$data      = ['name' => '', 'icount_payment_page_id' => '', 'price' => '', 'status' => 'active'];

// רשימת לקוחות לדרופדאון
$clients = $db->query("SELECT id, name FROM clients ORDER BY name")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $client_id                     = (int)($_POST['client_id'] ?? 0);
    $data['name']                  = trim($_POST['name'] ?? '');
    $data['icount_payment_page_id'] = trim($_POST['icount_payment_page_id'] ?? '');
    $data['price']                 = trim($_POST['price'] ?? '');
    $data['status']                = $_POST['status'] ?? 'active';

    if (!$client_id)          $errors[] = 'בחר לקוח.';
    if (!$data['name'])       $errors[] = 'שם הקורס הוא שדה חובה.';
    if (!$data['icount_payment_page_id']) $errors[] = 'מזהה דף תשלום iCount הוא שדה חובה.';

    if (empty($errors)) {
        $stmt = $db->prepare("INSERT INTO courses (client_id, name, icount_payment_page_id, price, status) VALUES (?,?,?,?,?)");
        $stmt->execute([$client_id, $data['name'], $data['icount_payment_page_id'], $data['price'] ?: null, $data['status']]);
        flashMessage('success', 'הקורס נוסף בהצלחה.');
        redirect("/admin/clients/view.php?id=$client_id");
    }
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>הוספת קורס — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('clients'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>הוספת קורס</h2>
      <div class="topbar-actions">
        <?php if ($client_id): ?>
          <a href="/admin/clients/view.php?id=<?= $client_id ?>" class="btn btn-ghost btn-sm">← חזרה ללקוח</a>
        <?php endif; ?>
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
            <label>לקוח *</label>
            <select name="client_id" class="form-control" required>
              <option value="">בחר לקוח</option>
              <?php foreach ($clients as $c): ?>
                <option value="<?= $c['id'] ?>" <?= $c['id'] === $client_id ? 'selected' : '' ?>><?= escape($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group">
            <label>שם הקורס *</label>
            <input type="text" name="name" value="<?= escape($data['name']) ?>" class="form-control" required>
          </div>
          <div class="form-group">
            <label>מזהה דף תשלום iCount *</label>
            <input type="text" name="icount_payment_page_id" value="<?= escape($data['icount_payment_page_id']) ?>" class="form-control" required placeholder="לדוגמה: pp_abc123">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>מחיר (₪)</label>
              <input type="number" step="0.01" name="price" value="<?= escape($data['price']) ?>" class="form-control" placeholder="0.00">
            </div>
            <div class="form-group">
              <label>סטטוס</label>
              <select name="status" class="form-control">
                <option value="active" <?= $data['status'] === 'active' ? 'selected' : '' ?>>פעיל</option>
                <option value="inactive" <?= $data['status'] === 'inactive' ? 'selected' : '' ?>>לא פעיל</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn btn-primary">שמור קורס</button>
            <a href="<?= $client_id ? "/admin/clients/view.php?id=$client_id" : '/admin/clients/list.php' ?>" class="btn btn-ghost">ביטול</a>
          </div>
        </form>
      </div>
    </div>
  </div>
</div>
<script src="/admin/assets/script.js"></script>
</body>
</html>
