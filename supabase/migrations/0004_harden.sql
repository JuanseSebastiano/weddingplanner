-- Ajustes de seguridad sugeridos por el linter de Supabase.
create schema if not exists extensions;
alter extension citext set schema extensions;

alter function is_wedding_member(uuid) set search_path = public, extensions;
alter function my_wedding_id() set search_path = public, extensions;
alter function link_member_on_signup() set search_path = public, extensions;
alter function email_habilitado(text) set search_path = public, extensions;

-- Las policies evalúan estas funciones con el rol del usuario, así que
-- authenticated necesita EXECUTE; anon no.
revoke execute on function is_wedding_member(uuid) from public, anon;
revoke execute on function my_wedding_id() from public, anon;
grant execute on function is_wedding_member(uuid) to authenticated;
grant execute on function my_wedding_id() to authenticated;

-- Función de trigger: no la llama nadie por API.
revoke execute on function link_member_on_signup() from public, anon, authenticated;

-- email_habilitado queda expuesta a anon a propósito: el login necesita saber
-- si el email está habilitado antes de mandar el magic link.
revoke execute on function email_habilitado(text) from public, authenticated;
grant execute on function email_habilitado(text) to anon;
