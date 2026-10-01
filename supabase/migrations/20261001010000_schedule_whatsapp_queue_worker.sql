create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('rider-shoes-whatsapp-queue','* * * * *',$$ select net.http_post(url:='https://oeqarxflhceesuroozfm.supabase.co/functions/v1/whatsapp-process-queue',headers:=jsonb_build_object('Content-Type','application/json','x-queue-token',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_queue_worker_token')),body:='{}'::jsonb); $$);
