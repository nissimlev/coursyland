<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';

startSession();
requireLogin();

$db     = getDB();
$id     = (int)($_GET['id'] ?? 0);
$stmt   = $db->prepare("SELECT * FROM clients WHERE id=?");
$stmt->execute([$id]);
$client = $stmt->fetch();
if (!$client) { http_response_code(404); die('לקוח לא נמצא.'); }

// קורסים
$courses = $db->prepare("SELECT * FROM courses WHERE client_id=? ORDER BY created_at DESC");
$courses->execute([$id]);
$courses = $courses->fetchAll();

// דוחות
$reports = $db->prepare("SELECT * FROM reports WHERE client_id=? ORDER BY year DESC, quarter_number DESC");
$reports->execute([$id]);
$reports = $reports->fetchAll();

$flash = getFlash();
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= escape($client['name']) ?> — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/../includes/layout.php'; renderSidebar('clients'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2><?= escape($client['name']) ?></h2>
      <div class="topbar-actions">
        <a href="list.php" class="btn btn-ghost btn-sm">← רשימת לקוחות</a>
        <a href="edit.php?id=<?= $id ?>" class="btn btn-outline btn-sm">עריכה</a>
      </div>
    </div>
    <div class="page-body">
      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] ?>" data-auto-dismiss><?= escape($flash['msg']) ?></div>
      <?php endif; ?>

      <!-- אזור 1: פרטי לקוח -->
      <div class="card">
        <div class="card-header">
          <h3>פרטי לקוח</h3>
          <a href="edit.php?id=<?= $id ?>" class="btn btn-outline btn-sm">עריכה</a>
        </div>
        <div class="form-row">
          <div>
            <p class="text-muted text-small">מייל</p>
            <p><?= escape($client['email']) ?></p>
          </div>
          <div>
            <p class="text-muted text-small">טלפון</p>
            <p><?= escape($client['phone'] ?: '—') ?></p>
          </div>
          <div>
            <p class="text-muted text-small">מספר ח"פ</p>
            <p><?= escape($client['business_id'] ?: '—') ?></p>
          </div>
          <div>
            <p class="text-muted text-small">תאריך כניסה</p>
            <p><?= formatDate($client['join_date']) ?></p>
          </div>
          <div>
            <p class="text-muted text-small">סוג עוסק</p>
            <p>
              <span class="badge badge-<?= $client['subscription_type'] === 'exempt' ? 'yellow' : 'purple' ?>">
                <?= subscriptionLabel($client['subscription_type']) ?>
              </span>
            </p>
          </div>
        </div>
        <?php if ($client['notes']): ?>
          <div class="mt-2">
            <p class="text-muted text-small">הערות</p>
            <p><?= nl2br(escape($client['notes'])) ?></p>
          </div>
        <?php endif; ?>
      </div>

      <!-- אזור 2: קורסים -->
      <div class="card">
        <div class="card-header">
          <h3>קורסים</h3>
          <a href="/admin/courses/add.php?client_id=<?= $id ?>" class="btn btn-primary btn-sm">+ הוסף קורס</a>
        </div>
        <?php if (empty($courses)): ?>
          <div class="empty-state"><p>אין קורסים עדיין. <a href="/admin/courses/add.php?client_id=<?= $id ?>">הוסף קורס ראשון</a></p></div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>שם קורס</th>
                  <th>מזהה iCount</th>
                  <th>מחיר</th>
                  <th>סטטוס</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($courses as $course): ?>
                  <tr>
                    <td><?= escape($course['name']) ?></td>
                    <td class="text-muted text-small"><?= escape($course['icount_payment_page_id']) ?></td>
                    <td><?= $course['price'] ? formatMoney((float)$course['price']) : '—' ?></td>
                    <td>
                      <span class="badge badge-<?= $course['status'] === 'active' ? 'green' : 'gray' ?>">
                        <?= $course['status'] === 'active' ? 'פעיל' : 'לא פעיל' ?>
                      </span>
                    </td>
                    <td style="display:flex;gap:6px;flex-wrap:wrap;">
                      <button class="btn btn-ghost btn-sm" onclick="openPurchasesModal(<?= $course['id'] ?>, '<?= escape(addslashes($course['name'])) ?>')">
                        רכישות
                      </button>
                      <a href="/admin/courses/edit.php?id=<?= $course['id'] ?>" class="btn btn-outline btn-sm">עריכה</a>
                      <!-- הפוך פעיל/לא פעיל -->
                      <form method="POST" action="/admin/api/toggle_course_status.php" style="display:inline;">
                        <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                        <input type="hidden" name="course_id" value="<?= $course['id'] ?>">
                        <button type="submit" class="btn btn-sm"
                          style="background:<?= $course['status']==='active' ? '#fef3c7' : '#d1fae5' ?>;color:<?= $course['status']==='active' ? '#b45309' : '#065f46' ?>;border:none;"
                          data-confirm="<?= $course['status']==='active' ? 'להפוך את הקורס ללא פעיל?' : 'להפעיל מחדש את הקורס?' ?>">
                          <?= $course['status']==='active' ? 'השבת' : 'הפעל' ?>
                        </button>
                      </form>
                      <!-- מחיקה -->
                      <form method="POST" action="/admin/api/delete_course.php" style="display:inline;">
                        <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                        <input type="hidden" name="course_id" value="<?= $course['id'] ?>">
                        <button type="submit" class="btn btn-sm"
                          style="background:#fee2e2;color:#dc2626;border:none;"
                          data-confirm="למחוק את הקורס &quot;<?= escape(addslashes($course['name'])) ?>&quot;? כל הרכישות שלו יימחקו לצמיתות!">
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

      <!-- אזור 3: דוחות רבעוניים -->
      <div class="card">
        <div class="card-header">
          <h3>דוחות רבעוניים</h3>
          <a href="/admin/reports/generate.php?client_id=<?= $id ?>" class="btn btn-outline btn-sm">+ הפק דוח</a>
        </div>
        <?php if (empty($reports)): ?>
          <div class="empty-state"><p>אין דוחות עדיין.</p></div>
        <?php else: ?>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>רבעון</th>
                  <th>תקופה</th>
                  <th>מכירות</th>
                  <th>הכנסה</th>
                  <th>עמלה</th>
                  <th>נטו</th>
                  <th>שליחה</th>
                  <th>חשבונית</th>
                  <th>שולם</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <?php foreach ($reports as $r): ?>
                  <tr>
                    <td>
                      <a href="/admin/reports/view.php?id=<?= $r['id'] ?>">
                        <?= escape($r['quarter']) ?>
                      </a>
                    </td>
                    <td class="text-muted text-small">
                      <?= formatDate($r['period_start']) ?> – <?= formatDate($r['period_end']) ?>
                    </td>
                    <td><?= $r['total_sales'] ?></td>
                    <td><?= formatMoney((float)$r['total_amount']) ?></td>
                    <td class="text-muted text-small"><?= $r['commission_rate'] ?>%</td>
                    <td><strong><?= formatMoney((float)$r['net_amount']) ?></strong></td>
                    <td>
                      <?php if ($r['sent_at']): ?>
                        <span class="badge badge-green">נשלח <?= formatDate($r['sent_at']) ?></span>
                      <?php elseif ($r['pdf_path']): ?>
                        <form method="POST" action="/admin/api/send_report.php" style="display:inline;">
                          <input type="hidden" name="report_id" value="<?= $r['id'] ?>">
                          <input type="hidden" name="csrf_token" value="<?= csrfToken() ?>">
                          <button type="submit" class="btn btn-primary btn-sm">שלח</button>
                        </form>
                      <?php else: ?>
                        <span class="badge badge-yellow">לא הופק</span>
                      <?php endif; ?>
                    </td>
                    <td>
                      <input type="checkbox"
                        class="invoice-checkbox"
                        data-report-id="<?= $r['id'] ?>"
                        <?= $r['invoice_received'] ? 'checked' : '' ?>
                        title="חשבונית התקבלה">
                    </td>
                    <td>
                      <input type="checkbox"
                        class="paid-checkbox"
                        data-report-id="<?= $r['id'] ?>"
                        <?= $r['is_paid'] ? 'checked' : '' ?>
                        title="סמן כשולם">
                    </td>
                    <td>
                      <a href="/admin/reports/view.php?id=<?= $r['id'] ?>" class="btn btn-ghost btn-sm">צפייה</a>
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

<!-- Modal: רכישות קורס -->
<div class="modal-overlay" id="purchasesModal">
  <div class="modal" style="max-width:780px;">
    <div class="modal-header">
      <h3 id="purchasesModalTitle">רכישות</h3>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <!-- פילטר תאריכים -->
      <div class="search-bar" style="margin-bottom:16px;">
        <input type="date" id="dateFrom" class="form-control" style="max-width:160px;" placeholder="מתאריך">
        <input type="date" id="dateTo"   class="form-control" style="max-width:160px;" placeholder="עד תאריך">
        <button class="btn btn-ghost btn-sm" onclick="filterPurchases()">סנן</button>
      </div>
      <div id="purchasesTableWrap">
        <div class="empty-state"><p>טוען...</p></div>
      </div>
      <div id="purchasesSummary" class="mt-2" style="font-weight:600;"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal('purchasesModal')">סגור</button>
    </div>
  </div>
</div>

<div class="toast-container"></div>
<script src="/admin/assets/script.js"></script>
<script>
// invoice checkboxes
document.querySelectorAll('.invoice-checkbox').forEach(cb => {
  cb.addEventListener('change', async function() {
    await fetch('/admin/api/toggle_invoice.php', {
      method: 'POST',
      body: new URLSearchParams({ report_id: this.dataset.reportId, value: this.checked ? 1 : 0, csrf_token: '<?= csrfToken() ?>' })
    });
  });
});

let activeCourseId = null;

function openPurchasesModal(courseId, courseName) {
  activeCourseId = courseId;
  document.getElementById('purchasesModalTitle').textContent = 'רכישות — ' + courseName;
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value   = '';
  openModal('purchasesModal');
  loadPurchases(courseId, '', '');
}

function filterPurchases() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  loadPurchases(activeCourseId, from, to);
}

async function loadPurchases(courseId, from, to) {
  const wrap = document.getElementById('purchasesTableWrap');
  wrap.innerHTML = '<div class="empty-state"><p>טוען...</p></div>';
  let url = `/admin/api/purchases.php?course_id=${courseId}`;
  if (from) url += `&from=${from}`;
  if (to)   url += `&to=${to}`;

  const res  = await fetch(url);
  const data = await res.json();

  if (!data.purchases || data.purchases.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><p>לא נמצאו רכישות.</p></div>';
    document.getElementById('purchasesSummary').textContent = '';
    return;
  }

  let html = `<div class="table-wrap"><table>
    <thead><tr><th>תאריך</th><th>שם קונה</th><th>מייל</th><th>סכום</th></tr></thead><tbody>`;
  data.purchases.forEach(p => {
    html += `<tr>
      <td>${p.purchase_date}</td>
      <td>${p.buyer_name || '—'}</td>
      <td class="text-muted text-small">${p.buyer_email || '—'}</td>
      <td>₪${parseFloat(p.amount).toLocaleString('he-IL', {minimumFractionDigits:2})}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  wrap.innerHTML = html;

  const total = data.purchases.reduce((s, p) => s + parseFloat(p.amount), 0);
  document.getElementById('purchasesSummary').textContent =
    `סה"כ: ${data.purchases.length} רכישות | ₪${total.toLocaleString('he-IL', {minimumFractionDigits:2})}`;
}
</script>
</body>
</html>
