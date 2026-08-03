<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/pdf.php';

startSession();
requireLogin();

$db   = getDB();
$id   = (int)($_GET['id'] ?? 0);
$stmt = $db->prepare("SELECT r.*, c.name AS client_name, c.email AS client_email FROM reports r JOIN clients c ON r.client_id=c.id WHERE r.id=?");
$stmt->execute([$id]);
$report = $stmt->fetch();
if (!$report) { http_response_code(404); die('דוח לא נמצא.'); }

// שלוף לקוח + רכישות + courseBreakdowns
$client = $db->prepare("SELECT * FROM clients WHERE id=?");
$client->execute([$report['client_id']]);
$client = $client->fetch();

$purchasesStmt = $db->prepare("
    SELECT p.*, c.name AS course_name
    FROM purchases p
    JOIN courses c ON p.course_id = c.id
    WHERE c.client_id=? AND p.purchase_date BETWEEN ? AND ?
    ORDER BY p.purchase_date ASC
");
$purchasesStmt->execute([$report['client_id'], $report['period_start'] . ' 00:00:00', $report['period_end'] . ' 23:59:59']);
$purchases = $purchasesStmt->fetchAll();

$courseBreakdowns = [];
foreach ($purchases as $p) {
    $cn = $p['course_name'];
    if (!isset($courseBreakdowns[$cn])) $courseBreakdowns[$cn] = ['course_name' => $cn, 'count' => 0, 'total' => 0];
    $courseBreakdowns[$cn]['count']++;
    $courseBreakdowns[$cn]['total'] += $p['amount'];
}
$courseBreakdowns = array_values($courseBreakdowns);

$flash = getFlash();
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>דוח <?= escape($report['quarter']) ?> — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
  <style>
    .report-preview { background: #fff; border: 1px solid var(--gray-200); border-radius: 8px; padding: 32px; margin-top: 16px; }
    .report-preview h1 { font-size: 1.4rem; color: var(--purple); margin-bottom: 4px; }
    .report-preview h2 { font-size: 1rem; color: var(--gray-600); margin-bottom: 24px; }
    .report-preview h3 { font-size: .95rem; color: var(--purple); border-bottom: 2px solid var(--purple-light); padding-bottom: 4px; margin: 20px 0 10px; }
    .summary-box { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 16px; margin-top: 16px; }
    .summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: .9rem; }
    .summary-total { font-weight: 700; font-size: 1rem; border-top: 2px solid var(--purple); margin-top: 8px; padding-top: 8px; }
  </style>
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('reports'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>דוח: <?= escape($report['client_name']) ?> — <?= escape($report['quarter']) ?></h2>
      <div class="topbar-actions">
        <a href="list.php" class="btn btn-ghost btn-sm">← חזרה</a>
        <?php if ($report['pdf_path'] && file_exists($report['pdf_path'])): ?>
          <a href="/admin/api/download_pdf.php?id=<?= $id ?>" class="btn btn-outline btn-sm">⬇ הורד PDF</a>
        <?php endif; ?>
        <form method="POST" action="/admin/api/send_report.php" style="display:inline;">
          <input type="hidden" name="report_id" value="<?= $id ?>">
          <input type="hidden" name="return_url" value="/admin/reports/view.php?id=<?= $id ?>">
          <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
          <button type="submit" class="btn btn-primary btn-sm">
            <?= $report['sent_at'] ? 'שלח שוב' : 'שלח ללקוח' ?>
          </button>
        </form>
      </div>
    </div>
    <div class="page-body">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] ?>" data-auto-dismiss><?= escape($flash['msg']) ?></div>
      <?php endif; ?>

      <!-- מטא-דוח -->
      <div class="card">
        <div style="display:flex;gap:40px;flex-wrap:wrap;">
          <div><p class="text-muted text-small">לקוח</p><strong><?= escape($report['client_name']) ?></strong></div>
          <div><p class="text-muted text-small">מייל</p><?= escape($report['client_email']) ?></div>
          <div><p class="text-muted text-small">תקופה</p><?= formatDate($report['period_start']) ?> – <?= formatDate($report['period_end']) ?></div>
          <div>
            <p class="text-muted text-small">סטטוס שליחה</p>
            <?php if ($report['sent_at']): ?>
              <span class="badge badge-green">נשלח <?= formatDateTime($report['sent_at']) ?></span>
            <?php else: ?>
              <span class="badge badge-yellow">טרם נשלח</span>
            <?php endif; ?>
          </div>
          <div>
            <p class="text-muted text-small">שולם</p>
            <input type="checkbox" class="paid-checkbox" data-report-id="<?= $id ?>" <?= $report['is_paid'] ? 'checked' : '' ?>>
          </div>
        </div>
      </div>

      <!-- תצוגה מקדימה -->
      <div class="report-preview">
        <div style="font-size:1.4rem;font-weight:700;color:var(--purple);">CoursyLand</div>
        <h1>דוח מכירות — <?= escape($report['client_name']) ?> — <?= escape($report['quarter']) ?></h1>
        <h2>תקופה: <?= formatDate($report['period_start']) ?> עד <?= formatDate($report['period_end']) ?></h2>

        <h3>סיכום לפי קורסים</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>שם קורס</th><th>כמות מכירות</th><th>הכנסה ברוטו</th></tr></thead>
            <tbody>
              <?php foreach ($courseBreakdowns as $cb): ?>
                <tr>
                  <td><?= escape($cb['course_name']) ?></td>
                  <td><?= $cb['count'] ?></td>
                  <td><?= formatMoney((float)$cb['total']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <h3>פירוט רכישות</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>תאריך</th><th>שם קונה</th><th>סכום</th></tr></thead>
            <tbody>
              <?php foreach ($purchases as $p): ?>
                <tr>
                  <td><?= formatDateTime($p['purchase_date']) ?></td>
                  <td><?= escape($p['buyer_name'] ?: '—') ?></td>
                  <td><?= formatMoney((float)$p['amount']) ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>

        <div class="summary-box">
          <div class="summary-row"><span>סה"כ מכירות:</span><span><?= $report['total_sales'] ?> עסקאות</span></div>
          <div class="summary-row"><span>סה"כ הכנסה ברוטו:</span><span><?= formatMoney((float)$report['total_amount']) ?></span></div>
          <div class="summary-row"><span>עמלת CoursyLand (<?= $report['commission_rate'] ?>%):</span><span><?= formatMoney((float)$report['commission_amount']) ?></span></div>
          <div class="summary-row summary-total"><span>לתשלום נטו ללקוח:</span><span><?= formatMoney((float)$report['net_amount']) ?></span></div>
        </div>

        <div style="margin-top:24px;color:var(--gray-400);font-size:.8rem;border-top:1px solid var(--gray-200);padding-top:12px;">
          CoursyLand | ניסים לוי | 054-5409021
        </div>
      </div>
    </div>
  </div>
</div>
<div class="toast-container"></div>
<script src="/admin/assets/script.js"></script>
</body>
</html>
