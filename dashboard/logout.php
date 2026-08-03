<?php
require_once __DIR__ . '/includes/auth.php';
logout();
header('Location: /dashboard/login.php');
exit;
