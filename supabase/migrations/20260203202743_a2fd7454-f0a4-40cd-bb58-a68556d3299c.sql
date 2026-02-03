-- Clear all old broken session data to start fresh with accurate tracking
DELETE FROM tester_sessions;

-- Also run the stale session cleanup to ensure it works
SELECT close_stale_tester_sessions();