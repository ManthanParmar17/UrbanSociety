-- Urban Society database schema and seed data
-- Run with: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS urban_society;
USE urban_society;

-- MEMBERS
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    flat_id VARCHAR(20) NOT NULL UNIQUE,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- NOTICES
CREATE TABLE IF NOT EXISTS notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- BILLS
CREATE TABLE IF NOT EXISTS bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    status ENUM('pending','paid','overdue','partial') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bills_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- COMPLAINTS
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    priority ENUM('low','medium','high') DEFAULT 'medium',
    status ENUM('pending','in-progress','resolved','rejected') DEFAULT 'pending',
    assigned_to VARCHAR(100),
    expected_date DATE,
    resolved_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_complaints_member FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    type VARCHAR(100) DEFAULT 'General',
    date DATE NOT NULL,
    start_time TIME DEFAULT '00:00:00',
    end_time TIME DEFAULT '23:59:59',
    venue VARCHAR(200),
    capacity INT DEFAULT 0,
    description TEXT,
    organizer VARCHAR(150),
    contact VARCHAR(50),
    rsvp_going INT DEFAULT 0,
    rsvp_maybe INT DEFAULT 0,
    rsvp_declined INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- SEED: MEMBERS
INSERT INTO members (name, email, flat_id, phone) VALUES
    ('Neha Sharma', 'neha.sharma@example.com', 'A-101', '9876543210'),
    ('Arjun Mehta', 'arjun.mehta@example.com', 'B-202', '9876501234'),
    ('Priya Nair', 'priya.nair@example.com', 'C-303', '9876512345'),
    ('Rahul Verma', 'rahul.verma@example.com', 'D-404', '9876523456')
ON DUPLICATE KEY UPDATE email = email;

-- SEED: NOTICES
INSERT INTO notices (title, description) VALUES
    ('Water tank cleaning', 'Water supply will be off from 10 AM to 2 PM on Saturday for tank cleaning.'),
    ('Fire drill', 'A mandatory fire drill will be conducted next Monday at 4 PM. Please participate.'),
    ('Maintenance fee update', 'Quarterly maintenance fee invoices will be shared by the 5th of this month.')
ON DUPLICATE KEY UPDATE title = title;

-- SEED: BILLS
INSERT INTO bills (member_id, amount, description, due_date, status) VALUES
    (1, 2500.00, 'Monthly maintenance fee', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'pending'),
    (2, 1500.00, 'Gym annual subscription', DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'pending'),
    (3, 3200.00, 'Painting contribution', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'pending')
ON DUPLICATE KEY UPDATE status = status;

-- SEED: COMPLAINTS
INSERT INTO complaints (member_id, title, description, category, priority, status) VALUES
    (1, 'Leaking tap in kitchen', 'Tap has been leaking for two days; needs urgent fix.', 'Plumbing', 'high', 'pending'),
    (2, 'Lift jerks between floors', 'Lift B jerks between 3rd and 4th floor occasionally.', 'Maintenance', 'medium', 'in-progress'),
    (3, 'Parking slot occupied', 'Someone keeps parking in my allotted slot C-12.', 'Parking', 'medium', 'pending')
ON DUPLICATE KEY UPDATE status = status;

-- SEED: EVENTS
INSERT INTO events (title, type, date, start_time, end_time, venue, capacity, description, organizer, contact, rsvp_going, rsvp_maybe, rsvp_declined) VALUES
    ('Annual Sports Day', 'Sports', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '09:00:00', '18:00:00', 'Society Ground', 200, 'Sports competition for all age groups.', 'Sports Committee', '9876543210', 45, 12, 3),
    ('Holi Celebration', 'Festival', DATE_ADD(CURDATE(), INTERVAL 7 DAY), '16:00:00', '20:00:00', 'Community Hall', 150, 'Colorful Holi celebration with organic colors.', 'Cultural Committee', '9876543211', 78, 15, 2),
    ('Society Meeting', 'Meeting', DATE_ADD(CURDATE(), INTERVAL 3 DAY), '18:30:00', '20:00:00', 'Conference Room', 50, 'Monthly society meeting to discuss issues and budget.', 'Secretary', '9876543212', 32, 8, 5)
ON DUPLICATE KEY UPDATE title = title;
