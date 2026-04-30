<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store');

$jobId = preg_replace('/[^a-f0-9]/', '', $_GET['job_id'] ?? '');

if (strlen($jobId) !== 32) {
    http_response_code(400);
    echo json_encode(['error' => 'job_id לא תקין']);
    exit;
}

$jobFile = __DIR__ . '/jobs/' . $jobId . '.json';

if (!file_exists($jobFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'job לא נמצא']);
    exit;
}

$data = json_decode(file_get_contents($jobFile), true);

echo json_encode([
    'status' => $data['status'] ?? 'unknown',
    'url'    => $data['url']    ?? null,
    'error'  => $data['error']  ?? null,
]);
