<?php
// הפקת דוח PDF עם mPDF
// התקנה: composer require mpdf/mpdf
// או: הורד את mPDF ידנית ל- /vendor/mpdf/

require_once __DIR__ . '/../config.php';

// נסה לטעון mPDF (Composer autoload או ידנית)
$autoloadPaths = [
    __DIR__ . '/../../vendor/autoload.php',
    __DIR__ . '/../vendor/autoload.php',
];
foreach ($autoloadPaths as $path) {
    if (file_exists($path)) { require_once $path; break; }
}

use Mpdf\Mpdf;
use Mpdf\Config\ConfigVariables;
use Mpdf\Config\FontVariables;

function generateReportPDF(array $report, array $client, array $courseBreakdowns, array $purchases): string {
    $defaultConfig = (new ConfigVariables())->getDefaults();
    $fontDirs      = $defaultConfig['fontDir'];

    $defaultFontConfig = (new FontVariables())->getDefaults();
    $fontData          = $defaultFontConfig['fontdata'];

    $mpdf = new Mpdf([
        'mode'          => 'utf-8',
        'format'        => 'A4',
        'orientation'   => 'P',
        'margin_top'    => 20,
        'margin_bottom' => 25,
        'margin_right'  => 15,
        'margin_left'   => 15,
        'fontDir'       => array_merge($fontDirs, [__DIR__ . '/../assets/fonts/']),
        'fontdata'      => array_merge($fontData, [
            'heebo' => [
                'R'  => 'Heebo-Regular.ttf',
                'B'  => 'Heebo-Bold.ttf',
            ],
        ]),
        'default_font'  => 'dejavusans',  // fallback אם אין Heebo
        'direction'     => 'rtl',
    ]);

    $mpdf->SetTitle("דוח מכירות — {$client['name']} — {$report['quarter']}");
    $mpdf->SetAuthor('CoursyLand');

    // Footer
    $mpdf->SetFooter('CoursyLand | ניסים לוי | 054-5409021 || עמוד {PAGENO} מתוך {nbpg}');

    $html = buildReportHTML($report, $client, $courseBreakdowns, $purchases);
    $mpdf->WriteHTML($html);

    // שמירה לקובץ
    $dir = PDF_STORAGE_PATH . $client['id'] . '/';
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $filename = $dir . str_replace('-', '_', $report['quarter']) . '.pdf';
    $mpdf->Output($filename, 'F');

    return $filename;
}

function buildReportHTML(array $report, array $client, array $courseBreakdowns, array $purchases): string {
    $q           = htmlspecialchars($report['quarter'], ENT_QUOTES, 'UTF-8');
    $clientName  = htmlspecialchars($client['name'],    ENT_QUOTES, 'UTF-8');
    $periodStart = date('d/m/Y', strtotime($report['period_start']));
    $periodEnd   = date('d/m/Y', strtotime($report['period_end']));

    $coursesRows = '';
    foreach ($courseBreakdowns as $cb) {
        $coursesRows .= sprintf(
            '<tr><td>%s</td><td style="text-align:center">%d</td><td style="text-align:left">₪%s</td></tr>',
            htmlspecialchars($cb['course_name'], ENT_QUOTES, 'UTF-8'),
            $cb['count'],
            number_format((float)$cb['total'], 2, '.', ',')
        );
    }

    $purchasesRows = '';
    foreach ($purchases as $p) {
        $purchasesRows .= sprintf(
            '<tr><td>%s</td><td>%s</td><td style="text-align:left">₪%s</td></tr>',
            htmlspecialchars(date('d/m/Y H:i', strtotime($p['purchase_date'])), ENT_QUOTES, 'UTF-8'),
            htmlspecialchars($p['buyer_name'] ?: '—', ENT_QUOTES, 'UTF-8'),
            number_format((float)$p['amount'], 2, '.', ',')
        );
    }

    $totalAmount    = number_format((float)$report['total_amount'],    2, '.', ',');
    $commAmount     = number_format((float)$report['commission_amount'], 2, '.', ',');
    $netAmount      = number_format((float)$report['net_amount'],      2, '.', ',');
    $commRate       = $report['commission_rate'];

    return <<<HTML
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: dejavusans, Arial, sans-serif; font-size: 12px; color: #1F2937; direction: rtl; }
  h1 { font-size: 20px; color: #7C3AED; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #4B5563; margin-bottom: 16px; }
  h3 { font-size: 13px; color: #7C3AED; border-bottom: 2px solid #EDE9FE; padding-bottom: 4px; margin: 20px 0 10px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #EDE9FE; color: #5B21B6; padding: 8px; text-align: right; font-size: 11px; }
  td { padding: 7px 8px; border-bottom: 1px solid #F3F4F6; font-size: 11px; }
  .summary-box { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin-top: 16px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
  .total-row { font-weight: bold; font-size: 13px; border-top: 2px solid #7C3AED; margin-top: 8px; padding-top: 8px; }
  .header-logo { color: #7C3AED; font-size: 24px; font-weight: bold; }
</style>
</head>
<body>
  <div class="header-logo">CoursyLand</div>
  <h1>דוח מכירות — {$clientName} — {$q}</h1>
  <h2>תקופה: {$periodStart} עד {$periodEnd}</h2>

  <h3>סיכום לפי קורסים</h3>
  <table>
    <thead><tr><th>שם קורס</th><th>כמות מכירות</th><th>הכנסה ברוטו</th></tr></thead>
    <tbody>{$coursesRows}</tbody>
  </table>

  <h3>פירוט רכישות</h3>
  <table>
    <thead><tr><th>תאריך</th><th>שם קונה</th><th>סכום</th></tr></thead>
    <tbody>{$purchasesRows}</tbody>
  </table>

  <div class="summary-box">
    <div class="summary-row"><span>סה"כ מכירות:</span><span>{$report['total_sales']} עסקאות</span></div>
    <div class="summary-row"><span>סה"כ הכנסה ברוטו:</span><span>₪{$totalAmount}</span></div>
    <div class="summary-row"><span>עמלת CoursyLand ({$commRate}%):</span><span>₪{$commAmount}</span></div>
    <div class="summary-row total-row"><span>לתשלום נטו ללקוח:</span><span>₪{$netAmount}</span></div>
  </div>
</body>
</html>
HTML;
}

/**
 * פונקציה לתצוגת HTML בדפדפן (ללא PDF)
 */
function getReportHTMLPreview(array $report, array $client, array $courseBreakdowns, array $purchases): string {
    return buildReportHTML($report, $client, $courseBreakdowns, $purchases);
}
