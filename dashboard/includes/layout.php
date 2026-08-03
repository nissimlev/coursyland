<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/functions.php';

// currentPage מוגדר בכל קובץ לפני ה-include
$currentPage = $currentPage ?? '';

function renderHead(string $title): void { ?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= csrfToken() ?>">
  <title><?= escape($title) ?> — CoursyLand Admin</title>
  <link rel="stylesheet" href="/admin/assets/style.css">
</head>
<body>
<?php } ?>
<?php function renderSidebar(string $active = ''): void { ?>
<aside class="sidebar">
  <div class="sidebar-logo">
    <h1>CoursyLand</h1>
    <span>מערכת ניהול</span>
  </div>
  <nav class="sidebar-nav">
    <a href="/admin/index.php" class="nav-item <?= $active === 'dashboard' ? 'active' : '' ?>">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      דשבורד
    </a>
    <a href="/admin/clients/list.php" class="nav-item <?= $active === 'clients' ? 'active' : '' ?>">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      לקוחות
    </a>
    <a href="/admin/sales/dashboard.php" class="nav-item <?= $active === 'sales' ? 'active' : '' ?>">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
      מכירות
    </a>
    <a href="/admin/reports/list.php" class="nav-item <?= $active === 'reports' ? 'active' : '' ?>">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      דוחות
    </a>
  </nav>
  <div class="sidebar-footer">
    <div>ניסים לוי · CoursyLand</div>
    <a href="/admin/logout.php" style="color:var(--red);font-size:.8rem;">יציאה</a>
  </div>
</aside>
<?php }

function renderPageStart(string $title, string $active = ''): void {
    renderHead($title);
    echo '<div class="layout">';
    renderSidebar($active);
    echo '<div class="main-content"><div class="topbar"><h2>' . escape($title) . '</h2><div class="topbar-actions">';
}

function renderPageEnd(): void { ?>
    </div></div><!-- topbar -->
    <div class="toast-container"></div>
    <script src="/admin/assets/script.js"></script>
  </div><!-- main-content -->
</div><!-- layout -->
</body>
</html>
<?php }
