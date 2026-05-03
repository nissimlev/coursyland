<?php
/* ── Simple access guard ── */
if (($_GET['key'] ?? '') !== 'csl-debug-2026') {
    http_response_code(403);
    exit('Forbidden');
}

header('Content-Type: text/html; charset=utf-8');

function ok($msg)   { return '<span style="color:#16a34a">✔ ' . htmlspecialchars($msg) . '</span>'; }
function fail($msg) { return '<span style="color:#dc2626">✘ ' . htmlspecialchars($msg) . '</span>'; }
function warn($msg) { return '<span style="color:#d97706">⚠ ' . htmlspecialchars($msg) . '</span>'; }

echo '<!DOCTYPE html><html dir="ltr"><head><meta charset="UTF-8">
<title>Coursyland Debug</title>
<style>
  body{font-family:monospace;background:#0d0d14;color:#e2e0f0;padding:2rem;line-height:2}
  h2{color:#9b6dff;margin:1.5rem 0 .5rem;border-bottom:1px solid #333;padding-bottom:.3rem}
  table{border-collapse:collapse;width:100%}
  td{padding:.25rem .6rem;border:1px solid #2a2a3a}
  td:first-child{color:#9b6dff;width:220px}
  pre{background:#1a1a2e;padding:1rem;border-radius:8px;overflow:auto;font-size:.85rem}
</style></head><body>';

echo '<h1 style="color:#c084fc">🔍 Coursyland Debug Panel</h1>';

/* ════ 1. PHP Environment ════ */
echo '<h2>1. PHP Environment</h2><table>';
echo '<tr><td>PHP version</td><td>' . phpversion() . '</td></tr>';
echo '<tr><td>PHP_BINARY</td><td>' . (PHP_BINARY ?: warn('empty')) . '</td></tr>';
echo '<tr><td>SAPI</td><td>' . php_sapi_name() . '</td></tr>';
echo '<tr><td>max_execution_time</td><td>' . ini_get('max_execution_time') . 's</td></tr>';
echo '<tr><td>memory_limit</td><td>' . ini_get('memory_limit') . '</td></tr>';
echo '<tr><td>post_max_size</td><td>' . ini_get('post_max_size') . '</td></tr>';
echo '</table>';

/* ════ 2. Function availability ════ */
echo '<h2>2. Required Functions</h2><table>';
$fns = ['exec','shell_exec','system','proc_open','curl_init','curl_exec','file_put_contents','mkdir'];
foreach ($fns as $fn) {
    $disabled = array_map('trim', explode(',', ini_get('disable_functions')));
    $avail = function_exists($fn) && !in_array($fn, $disabled);
    echo '<tr><td>' . $fn . '()</td><td>' . ($avail ? ok('available') : fail('disabled')) . '</td></tr>';
}
echo '</table>';

/* ════ 3. Directory permissions ════ */
echo '<h2>3. Directory Permissions</h2><table>';
$dirs = [
    'jobs/'       => __DIR__ . '/jobs',
    'pages/'      => __DIR__ . '/pages',
    'pages/assets/' => __DIR__ . '/pages/assets',
];
foreach ($dirs as $label => $path) {
    if (!is_dir($path)) {
        echo '<tr><td>' . $label . '</td><td>' . fail('does not exist') . '</td></tr>';
        continue;
    }
    $testFile = $path . '/.write_test_' . time();
    $writable = @file_put_contents($testFile, 'test') !== false;
    if ($writable) @unlink($testFile);
    echo '<tr><td>' . $label . '</td><td>' . ($writable ? ok('writable') : fail('not writable')) . '</td></tr>';
}
echo '</table>';

/* ════ 4. .env & API key ════ */
echo '<h2>4. API Key</h2><table>';
$envPath = __DIR__ . '/.env';
echo '<tr><td>.env exists</td><td>' . (file_exists($envPath) ? ok('yes') : fail('missing')) . '</td></tr>';
$apiKey = '';
if (file_exists($envPath)) {
    foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        [$k, $v] = array_pad(explode('=', $line, 2), 2, '');
        if (trim($k) === 'ANTHROPIC_API_KEY') { $apiKey = trim($v); break; }
    }
    $keyOk = !empty($apiKey) && $apiKey !== 'your_key_here';
    echo '<tr><td>ANTHROPIC_API_KEY</td><td>' . ($keyOk ? ok('set (' . substr($apiKey,0,12) . '...)') : fail('missing or placeholder')) . '</td></tr>';
}
echo '</table>';

/* ════ 5. Anthropic API connectivity ════ */
echo '<h2>5. Anthropic API Connectivity</h2>';
if (!empty($apiKey) && $apiKey !== 'your_key_here') {
    $ch = curl_init('https://api.anthropic.com/v1/models');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_HTTPHEADER     => ['x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'],
    ]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr  = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        echo '<table><tr><td>Result</td><td>' . fail('cURL error: ' . $curlErr) . '</td></tr></table>';
    } else {
        echo '<table><tr><td>HTTP status</td><td>' . ($httpCode === 200 ? ok($httpCode . ' OK') : fail($httpCode)) . '</td></tr></table>';
    }
} else {
    echo '<p>' . warn('Skipped — API key not set') . '</p>';
}

/* ════ 6. Background process ════ */
echo '<h2>6. Background Process</h2><table>';

/* PHP CLI binary candidates */
$phpCandidates = ['/opt/alt/php83/usr/bin/php','/usr/bin/php83','/usr/bin/php8.3','/usr/bin/php',PHP_BINARY];
$phpCli = '';
foreach ($phpCandidates as $c) { if (is_executable($c)) { $phpCli = $c; break; } }
echo '<tr><td>PHP CLI binary</td><td>' . ($phpCli ? ok($phpCli) : fail('none found — curl fallback only')) . '</td></tr>';

/* proc_open spawn test */
if (function_exists('proc_open') && $phpCli) {
    $tmpOut = tempnam(sys_get_temp_dir(), 'csl');
    $cmd    = escapeshellcmd($phpCli) . ' -r ' . escapeshellarg('file_put_contents("'.$tmpOut.'","proc_ok");') . ' > /dev/null 2>&1 &';
    $desc   = [0 => ['pipe','r'], 1 => ['file','/dev/null','w'], 2 => ['file','/dev/null','w']];
    $proc   = @proc_open('/bin/sh -c ' . escapeshellarg($cmd), $desc, $pipes);
    if (is_resource($proc)) {
        fclose($pipes[0]);
        proc_close($proc);
        sleep(2);
        $result = @file_get_contents($tmpOut);
        @unlink($tmpOut);
        echo '<tr><td>proc_open spawn</td><td>' . ($result === 'proc_ok' ? ok('works') : fail('spawned but script did not write output (may still work)')) . '</td></tr>';
    } else {
        echo '<tr><td>proc_open spawn</td><td>' . fail('proc_open returned false') . '</td></tr>';
    }
} elseif (!function_exists('proc_open')) {
    echo '<tr><td>proc_open()</td><td>' . fail('disabled') . '</td></tr>';
} else {
    echo '<tr><td>proc_open spawn</td><td>' . warn('skipped — no CLI PHP binary found') . '</td></tr>';
}
echo '</table>';

/* ════ 7. Existing jobs ════ */
echo '<h2>7. Recent Jobs (last 10)</h2>';
$jobsDir = __DIR__ . '/jobs';
$jobFiles = glob($jobsDir . '/*.json') ?: [];
usort($jobFiles, fn($a,$b) => filemtime($b) - filemtime($a));
$jobFiles = array_slice($jobFiles, 0, 10);

if (empty($jobFiles)) {
    echo '<p>' . warn('No job files found in /jobs/') . '</p>';
} else {
    echo '<table><tr style="color:#9b6dff"><td>Job ID</td><td>Status</td><td>Age</td><td>Error / URL</td></tr>';
    foreach ($jobFiles as $f) {
        $d    = json_decode(file_get_contents($f), true) ?? [];
        $age  = time() - ($d['created_at'] ?? time());
        $mins = floor($age/60); $secs = $age % 60;
        $ageStr = $mins ? "{$mins}m {$secs}s ago" : "{$secs}s ago";
        $status = $d['status'] ?? '?';
        $statusHtml = match($status) {
            'done'       => ok('done'),
            'error'      => fail('error'),
            'processing' => warn('processing'),
            default      => warn($status),
        };
        $detail = $d['url'] ?? $d['error'] ?? '—';
        echo '<tr><td style="font-size:.8rem">' . htmlspecialchars(basename($f, '.json')) . '</td>'
           . '<td>' . $statusHtml . '</td>'
           . '<td>' . $ageStr . '</td>'
           . '<td style="font-size:.82rem">' . htmlspecialchars(substr($detail, 0, 80)) . '</td></tr>';
    }
    echo '</table>';
}

/* ════ 8. Trigger test job ════ */
if (isset($_GET['test_job'])) {
    echo '<h2>8. Test Job Trigger</h2>';
    $jobsDir2 = __DIR__ . '/jobs';
    if (!is_dir($jobsDir2)) mkdir($jobsDir2, 0755, true);
    $testId   = bin2hex(random_bytes(8)) . '00000000000000000000000000000000';
    $testId   = substr($testId, 0, 32);
    $testFile = $jobsDir2 . '/' . $testId . '.json';
    file_put_contents($testFile, json_encode([
        'status'     => 'processing',
        'created_at' => time(),
        'slug'       => 'test-debug',
        'courseName' => 'Test Debug',
        'content'    => 'test content',
        'colors'     => ['primary' => '#9B30E8', 'accent' => '#F59E0B'],
        'paymentUrl' => '',
        'imgUrls'    => ['instructor' => '', 'atmosphere' => [], 'lessons' => []],
    ]));

    $spawned = false;
    if (function_exists('proc_open')) {
        $phpCli2 = '';
        foreach (['/opt/alt/php83/usr/bin/php','/usr/bin/php83','/usr/bin/php8.3','/usr/bin/php',PHP_BINARY] as $c) {
            if (is_executable($c)) { $phpCli2 = $c; break; }
        }
        if ($phpCli2) {
            $cmd  = escapeshellcmd($phpCli2) . ' ' . escapeshellarg(__DIR__.'/process.php') . ' ' . escapeshellarg($testId) . ' > /dev/null 2>&1 &';
            $desc = [0 => ['pipe','r'], 1 => ['file','/dev/null','w'], 2 => ['file','/dev/null','w']];
            $proc = @proc_open('/bin/sh -c ' . escapeshellarg($cmd), $desc, $pipes);
            if (is_resource($proc)) { fclose($pipes[0]); proc_close($proc); $spawned = true; }
        }
    }
    echo '<p>' . ($spawned ? ok('Test job spawned via proc_open') : warn('proc_open unavailable — job created but not spawned')) . '</p>';
    echo '<p>Job ID: <code style="color:#9b6dff">' . $testId . '</code></p>';
    echo '<p>Check job status: <a style="color:#9b6dff" href="?key=csl-debug-2026">reload this page</a></p>';
}

echo '<hr style="border-color:#333;margin:2rem 0">';
echo '<p style="color:#555;font-size:.8rem">debug.php — remove from server after debugging</p>';
echo '</body></html>';
