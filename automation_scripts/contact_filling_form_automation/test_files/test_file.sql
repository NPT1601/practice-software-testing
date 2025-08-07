-- Test SQL file for file type validation
SELECT * FROM users WHERE id = 1;
INSERT INTO messages (subject, message, status) VALUES ('test', 'test message', 'NEW');
UPDATE users SET email = 'test@example.com' WHERE id = 1; 