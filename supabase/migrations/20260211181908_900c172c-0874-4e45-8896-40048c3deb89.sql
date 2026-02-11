
SELECT cron.schedule(
  'send-tester-expiry-reminders-daily',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://sbtldudgiskqfqqkrmaa.supabase.co/functions/v1/send-tester-expiry-reminders',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNidGxkdWRnaXNrcWZxcWtybWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MzA1NzMsImV4cCI6MjA3NDMwNjU3M30.I0WeylvH8HQzNROhpqsfvd5HCKxX21DbC0g6AN0dwb8'
      ),
      body:='{}'::jsonb
    ) as request_id;
  $$
);
