<?php
require_once __DIR__ . '/config_load.php';

class ICountClient {

    private string $apiKey;
    private string $baseUrl = 'https://api.icount.co.il/api/v3.php';

    public function __construct() {
        $this->apiKey = self::loadApiKey();
        if ($this->apiKey === '') {
            throw new RuntimeException(
                'מפתח iCount לא מוגדר בשרת. צור קובץ icount_login.txt לצד db_login.txt '
                . '(מחוץ ל-public_html) ובו שורה אחת: מפתח ה-API של iCount.'
            );
        }
    }

    /**
     * מפתח ה-API יושב בקובץ שמחוץ ל-public_html, לצד db_login.txt — מקום
     * שהדיפלוי לא נוגע בו. config.php כבר לא במעקב git ויכול לא להיות קיים
     * בשרת, ואז ICOUNT_API_KEY נשאר ריק (ברירת המחדל של config_load.php).
     */
    private static function loadApiKey(): string {
        $file = dirname(__DIR__, 3) . '/icount_login.txt';
        if (is_readable($file)) {
            $key = trim((string)file_get_contents($file));
            if ($key !== '') return $key;
        }
        return trim((string)ICOUNT_API_KEY);
    }

    private function request(string $endpoint, array $body = []): array {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $this->baseUrl . '/' . ltrim($endpoint, '/'),
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->apiKey,
                'Content-Type: application/json',
            ],
        ]);
        $response = curl_exec($ch);
        $err      = curl_error($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($err) throw new RuntimeException("iCount cURL error: $err");
        $data = json_decode($response, true);
        if (!is_array($data)) throw new RuntimeException("iCount invalid JSON (HTTP $httpCode)");

        // iCount מחזיר status=false עם reason כשהבקשה נכשלה (מפתח שגוי, הרשאה וכו').
        // בלי הבדיקה הזו כישלון נראה כמו "אין עסקאות" והסנכרון מדווח הצלחה עם 0.
        if (($data['status'] ?? null) === false || $httpCode >= 400) {
            $reason = $data['reason'] ?? $data['error_description'] ?? $data['message'] ?? 'unknown error';
            throw new RuntimeException("iCount: $reason (HTTP $httpCode)");
        }
        return $data;
    }

    /**
     * שליפת עסקאות לפי טווח תאריכים עם paging
     */
    public function searchDocs(string $fromDate, string $toDate, string $doctype = 'invrec', int $offset = 0): array {
        return $this->request('doc/search', [
            'start_date'   => $fromDate,
            'end_date'     => $toDate,
            'doctype'      => $doctype,
            'detail_level' => 10,
            'max_results'  => 100,
            'limit'        => 100,
            'offset'       => $offset,
            'sort_field'   => 'dateissued',
            'sort_order'   => 'DESC',
        ]);
    }

    /**
     * סנכרון כל הקורסים הפעילים
     * iCount לא מחזיר payment_page_id בעסקאות — מזהים לפי שם/מייל הקונה
     * רכישות שנוצרו דרך עמוד תשלום מקושרות לפי course_id
     */
    public function syncAllCourses(\PDO $db): array {
        $courses = $db->query("SELECT * FROM courses WHERE status='active'")->fetchAll(\PDO::FETCH_ASSOC);
        if (empty($courses)) return ['inserted' => 0, 'skipped' => 0, 'errors' => ['אין קורסים פעילים']];

        $fromDate = date('Y-m-d', strtotime('-30 days'));
        $toDate   = date('Y-m-d');

        $inserted = 0;
        $skipped  = 0;
        $errors   = [];
        $allDocs  = [];

        // שלוף את כל המסמכים עם paging
        $offset = 0;
        do {
            $data = $this->searchDocs($fromDate, $toDate, 'invrec', $offset);
            if (empty($data['results_list'])) break;

            $allDocs = array_merge($allDocs, $data['results_list']);
            $offset += 100;
            $total = (int)($data['results_count'] ?? 0);
        } while ($offset < $total && $offset < 1000);

        // בנה מפה של payment_page_id → course
        $courseByPageId = [];
        foreach ($courses as $course) {
            $courseByPageId[$course['icount_payment_page_id']] = $course;
        }

        // כנס כל עסקה לפי cc_page_id
        foreach ($allDocs as $tx) {
            // שלוף את ה-cc_page_id מתוך custom
            $pageId = $tx['custom']['cc_page_id'] ?? null;

            // אם אין cc_page_id — דלג
            if (!$pageId) continue;

            // מצא את הקורס המתאים
            if (!isset($courseByPageId[$pageId])) continue;

            $course = $courseByPageId[$pageId];
            $amount = (float)($tx['totalwithvat'] ?? $tx['paid'] ?? 0);
            if ($amount <= 0) continue;

            $uniqueId   = 'invrec_' . ($tx['docnum'] ?? '');
            $buyerName  = $tx['client_name'] ?? '';
            $buyerEmail = $tx['email'] ?? '';
            $txDate     = $tx['dateissued'] ?? date('Y-m-d');

            $stmt = $db->prepare("
                INSERT IGNORE INTO purchases
                    (course_id, icount_transaction_id, buyer_name, buyer_email, amount, purchase_date)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$course['id'], $uniqueId, $buyerName, $buyerEmail, $amount, $txDate]);

            if ($stmt->rowCount() > 0) $inserted++;
            else $skipped++;
        }

        return compact('inserted', 'skipped', 'errors');
    }
}
