-- Daily Data Privacy Act retention job (see public.purge_expired_personal_data).
create extension if not exists pg_cron;

select cron.schedule(
  'purge-expired-personal-data',
  '15 19 * * *', -- 03:15 Asia/Manila
  $$select public.purge_expired_personal_data()$$
);
