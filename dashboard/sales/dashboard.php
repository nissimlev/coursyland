<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db = getDB();

// פילטרים
$clientId  = (int)($_GET['client_id'] ?? 0);
$courseId  = (int)($_GET['course_id'] ?? 0);
$dateFrom  = $_GET['date_from'] ?? '';
$dateTo    = $_GET['date_to']   ?? '';

// רשימות לדרופדאון
$clients = $db->query("SELECT id, name FROM clients ORDER BY name")->fetchAll();
$courses = [];
if ($clientId) {
    $stmt = $db->prepare("SELECT id, name FROM courses WHERE client_id=? ORDER BY name");
    $stmt->execute([$clientId]);
    $courses = $stmt->fetchAll();
}

// שאילתת מכירות
$sql    = "SELECT p.*, c.name AS course_name, cl.id AS client_id, cl.name AS client_name
           FROM purchases p
           JOIN courses c  ON p.course_id   = c.id
           JOIN clients cl ON c.client_id   = cl.id
           WHERE 1=1";
$params = [];
if ($clientId) { $sql .= " AND cl.id=?";      $params[] = $clientId; }
if ($courseId) { $sql .= " AND c.id=?";       $params[] = $courseId; }
if ($dateFrom) { $sql .= " AND p.purchase_date >= ?"; $params[] = $dateFrom . ' 00:00:00'; }
if ($dateTo)   { $sql .= " AND p.purchase_date <= ?"; $params[] = $dateTo   . ' 23:59:59'; }
$sql .= " ORDER BY p.purchase_date DESC";

$stmt     = $db->prepare($sql);
$stmt->execute($params);
$purchases = $stmt->fetchAll();

$totalCount  = count($purchases);
$totalAmount = array_sum(array_column($purchases, 'amount'));
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>מכירות — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('sales'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>דשבורד מכירות</h2>
      <div class="topbar-actions">
        <button class="btn btn-primary btn-sm" onclick="syncICount()">⟳ סנכרן מ-iCount</button>
      </div>
    </div>
    <div class="page-body">
      <div id="syncMessage"></div>

      <!-- פילטרים -->
      <div class="card">
        <form method="GET" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;min-width:180px;">
            <label>לקוח</label>
            <select name="client_id" id="filter-client" class="form-control">
              <option value="">כל הלקוחות</option>
              <?php foreach ($clients as $c): ?>
                <option value="<?= $c['id'] ?>" <?= $c['id'] === $clientId ? 'selected' : '' ?>><?= escape($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group" style="margin:0;min-width:180px;">
            <label>קורס</label>
            <select name="course_id" id="filter-course" class="form-control">
              <option value="">כל הקורסים</option>
              <?php foreach ($courses as $c): ?>
                <option value="<?= $c['id'] ?>" <?= $c['id'] === $courseId ? 'selected' : '' ?>><?= escape($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label>מתאריך</label>
            <input type="date" name="date_from" value="<?= escape($dateFrom) ?>" class="form-control">
          </div>
          <div class="form-group" style="margin:0;">
            <label>עד תאריך</label>
            <input type="date" name="date_to" value="<?= escape($dateTo) ?>" class="form-control">
          </div>
          <button type="submit" class="btn btn-primary btn-sm" style="margin-bottom:0;">סנן</button>
          <a href="dashboard.php" class="btn btn-ghost btn-sm" style="margin-bottom:0;">נקה</a>
        </form>
      </div>

      <!-- טבלת מכירות -->
      <div class="card">
        <div class="card-header">
          <h3>רכישות</h3>
          <div class="text-muted text-small">
            <?= $totalCount ?> עסקאות | <?= formatMoney($totalAmount) ?>
          </div>
        </div>
        <?php if (empty($purchases)): ?>
          <div class="empty-state"><p>לא נמצאו רכישות בהתאם לפילטר.</p></div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>שם קונה</th>
                  <th>מייל</th>
                  <th>קורס</th>
                  <th>לקוח</th>
                  <th>סכום</th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($purchases as $p): ?>
                  <tr>
                    <td class="text-muted text-small"><?= formatDateTime($p['purchase_date']) ?></td>
                    <td><?= escape($p['buyer_name'] ?: '—') ?></td>
                    <td class="text-muted text-small"><?= escape($p['buyer_email'] ?: '—') ?></td>
                    <td><?= escape($p['course_name']) ?></td>
                    <td>
                      <a href="/admin/clients/view.php?id=<?= $p['client_id'] ?>"><?= escape($p['client_name']) ?></a>
                    </td>
                    <td><strong><?= formatMoney((float)$p['amount']) ?></strong></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <!-- סיכום -->
          <div style="padding:14px;border-top:1px solid var(--gray-100);display:flex;gap:32px;font-weight:600;">
            <span>סה"כ עסקאות: <?= $totalCount ?></span>
            <span>סה"כ הכנסה: <?= formatMoney($totalAmount) ?></span>
          </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>
<div class="toast-container"></div>
<script src="/admin/assets/script.js"></script>
<script>
async function syncICount() {
  const btn = document.querySelector('[onclick="syncICount()"]');
  btn.disabled = true;
  btn.textContent = 'מסנכרן...';
  const msgEl = document.getElementById('syncMessage');
  msgEl.innerHTML = '<div class="alert alert-info">מבצע סנכרון עם iCount, אנא המתן...</div>';
  try {
    const res  = await fetch('/admin/api/icount_sync.php');
    const data = await res.json();
    msgEl.innerHTML = `<div class="alert alert-${data.success ? 'success' : 'error'}" data-auto-dismiss>${data.message}</div>`;
    if (data.success) setTimeout(() => location.reload(), 2000);
  } catch(e) {
    msgEl.innerHTML = '<div class="alert alert-error">שגיאה בסנכרון.</div>';
  }
  btn.disabled = false;
  btn.textContent = '⟳ סנכרן מ-iCount';
}
</script>
</body>
</html>
