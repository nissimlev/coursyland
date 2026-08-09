<?php
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/includes/functions.php';

startSession();

if (isLoggedIn()) {
    redirect('/dashboard/index.php');
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Rate limiting: מקסימום 5 ניסיונות בתוך 5 דקות
    $ip       = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $attempts = $_SESSION['login_attempts'][$ip] ?? [];
    $attempts = array_filter($attempts, fn($t) => $t > time() - 300); // שמור רק ניסיונות מ-5 דקות אחרונות

    if (count($attempts) >= 5) {
        $error = 'יותר מדי ניסיונות כניסה. נסה שוב עוד כמה דקות.';
    } elseif (adminCredentials() === null) {
        // לא סופרים את זה כניסיון כושל — התקלה בשרת, לא אצל המשתמש
        $error = 'קובץ פרטי הכניסה חסר או פגום בשרת.';
    } else {
        $username = $_POST['username'] ?? '';
        $password = $_POST['password'] ?? '';
        if (login($username, $password)) {
            unset($_SESSION['login_attempts'][$ip]);
            redirect('/dashboard/index.php');
        } else {
            $attempts[] = time();
            $_SESSION['login_attempts'][$ip] = array_values($attempts);
            $remaining = 5 - count($attempts);
            $error = "שם משתמש או סיסמה שגויים. נותרו {$remaining} ניסיונות.";
            // עיכוב קל למניעת timing attacks
            usleep(500000); // 0.5 שניות
        }
    }
}
?>
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>כניסה — CoursyLand Admin</title>
  <link rel="stylesheet" href="/dashboard/assets/style.css">
</head>
<body>
<div class="login-page">
  <div class="login-card">
    <div class="logo">
      <h1>CoursyLand</h1>
      <p>מערכת ניהול פנימית</p>
    </div>

    <?php if ($error): ?>
      <div class="alert alert-error" data-auto-dismiss>
        <?= escape($error) ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="">
      <div class="form-group">
        <label for="username">שם משתמש</label>
        <input
          type="text"
          id="username"
          name="username"
          class="form-control"
          autocomplete="username"
          autofocus
          required
          placeholder="הזן שם משתמש"
          value="<?= escape($_POST['username'] ?? '') ?>"
        >
      </div>
      <div class="form-group">
        <label for="password">סיסמה</label>
        <div class="input-group">
          <input
            type="password"
            id="password"
            name="password"
            class="form-control"
            autocomplete="current-password"
            required
            placeholder="הזן סיסמה"
          >
          <button type="button" class="input-icon" data-toggle-password="password" title="הצג/הסתר סיסמה">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;">
        כניסה
      </button>
    </form>
  </div>
</div>
<script src="/dashboard/assets/script.js"></script>
</body>
</html>
