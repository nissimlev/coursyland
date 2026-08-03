<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
require_once __DIR__ . '/config.php';
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "✅ DB OK. Tables: " . implode(', ', $tables);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage();
}
