-- CoursyLand Admin — MySQL Schema
-- הרץ קובץ זה ב-phpMyAdmin או דרך CLI

CREATE DATABASE IF NOT EXISTS coursyland_admin CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE coursyland_admin;

-- בעלי קורסים
CREATE TABLE IF NOT EXISTS clients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  join_date DATE NOT NULL,
  subscription_type ENUM('basic', 'pro', 'enterprise') DEFAULT 'basic',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- קורסים
CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  icount_payment_page_id VARCHAR(100) NOT NULL,
  price DECIMAL(10,2),
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- רכישות (מסונכרן מ-iCount)
CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  icount_transaction_id VARCHAR(100) UNIQUE,
  buyer_name VARCHAR(255),
  buyer_email VARCHAR(255),
  amount DECIMAL(10,2) NOT NULL,
  purchase_date DATETIME NOT NULL,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- דוחות רבעוניים
CREATE TABLE IF NOT EXISTS reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id INT NOT NULL,
  quarter VARCHAR(10) NOT NULL,
  year INT NOT NULL,
  quarter_number TINYINT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_sales INT DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 5.00,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2) DEFAULT 0,
  pdf_path VARCHAR(500),
  sent_at DATETIME NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- הגדרות מערכת
CREATE TABLE IF NOT EXISTS settings (
  key_name VARCHAR(100) PRIMARY KEY,
  value TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ערכי ברירת מחדל להגדרות
INSERT IGNORE INTO settings (key_name, value) VALUES
  ('commission_rate_default', '5.00'),
  ('commission_rate_exempt', '23.00'),
  ('site_name', 'CoursyLand Admin'),
  ('admin_phone', '054-5409021'),
  ('admin_name', 'ניסים לוי');
