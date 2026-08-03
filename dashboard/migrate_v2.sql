-- Migration v2 — CoursyLand Admin
-- הרץ ב-phpMyAdmin

USE u269759457_coursyland_adm;

-- הוספת שדה ח"פ ללקוחות
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS business_id VARCHAR(20) DEFAULT NULL AFTER phone;

-- שינוי ENUM לסוגי לקוח חדשים
ALTER TABLE clients
  MODIFY COLUMN subscription_type ENUM('authorized','exempt','basic','pro','enterprise') DEFAULT 'authorized';

-- עדכון ערכים ישנים לחדשים
UPDATE clients SET subscription_type='authorized' WHERE subscription_type IN ('basic','pro','enterprise');

-- הוספת שדות חשבונית לדוחות
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS invoice_received BOOLEAN DEFAULT FALSE AFTER is_paid,
  ADD COLUMN IF NOT EXISTS invoice_received_at DATETIME NULL AFTER invoice_received;
