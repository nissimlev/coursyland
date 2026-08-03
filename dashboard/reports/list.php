<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db = getDB();

// פילטרים
$clientId = (int)($_GET['client_id'] ?? 0);
$quarter  = $_GET['quarter'] ?? '';
$dateFrom = $_GET['date_from'] ?? '';
$dateTo   = $_GET['date_to']   ?? '';
$pending  = (int)($_GET['pending'] ?? 0);

$clients  = $db->query("SELECT id, name FROM clients ORDER BY name")->fetchAll();
$flash    = getFlash();

$sql    = "SELECT r.*, c.name AS client_name FROM reports r JOIN clients c ON r.client_id=c.id WHERE 1=1";
$params = [];
if ($clientId) { $sql .= " AND r.client_id=?";    $params[] = $clientId; }
if ($quarter)  { $sql .= " AND r.quarter LIKE ?";  $params[] = "%$quarter%"; }
if ($dateFrom) { $sql .= " AND r.period_start >= ?"; $params[] = $dateFrom; }
if ($dateTo)   { $sql .= " AND r.period_end   <= ?"; $params[] = $dateTo; }
if ($pending)  { $sql .= " AND r.sent_at IS NULL AND r.pdf_path IS NOT NULL"; }
$sql .= " ORDER BY r.year DESC, r.quarter_number DESC";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$reports = $stmt->fetchAll();

$pendingCount = $db->query("SELECT COUNT(*) FROM reports WHERE sent_at IS NULL AND pdf_path IS NOT NULL")->fetchColumn();
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוחות — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('reports'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>דוחות רבעוניים</h2>
      <div class="topbar-actions">
        <a href="generate.php" class="btn btn-outline btn-sm">+ הפק דוח</a>
        <?php if ($pendingCount > 0): ?>
          <button class="btn btn-primary btn-sm" onclick="sendAllPending()">שלח את כל הממתינים (<?= $pendingCount ?>)</button>
        <?php endif; ?>
      </div>
    </div>
    <div class="page-body">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] ?>" data-auto-dismiss><?= escape($flash['msg']) ?></div>
      <?php endif; ?>

      <div id="bulkMessage"></div>

      <!-- פילטרים -->
      <div class="card">
        <form method="GET" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;min-width:160px;">
            <label>לקוח</label>
            <select name="client_id" class="form-control">
              <option value="">כל הלקוחות</option>
              <?php foreach ($clients as $c): ?>
                <option value="<?= $c['id'] ?>" <?= $c['id'] === $clientId ? 'selected' : '' ?>><?= escape($c['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-group" style="margin:0;">
            <label>רבעון</label>
            <input type="text" name="quarter" value="<?= escape($quarter) ?>" class="form-control" placeholder="2025-Q1" style="max-width:120px;">
          </div>
          <div class="form-group" style="margin:0;">
            <label>מתאריך</label>
            <input type="date" name="date_from" value="<?= escape($dateFrom) ?>" class="form-control">
          </div>
          <div class="form-group" style="margin:0;">
            <label>עד תאריך</label>
            <input type="date" name="date_to" value="<?= escape($dateTo) ?>" class="form-control">
          </div>
          <button type="submit" class="btn btn-primary btn-sm">סנן</button>
          <a href="list.php" class="btn btn-ghost btn-sm">נקה</a>
          <?php if ($pending): ?>
            <span class="badge badge-yellow">מציג ממתינים בלבד</span>
          <?php endif; ?>
        </form>
      </div>

      <div class="card">
        <?php if (empty($reports)): ?>
          <div class="empty-state"><p>לא נמצאו דוחות.</p></div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>לקוח</th>
                  <th>רבעון</th>
                  <th>תאריך שליחה</th>
                  <th>הכנסה</th>
                  <th>נטו</th>
                  <th>חשבונית</th>
                  <th>תשלום</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($reports as $r): ?>
                  <tr>
                    <td><a href="/admin/clients/view.php?id=<?= $r['client_id'] ?>"><?= escape($r['client_name']) ?></a></td>
                    <td><a href="view.php?id=<?= $r['id'] ?>"><?= escape($r['quarter']) ?></a></td>
                    <td>
                      <?php if ($r['sent_at']): ?>
                        <span class="badge badge-green"><?= formatDate($r['sent_at']) ?></span>
                      <?php elseif ($r['pdf_path']): ?>
                        <span class="badge badge-yellow">ממתין</span>
                      <?php else: ?>
                        <span class="badge badge-gray">לא הופק</span>
                      <?php endif; ?>
                    </td>
                    <td><?= formatMoney((float)$r['total_amount']) ?></td>
                    <td><strong><?= formatMoney((float)$r['net_amount']) ?></strong></td>
                    <td>
                      <input type="checkbox" class="invoice-checkbox" data-report-id="<?= $r['id'] ?>" <?= $r['invoice_received'] ? 'checked' : '' ?> title="חשבונית התקבלה">
                    </td>
                    <td>
                      <input type="checkbox" class="paid-checkbox" data-report-id="<?= $r['id'] ?>" <?= $r['is_paid'] ? 'checked' : '' ?> title="סמן כשולם">
                    </td>
                    <td style="display:flex;gap:6px;">
                      <a href="view.php?id=<?= $r['id'] ?>" class="btn btn-ghost btn-sm">צפייה</a>
                      <?php if ($r['pdf_path'] && file_exists($r['pdf_path'])): ?>
                        <?php if (!$r['sent_at']): ?>
                          <form method="POST" action="/admin/api/send_report.php" style="display:inline;">
                            <input type="hidden" name="report_id" value="<?= $r['id'] ?>">
                            <input type="hidden" name="return_url" value="/admin/reports/list.php">
                            <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                            <button type="submit" class="btn btn-primary btn-sm">שלח</button>
                          </form>
                        <?php else: ?>
                          <form method="POST" action="/admin/api/send_report.php" style="display:inline;">
                            <input type="hidden" name="report_id" value="<?= $r['id'] ?>">
                            <input type="hidden" name="return_url" value="/admin/reports/list.php">
                            <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                            <button type="submit" class="btn btn-ghost btn-sm">שלח שוב</button>
                          </form>
                        <?php endif; ?>
                      <?php endif; ?>
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
<script>
// invoice received checkboxes
document.querySelectorAll('.invoice-checkbox').forEach(cb => {
    cb.addEventListener('change', async function() {
        const id = this.dataset.reportId;
        const checked = this.checked ? 1 : 0;
        await fetch('/admin/api/toggle_invoice.php', {
            method: 'POST',
            body: new URLSearchParams({ report_id: id, value: checked, csrf_token: '<?= csrfToken() ?>' })
        });
    });
});

async function sendAllPending() {
  if (!confirm('שלח את כל הדוחות הממתינים? פעולה זו תשלח מייל לכל הלקוחות.')) return;
  const btn = document.querySelector('[onclick="sendAllPending()"]');
  btn.disabled = true;
  btn.textContent = 'שולח...';

  const msgEl = document.getElementById('bulkMessage');
  msgEl.innerHTML = '<div class="alert alert-info"><div class="progress-bar-wrap"><div class="progress-bar" id="bulkProgress" style="width:0%"></div></div><span id="bulkStatus">מתחיל שליחה...</span></div>';

  const res  = await fetch('/admin/api/send_all_pending.php', { method: 'POST', body: new URLSearchParams({ csrf_token: '<?= csrfToken() ?>' }) });
  const data = await res.json();

  msgEl.innerHTML = `<div class="alert alert-${data.success ? 'success' : 'error'}" data-auto-dismiss>${data.message}</div>`;
  if (data.success) setTimeout(() => location.reload(), 2500);
  btn.disabled = false;
}
</script>
</body>
</html>
