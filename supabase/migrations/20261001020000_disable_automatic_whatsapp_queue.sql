begin;

/* Rider Shoes now uses manual WhatsApp click-to-chat from Admin > Orders.
   Stop the old scheduled queue worker so order creation/status changes cannot
   trigger background WhatsApp delivery. Existing order/event data remains intact. */
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'rider-shoes-whatsapp-queue';
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end;
$$;

commit;
