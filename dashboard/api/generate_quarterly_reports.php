<?php
// Cron: 0 0 1 1,4,7,10 * php /path/to/admin/api/generate_quarterly_reports.php
// מפיק דוחות לכל הלקוחות בתחילת כל רבעון עבור הרבעון שהסתיים

define('CLI_RUN', php_sapi_name() === 'cli');

require_once __DIR__ . '/../includes/db.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/pdf.php';

$db = getDB();

// קבע את הרבעון שהסתיים
$month = (int)date('n');
$year  = (int)date('Y');

// הרבעון שהסתיים (הרצה ב-1 לינואר/אפריל/יולי/אוקטובר)
$prevQuarterMap = [1 => 4, 4 => 1, 7 => 2, 10 => 3];
$quarterNumber  = $prevQuarterMap[$month] ?? null;
$reportYear     = ($month === 1) ? $year - 1 : $year;

if (!$quarterNumber) {
    $msg = "לא ניתן לקבוע רבעון לחודש $month. הרץ ב-1 לינואר/אפריל/יולי/אוקטובר.";
    if (CLI_RUN) { echo $msg . PHP_EOL; exit(1); }
    die($msg);
}

$quarter = "{$reportYear}-Q{$quarterNumber}";
$dates   = quarterDates($reportYear, $quarterNumber);

$clients    = $db->query("SELECT * FROM clients")->fetchAll();
$generated  = 0;
$errors     = [];

foreach ($clients as $client) {
    try {
        // בדוק אם כבר קיים
        $existing = $db->prepare("SELECT id FROM reports WHERE client_id=? AND quarter=?");
        $existing->execute([$client['id'], $quarter]);
        if ($existing->fetch()) { continue; }

        // שלוף רכישות
        $purchasesStmt = $db->prepare("
            SELECT p.*, c.name AS course_name
            FROM purchases p JOIN courses c ON p.course_id = c.id
            WHERE c.client_id=? AND p.purchase_date BETWEEN ? AND ?
        ");
        $purchasesStmt->execute([$client['id'], $dates['start'] . ' 00:00:00', $dates['end'] . ' 23:59:59']);
        $purchases = $purchasesStmt->fetchAll();

        if (empty($purchases)) continue; // לא מפיקים דוח ריק

        $totalSales  = count($purchases);
        $totalAmount = array_sum(array_column($purchases, 'amount'));
        $commRate    = 5.00; // ברירת מחדל — ניתן לשנות לפי לקוח
        $commAmount  = round($totalAmount * $commRate / 100, 2);
        $netAmount   = round($totalAmount - $commAmount, 2);

        $courseBreakdowns = [];
        foreach ($purchases as $p) {
            $cn = $p['course_name'];
            if (!isset($courseBreakdowns[$cn])) $courseBreakdowns[$cn] = ['course_name' => $cn, 'count' => 0, 'total' => 0];
            $courseBreakdowns[$cn]['count']++;
            $courseBreakdowns[$cn]['total'] += $p['amount'];
        }

        $stmt = $db->prepare("INSERT INTO reports (client_id, quarter, year, quarter_number, period_start, period_end, total_sales, total_amount, commission_rate, commission_amount, net_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$client['id'], $quarter, $reportYear, $quarterNumber, $dates['start'], $dates['end'], $totalSales, $totalAmount, $commRate, $commAmount, $netAmount]);
        $reportId = $db->lastInsertId();

        $reportRow = $db->prepare("SELECT * FROM reports WHERE id=?")->execute([$reportId]) ? $db->query("SELECT * FROM reports WHERE id=$reportId")->fetch() : [];
        $pdfPath   = generateReportPDF($reportRow, $client, array_values($courseBreakdowns), $purchases);
        $db->prepare("UPDATE reports SET pdf_path=? WHERE id=?")->execute([$pdfPath, $reportId]);

        $generated++;
    } catch (Exception $e) {
        $errors[] = "{$client['name']}: " . $e->getMessage();
    }
}

$msg = "הופקו $generated דוחות ל-$quarter.";
if ($errors) $msg .= ' שגיאות: ' . implode('; ', $errors);

if (CLI_RUN) {
    echo $msg . PHP_EOL;
} else {
    header('Content-Type: application/json');
    echo json_encode(['success' => empty($errors), 'message' => $msg]);
}
