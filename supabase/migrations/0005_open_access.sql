-- Se saca el login: la app queda abierta a cualquiera con el link.
-- Las policies pasan de "authenticated + es miembro" a "cualquiera, sin login".
alter policy weddings_member on weddings
  to anon, authenticated using (true) with check (true);

alter policy wedding_members_member on wedding_members
  to anon, authenticated using (true) with check (true);

alter policy guests_member on guests
  to anon, authenticated using (true) with check (true);

alter policy tables_member on tables
  to anon, authenticated using (true) with check (true);

alter policy vendors_member on vendors
  to anon, authenticated using (true) with check (true);

alter policy quotes_member on quotes
  to anon, authenticated using (true) with check (true);

alter policy budget_items_member on budget_items
  to anon, authenticated using (true) with check (true);

alter policy payments_member on payments
  to anon, authenticated using (true) with check (true);

alter policy tasks_member on tasks
  to anon, authenticated using (true) with check (true);

alter policy ideas_member on ideas
  to anon, authenticated using (true) with check (true);

alter policy documents_member on documents
  to anon, authenticated using (true) with check (true);

alter policy timeline_events_member on timeline_events
  to anon, authenticated using (true) with check (true);

alter policy files_member on storage.objects
  to anon, authenticated using (bucket_id = 'files') with check (bucket_id = 'files');

-- Ya no hay login que llame a esto.
drop function if exists email_habilitado(text);
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists link_member_on_signup();
