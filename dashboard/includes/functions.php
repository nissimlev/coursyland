<?php
function formatMoney(float $amount): string {
    return '₪' . number_format($amount, 2, '.', ',');
}

function formatDate(string $date): string {
    if (!$date || $date === '0000-00-00') return '—';
    return date('d/m/Y', strtotime($date));
}

function formatDateTime(string $dt): string {
    if (!$dt) return '—';
    return date('d/m/Y H:i', strtotime($dt));
}

function quarterLabel(int $year, int $q): string {
    $names = ['', 'ינואר–מרץ', 'אפריל–יוני', 'יולי–ספטמבר', 'אוקטובר–דצמבר'];
    return "Q{$q} {$year} ({$names[$q]})";
}

function quarterDates(int $year, int $q): array {
    $starts = ['', '01-01', '04-01', '07-01', '10-01'];
    $ends   = ['', '03-31', '06-30', '09-30', '12-31'];
    return [
        'start' => "{$year}-{$starts[$q]}",
        'end'   => "{$year}-{$ends[$q]}",
    ];
}

function currentQuarter(): array {
    $month = (int)date('n');
    $year  = (int)date('Y');
    $q     = (int)ceil($month / 3);
    return ['year' => $year, 'quarter' => $q];

}

function escape(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function redirect(string $url): void {
    header("Location: $url");
    exit;
}

function flashMessage(string $type, string $msg): void {
    $_SESSION['flash'] = ['type' => $type, 'msg' => $msg];
}

function getFlash(): ?array {
    if (!empty($_SESSION['flash'])) {
        $f = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $f;
    }
    return null;
}

function subscriptionLabel(string $type): string {
    return match($type) {
        'authorized' => 'עוסק מורשה',
        'exempt'     => 'עוסק פטור',
        // ערכים ישנים לתאימות לאחור
        'basic'      => 'עוסק מורשה',
        'pro'        => 'עוסק מורשה',
        'enterprise' => 'עוסק מורשה',
        default      => $type,
    };
}

function subscriptionCommissionRate(string $type): float {
    return match($type) {
        'exempt' => 23.00,
        default  => 5.00,   // authorized + כל ערך אחר
    };
}

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $token = $_POST['csrf_token'] ?? '';
    if (!hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        http_response_code(403);
        die('בקשה לא חוקית.');
    }
}
