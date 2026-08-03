<?php
// סנכרון iCount — ניתן להרצה ידנית או דרך Cron
// Cron: 0 */6 * * * php /path/to/admin/api/icount_sync.php

define('CLI_RUN', php_sapi_name() === 'cli');

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/icount.php';
require_once __DIR__ . '/../includes/functions.php';

if (!CLI_RUN) {
    startSession();
    if (!isLoggedIn()) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
}

try {
    $db     = getDB();
    $icount = new ICountClient();
    $result = $icount->syncAllCourses($db);

    $msg = "סנכרון הושלם: {$result['inserted']} רכישות חדשות, {$result['skipped']} קיימות.";
    if (!empty($result['errors'])) {
        $msg .= ' שגיאות: ' . implode('; ', $result['errors']);
    }

    if (CLI_RUN) {
        echo $msg . PHP_EOL;
    } else {
        echo json_encode(['success' => true, 'message' => $msg, 'data' => $result]);
    }
} catch (Exception $e) {
    $msg = 'שגיאה בסנכרון: ' . $e->getMessage();
    if (CLI_RUN) {
        echo $msg . PHP_EOL;
        exit(1);
    } else {
        echo json_encode(['success' => false, 'message' => $msg]);
    }
}
