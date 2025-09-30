-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the inspection reminders to run daily at 8 AM
SELECT cron.schedule(
  'send-inspection-reminders-daily',
  '0 8 * * *', -- Every day at 8 AM
  $$
  SELECT
    net.http_post(
      url:='https://sbtldudgiskqfqqkrmaa.supabase.co/functions/v1/send-inspection-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidGxkdWRnaXNrcWZxcWtybWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzA1NzMsImV4cCI6MjA3NDMwNjU3M30.I0WeylvH8HQzNROhpqsfvd5HCKxX21DbC0g6AN0dwb8"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);