<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db     = getDB();
$search = trim($_GET['q'] ?? '');
$flash  = getFlash();

$sql = "
  SELECT c.*, COUNT(DISTINCT co.id) AS course_count
  FROM clients c
  LEFT JOIN courses co ON co.client_id = c.id
";
$params = [];
if ($search !== '') {
    $sql .= " WHERE c.name LIKE ? OR c.email LIKE ?";
    $params = ["%$search%", "%$search%"];
}
$sql .= " GROUP BY c.id ORDER BY c.created_at DESC";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$clients = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>לקוחות — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('clients'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>ניהול לקוחות</h2>
      <div class="topbar-actions">
        <a href="/admin/clients/add.php" class="btn btn-primary btn-sm">+ הוסף לקוח</a>
      </div>
    </div>
    <div class="page-body">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] ?>" data-auto-dismiss><?= escape($flash['msg']) ?></div>
      <?php endif; ?>

      <div class="search-bar">
        <form method="GET" style="display:flex;gap:10px;align-items:center;">
          <input type="text" name="q" value="<?= escape($search) ?>" class="form-control" placeholder="חיפוש לפי שם / מייל..." style="max-width:300px;">
          <button type="submit" class="btn btn-ghost btn-sm">חיפוש</button>
          <?php if ($search): ?><a href="list.php" class="btn btn-ghost btn-sm">נקה</a><?php endif; ?>
        </form>
      </div>

      <div class="card">
        <?php if (empty($clients)): ?>
          <div class="empty-state"><p>לא נמצאו לקוחות.</p></div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם</th>
                  <th>מייל</th>
                  <th>טלפון</th>
                  <th>תאריך כניסה</th>
                  <th>מנוי</th>
                  <th>קורסים</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($clients as $c): ?>
                  <tr>
                    <td><a href="/admin/clients/view.php?id=<?= $c['id'] ?>"><?= escape($c['name']) ?></a></td>
                    <td class="text-muted"><?= escape($c['email']) ?></td>
                    <td class="text-muted"><?= escape($c['phone'] ?? '—') ?></td>
                    <td class="text-muted"><?= formatDate($c['join_date']) ?></td>
                    <td>
                      <span class="badge badge-<?= match($c['subscription_type']) { 'enterprise' => 'purple', 'pro' => 'green', default => 'gray' } ?>">
                        <?= subscriptionLabel($c['subscription_type']) ?>
                      </span>
                    </td>
                    <td><?= $c['course_count'] ?></td>
                    <td style="display:flex;gap:6px;flex-wrap:wrap;">
                      <a href="/admin/clients/view.php?id=<?= $c['id'] ?>" class="btn btn-ghost btn-sm">צפייה</a>
                      <a href="/admin/clients/edit.php?id=<?= $c['id'] ?>" class="btn btn-outline btn-sm">עריכה</a>
                      <form method="POST" action="/admin/api/delete_client.php" style="display:inline;">
                        <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                        <input type="hidden" name="client_id" value="<?= $c['id'] ?>">
                        <button type="submit" class="btn btn-sm" style="background:#fee2e2;color:#dc2626;border:none;"
                          data-confirm="למחוק את הלקוח &quot;<?= escape(addslashes($c['name'])) ?>&quot;? כל הקורסים, הרכישות והדוחות שלו יימחקו לצמיתות!">
                          מחק
                        </button>
                      </form>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>
<div class="toast-container"></div>
<script src="/admin/assets/script.js"></script>
</body>
</html>
