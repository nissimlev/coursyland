<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/db.php';
require_once __DIR__ . '/includes/functions.php';

startSession();
requireLogin();

$db = getDB();

// ===== פילטר =====
$filterMode  = $_GET['filter']  ?? 'month';
$filterYear  = (int)($_GET['year']    ?? date('Y'));
$filterMonth = (int)($_GET['month']   ?? date('n'));
$filterQ     = (int)($_GET['quarter'] ?? (int)ceil(date('n') / 3));

switch ($filterMode) {
    case 'year':
        $periodStart = "{$filterYear}-01-01";
        $periodEnd   = "{$filterYear}-12-31";
        break;
    case 'quarter':
        $qStarts = ['','01-01','04-01','07-01','10-01'];
        $qEnds   = ['','03-31','06-30','09-30','12-31'];
        $periodStart = "{$filterYear}-{$qStarts[$filterQ]}";
        $periodEnd   = "{$filterYear}-{$qEnds[$filterQ]}";
        break;
    default:
        $periodStart = date('Y-m-01', mktime(0,0,0,$filterMonth,1,$filterYear));
        $periodEnd   = date('Y-m-t',  mktime(0,0,0,$filterMonth,1,$filterYear));
}

$hebrewMonths = ['','ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
switch ($filterMode) {
    case 'year':    $periodLabel = "שנת {$filterYear}"; break;
    case 'quarter': $periodLabel = "Q{$filterQ} {$filterYear}"; break;
    default:        $periodLabel = $hebrewMonths[$filterMonth] . ' ' . $filterYear;
}

$ps = $periodStart . ' 00:00:00';
$pe = $periodEnd   . ' 23:59:59';

// ===== נתונים =====
$totalClients   = $db->query("SELECT COUNT(*) FROM clients")->fetchColumn();
$totalCourses   = $db->query("SELECT COUNT(*) FROM courses WHERE status='active'")->fetchColumn();
$pendingReports = $db->query("SELECT COUNT(*) FROM reports WHERE sent_at IS NULL AND pdf_path IS NOT NULL")->fetchColumn();

$periodStats = $db->prepare("SELECT COUNT(*) as cnt, COALESCE(SUM(amount),0) as total FROM purchases WHERE purchase_date BETWEEN ? AND ?");
$periodStats->execute([$ps, $pe]);
$periodData = $periodStats->fetch();

$byTypeStmt = $db->prepare("
    SELECT cl.subscription_type, COALESCE(SUM(p.amount),0) as total
    FROM purchases p JOIN courses c ON p.course_id=c.id JOIN clients cl ON c.client_id=cl.id
    WHERE p.purchase_date BETWEEN ? AND ? GROUP BY cl.subscription_type
");
$byTypeStmt->execute([$ps, $pe]);
$byTypeData = $byTypeStmt->fetchAll(PDO::FETCH_KEY_PAIR);

$totalGross = (float)$periodData['total'];
$totalCommission = 0;
foreach ($byTypeData as $type => $amount) {
    $totalCommission += round($amount * subscriptionCommissionRate($type) / 100, 2);
}
$totalNet = $totalGross - $totalCommission;

// ===== גרף =====
function buildChartData(\PDO $db, string $mode, string $periodStart, string $periodEnd, string $ps, string $pe): array {
    if ($mode === 'month') {
        $stmt = $db->prepare("SELECT DATE(purchase_date) as d, COALESCE(SUM(amount),0) as total FROM purchases WHERE purchase_date BETWEEN ? AND ? GROUP BY DATE(purchase_date)");
        $stmt->execute([$ps, $pe]);
        $raw = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $labels = []; $values = [];
        $cur = new DateTime($periodStart); $end = new DateTime($periodEnd);
        while ($cur <= $end) {
            $labels[] = $cur->format('d/m');
            $values[] = (float)($raw[$cur->format('Y-m-d')] ?? 0);
            $cur->modify('+1 day');
        }
    } elseif ($mode === 'quarter') {
        $stmt = $db->prepare("SELECT YEARWEEK(purchase_date,1) as yw, COALESCE(SUM(amount),0) as total FROM purchases WHERE purchase_date BETWEEN ? AND ? GROUP BY yw ORDER BY yw");
        $stmt->execute([$ps, $pe]);
        $raw = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $labels = []; $values = [];
        $cur = new DateTime($periodStart); $cur->modify('Monday this week'); $end = new DateTime($periodEnd);
        while ($cur <= $end) {
            $labels[] = $cur->format('d/m');
            $values[] = (float)($raw[$cur->format('oW')] ?? 0);
            $cur->modify('+1 week');
        }
    } else {
        $stmt = $db->prepare("SELECT YEAR(purchase_date) as y, MONTH(purchase_date) as m, COALESCE(SUM(amount),0) as total FROM purchases WHERE purchase_date BETWEEN ? AND ? GROUP BY y,m ORDER BY y,m");
        $stmt->execute([$ps, $pe]);
        $raw = [];
        foreach ($stmt->fetchAll() as $r) $raw[$r['y'].'-'.str_pad($r['m'],2,'0',STR_PAD_LEFT)] = (float)$r['total'];
        $heM = ['','ינו','פבר','מרץ','אפר','מאי','יוני','יולי','אוג','ספט','אוק','נוב','דצמ'];
        $labels = []; $values = [];
        $sY=(int)date('Y',strtotime($periodStart)); $eY=(int)date('Y',strtotime($periodEnd));
        $sM=(int)date('n',strtotime($periodStart)); $eM=(int)date('n',strtotime($periodEnd));
        for ($y=$sY;$y<=$eY;$y++) {
            for ($m=($y===$sY?$sM:1); $m<=($y===$eY?$eM:12); $m++) {
                $labels[] = $heM[$m];
                $values[] = $raw[$y.'-'.str_pad($m,2,'0',STR_PAD_LEFT)] ?? 0.0;
            }
        }
    }
    return ['labels'=>$labels,'values'=>$values];
}

$chartResult  = buildChartData($db, $filterMode, $periodStart, $periodEnd, $ps, $pe);
$chartLabels  = json_encode($chartResult['labels']);
$chartValues  = json_encode($chartResult['values']);
$hasChartData = array_sum($chartResult['values']) > 0;

// ===== מובילים =====
$topClients = $db->prepare("SELECT cl.id,cl.name,COUNT(p.id) as sales,COALESCE(SUM(p.amount),0) as total FROM purchases p JOIN courses c ON p.course_id=c.id JOIN clients cl ON c.client_id=cl.id WHERE p.purchase_date BETWEEN ? AND ? GROUP BY cl.id,cl.name ORDER BY total DESC LIMIT 5");
$topClients->execute([$ps,$pe]); $topClients=$topClients->fetchAll();

$topCourses = $db->prepare("SELECT c.name AS course_name,cl.name AS client_name,COUNT(p.id) as sales,COALESCE(SUM(p.amount),0) as total FROM purchases p JOIN courses c ON p.course_id=c.id JOIN clients cl ON c.client_id=cl.id WHERE p.purchase_date BETWEEN ? AND ? GROUP BY c.id,c.name,cl.name ORDER BY sales DESC LIMIT 5");
$topCourses->execute([$ps,$pe]); $topCourses=$topCourses->fetchAll();

$flash = getFlash();
$years = range(date('Y'), 2024);
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= csrfToken() ?>">
  <title>דשבורד — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    /* ===== No-scroll dashboard ===== */
    html, body { height: 100%; overflow: hidden; }

    .main-content { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }

    .topbar { flex-shrink: 0; }

    .db-body {
      flex: 1; overflow: hidden;
      display: flex; flex-direction: column;
      gap: 8px; padding: 10px 20px 10px;
    }

    /* פילטר */
    .db-filter {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 10px; flex-wrap: nowrap;
      background: #fff; border: 1px solid var(--gray-200);
      border-radius: 8px; padding: 8px 14px;
    }
    .filter-mode-btns {
      display: flex; flex-shrink: 0;
      border: 2px solid var(--purple); border-radius: 7px; overflow: hidden;
    }
    .filter-mode-btns a {
      padding: 6px 18px; font-size: .82rem; font-weight: 700;
      color: var(--purple); background: #fff; text-decoration: none;
      border-left: 2px solid var(--purple); transition: all .15s;
      white-space: nowrap;
    }
    .filter-mode-btns a:last-child { border-left: none; }
    .filter-mode-btns a.active { background: var(--purple); color: #fff; }
    .filter-mode-btns a:hover:not(.active) { background: var(--purple-light); }
    .db-filter label { font-size:.8rem; color:var(--gray-500); white-space:nowrap; flex-shrink:0; }
    .db-filter select.form-control { padding:4px 8px; font-size:.8rem; height:auto; flex-shrink:0; }
    .period-badge {
      margin-right: auto; background: var(--purple-light);
      color: var(--purple); font-size:.8rem; font-weight:600;
      padding: 4px 12px; border-radius:20px;
    }

    /* כרטיסי סיכום — שורה אופקית */
    .db-stats {
      flex-shrink: 0;
      display: grid; grid-template-columns: repeat(6,1fr); gap: 8px;
    }
    .db-stat {
      background:#fff; border:1px solid var(--gray-200); border-radius:8px;
      padding: 10px 14px; display:flex; flex-direction:column; gap:2px;
    }
    .db-stat .lbl { font-size:.7rem; color:var(--gray-500); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .db-stat .val { font-size:1.15rem; font-weight:700; color:var(--gray-800); line-height:1.2; }
    .db-stat .val.purple { color:var(--purple); }
    .db-stat .val.green  { color:var(--green); }
    .db-stat .val.yellow { color:var(--yellow); }
    .db-stat .sub { font-size:.68rem; color:var(--gray-400); }

    /* שורה ראשית: גרף + מובילים */
    .db-main {
      flex: 1; min-height: 0;
      display: grid; grid-template-columns: 1fr 340px; gap: 8px;
    }

    /* גרף */
    .db-chart {
      background:#fff; border:1px solid var(--gray-200); border-radius:8px;
      padding: 12px 16px; display:flex; flex-direction:column; min-height:0;
    }
    .db-chart h4 { margin:0 0 8px; font-size:.85rem; color:var(--gray-600); flex-shrink:0; }
    .db-chart .chart-wrap { flex:1; min-height:0; position:relative; }
    .db-chart canvas { position:absolute; inset:0; width:100%!important; height:100%!important; }

    /* מובילים — עמודה ימנית */
    .db-leaders { display:flex; flex-direction:column; gap:8px; min-height:0; }
    .db-leaders-card {
      background:#fff; border:1px solid var(--gray-200); border-radius:8px;
      padding:10px 14px; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden;
    }
    .db-leaders-card h4 { margin:0 0 8px; font-size:.82rem; color:var(--gray-700); flex-shrink:0; }
    .db-leaders-card .leaders-list { flex:1; overflow:hidden; }
    .leader-row {
      display:flex; align-items:center; gap:8px;
      padding: 4px 0; border-bottom:1px solid var(--gray-100); font-size:.78rem;
    }
    .leader-row:last-child { border-bottom:none; }
    .leader-rank { width:18px; text-align:center; font-weight:700; color:var(--purple); font-size:.75rem; flex-shrink:0; }
    .leader-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .leader-name a { color:var(--gray-800); text-decoration:none; }
    .leader-name a:hover { color:var(--purple); }
    .leader-name small { display:block; color:var(--gray-400); font-size:.68rem; }
    .leader-amount { font-weight:600; color:var(--gray-700); white-space:nowrap; font-size:.78rem; }
    .leader-sales { color:var(--gray-400); font-size:.72rem; white-space:nowrap; }

    /* alert ממתינים */
    .db-alert {
      flex-shrink:0; background:#fef3c7; border:1px solid #fbbf24;
      border-radius:8px; padding:7px 14px; font-size:.82rem; display:flex; align-items:center; gap:8px;
    }
    .db-alert a { color:var(--purple); font-weight:600; }
  </style>
</head>
<body>
<div class="layout">
  <?php require_once __DIR__ . '/includes/layout.php'; renderSidebar('dashboard'); ?>
  <div class="main-content">
    <div class="topbar">
      <h2>דשבורד</h2>
      <div class="topbar-actions">
        <?php if ($pendingReports > 0): ?>
          <a href="/admin/reports/list.php?pending=1" class="btn btn-primary btn-sm">🔔 <?= $pendingReports ?> ממתינים</a>
        <?php endif; ?>
      </div>
    </div>

    <div class="db-body">

      <?php if ($flash): ?>
        <div class="alert alert-<?= $flash['type'] ?>" data-auto-dismiss style="flex-shrink:0;margin:0;"><?= escape($flash['msg']) ?></div>
      <?php endif; ?>

      <?php if ($pendingReports > 0): ?>
        <div class="db-alert">
          ⚠️ יש <strong style="margin:0 3px;"><?= $pendingReports ?> דוחות</strong> מוכנים לשליחה.
          <a href="/admin/reports/list.php?pending=1">עבור לדוחות ←</a>
        </div>
      <?php endif; ?>

      <!-- פילטר -->
      <form method="GET" id="filterForm">
        <div class="db-filter">
          <div class="filter-mode-btns">
            <a href="?filter=month&year=<?= $filterYear ?>&month=<?= $filterMonth ?>"  class="<?= $filterMode==='month'   ? 'active':'' ?>">חודש</a>
            <a href="?filter=quarter&year=<?= $filterYear ?>&quarter=<?= $filterQ ?>" class="<?= $filterMode==='quarter' ? 'active':'' ?>">רבעון</a>
            <a href="?filter=year&year=<?= $filterYear ?>"                             class="<?= $filterMode==='year'    ? 'active':'' ?>">שנה</a>
          </div>
          <label>שנה:</label>
          <select name="year" class="form-control" onchange="this.form.submit()">
            <?php foreach ($years as $y): ?>
              <option value="<?= $y ?>" <?= $y===$filterYear?'selected':'' ?>><?= $y ?></option>
            <?php endforeach; ?>
          </select>
          <?php if ($filterMode==='month'): ?>
            <label>חודש:</label>
            <select name="month" class="form-control" onchange="this.form.submit()">
              <?php foreach ($hebrewMonths as $n=>$nm): if(!$n) continue; ?>
                <option value="<?= $n ?>" <?= $n===$filterMonth?'selected':'' ?>><?= $nm ?></option>
              <?php endforeach; ?>
            </select>
          <?php endif; ?>
          <?php if ($filterMode==='quarter'): ?>
            <label>רבעון:</label>
            <select name="quarter" class="form-control" onchange="this.form.submit()">
              <?php foreach([1=>'Q1 ינואר–מרץ',2=>'Q2 אפריל–יוני',3=>'Q3 יולי–ספטמבר',4=>'Q4 אוקטובר–דצמבר'] as $q=>$lbl): ?>
                <option value="<?= $q ?>" <?= $q===$filterQ?'selected':'' ?>><?= $lbl ?></option>
              <?php endforeach; ?>
            </select>
          <?php endif; ?>
          <input type="hidden" name="filter" value="<?= escape($filterMode) ?>">
          <span class="period-badge">📅 <?= escape($periodLabel) ?></span>
        </div>
      </form>

      <!-- כרטיסי סיכום -->
      <div class="db-stats">
        <div class="db-stat">
          <span class="lbl">לקוחות פעילים</span>
          <span class="val purple"><?= $totalClients ?></span>
        </div>
        <div class="db-stat">
          <span class="lbl">קורסים פעילים</span>
          <span class="val"><?= $totalCourses ?></span>
        </div>
        <div class="db-stat">
          <span class="lbl">מכירות</span>
          <span class="val"><?= formatMoney($totalGross) ?></span>
          <span class="sub"><?= $periodData['cnt'] ?> עסקאות</span>
        </div>
        <div class="db-stat">
          <span class="lbl">עמלות CoursyLand</span>
          <span class="val purple"><?= formatMoney($totalCommission) ?></span>
        </div>
        <div class="db-stat">
          <span class="lbl">לתשלום לבעלי קורסים</span>
          <span class="val green"><?= formatMoney($totalNet) ?></span>
        </div>
        <div class="db-stat">
          <span class="lbl">דוחות ממתינים</span>
          <span class="val <?= $pendingReports>0?'yellow':'green' ?>"><?= $pendingReports ?></span>
        </div>
      </div>

      <!-- גרף + מובילים -->
      <div class="db-main">

        <!-- גרף -->
        <div class="db-chart">
          <h4>📊 מכירות — <?= escape($periodLabel) ?></h4>
          <div class="chart-wrap">
            <?php if (!$hasChartData): ?>
              <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--gray-400);font-size:.85rem;">אין נתונים לתקופה זו</div>
            <?php else: ?>
              <canvas id="salesChart"></canvas>
            <?php endif; ?>
          </div>
        </div>

        <!-- מובילים -->
        <div class="db-leaders">

          <!-- לקוחות מובילים -->
          <div class="db-leaders-card">
            <h4>🏆 בעלי קורסים מובילים</h4>
            <div class="leaders-list">
              <?php if (empty($topClients)): ?>
                <div style="color:var(--gray-400);font-size:.8rem;padding:8px 0;">אין נתונים</div>
              <?php else: ?>
                <?php foreach ($topClients as $i => $tc): ?>
                  <div class="leader-row">
                    <span class="leader-rank"><?= $i+1 ?></span>
                    <span class="leader-name"><a href="/admin/clients/view.php?id=<?= $tc['id'] ?>"><?= escape($tc['name']) ?></a></span>
                    <span class="leader-sales"><?= $tc['sales'] ?> מכירות</span>
                    <span class="leader-amount"><?= formatMoney((float)$tc['total']) ?></span>
                  </div>
                <?php endforeach; ?>
              <?php endif; ?>
            </div>
          </div>

          <!-- קורסים מובילים -->
          <div class="db-leaders-card">
            <h4>📈 קורסים נמכרים ביותר</h4>
            <div class="leaders-list">
              <?php if (empty($topCourses)): ?>
                <div style="color:var(--gray-400);font-size:.8rem;padding:8px 0;">אין נתונים</div>
              <?php else: ?>
                <?php foreach ($topCourses as $i => $tc): ?>
                  <div class="leader-row">
                    <span class="leader-rank"><?= $i+1 ?></span>
                    <span class="leader-name">
                      <?= escape($tc['course_name']) ?>
                      <small><?= escape($tc['client_name']) ?></small>
                    </span>
                    <span class="leader-sales"><?= $tc['sales'] ?></span>
                    <span class="leader-amount"><?= formatMoney((float)$tc['total']) ?></span>
                  </div>
                <?php endforeach; ?>
              <?php endif; ?>
            </div>
          </div>

        </div><!-- /db-leaders -->
      </div><!-- /db-main -->

    </div><!-- /db-body -->
  </div>
</div>
<div class="toast-container"></div>
<script src="/admin/assets/script.js"></script>
<?php if ($hasChartData): ?>
<script>
const ctx = document.getElementById('salesChart').getContext('2d');
const gradient = ctx.createLinearGradient(0,0,0,200);
gradient.addColorStop(0,'rgba(124,58,237,0.2)');
gradient.addColorStop(1,'rgba(124,58,237,0)');
new Chart(ctx,{
  type:'line',
  data:{
    labels:<?= $chartLabels ?>,
    datasets:[{
      data:<?= $chartValues ?>,
      borderColor:'rgba(124,58,237,1)',
      borderWidth:2,
      backgroundColor:gradient,
      fill:true,
      tension:0.4,
      pointBackgroundColor:'rgba(124,58,237,1)',
      pointRadius:<?= $filterMode==='month'?2:4 ?>,
      pointHoverRadius:6,
      pointBorderColor:'#fff',
      pointBorderWidth:2
    }]
  },
  options:{
    responsive:true,
    maintainAspectRatio:false,
    interaction:{mode:'index',intersect:false},
    plugins:{
      legend:{display:false},
      tooltip:{
        rtl:true,
        callbacks:{label:c=>' ₪'+c.parsed.y.toLocaleString('he-IL',{minimumFractionDigits:2})}
      }
    },
    scales:{
      y:{
        beginAtZero:true,
        ticks:{font:{size:10},callback:v=>'₪'+v.toLocaleString('he-IL')},
        grid:{color:'rgba(0,0,0,0.04)'}
      },
      x:{
        grid:{display:false},
        ticks:{font:{size:10},maxRotation:0,autoSkip:true,maxTicksLimit:<?= $filterMode==='month'?15:($filterMode==='quarter'?13:12) ?>}
      }
    }
  }
});
</script>
<?php endif; ?>
</body>
</html>
