-- Security tests for migration 20261118120000_public_forms.
--
-- Run only against an isolated database whose auth schema comes from Supabase
-- Auth (GoTrue) migrations, after all migrations are applied. Never against
-- the remote project. One transaction, rolled back.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(108);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------

insert into auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, deleted_at)
values
  ('a1111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'alice@example.test',   now(), false, null),  -- owner A
  ('b2222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'bob@example.test',     now(), false, null),  -- owner B
  ('c3333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'carol@example.test',   now(), false, null),  -- manager A
  ('d4444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'mallory@example.test', now(), false, null),  -- member A
  ('e5555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'sam@example.test',     now(), false, null),  -- suspended manager A
  ('f6666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'dave@example.test',    null,  false, null);  -- unverified manager A

insert into public.organizations (id, name, country_code, created_by, creation_request_id)
values
  ('0a000000-0000-4000-8000-00000000000a', 'Org A', 'PT', 'a1111111-1111-4111-8111-111111111111', gen_random_uuid()),
  ('0b000000-0000-4000-8000-00000000000b', 'Org B', 'AO', 'b2222222-2222-4222-8222-222222222222', gen_random_uuid());

insert into public.memberships (organization_id, user_id, role, status)
values
  ('0a000000-0000-4000-8000-00000000000a', 'a1111111-1111-4111-8111-111111111111', 'owner',   'active'),
  ('0b000000-0000-4000-8000-00000000000b', 'b2222222-2222-4222-8222-222222222222', 'owner',   'active'),
  ('0a000000-0000-4000-8000-00000000000a', 'c3333333-3333-4333-8333-333333333333', 'manager', 'active'),
  ('0a000000-0000-4000-8000-00000000000a', 'd4444444-4444-4444-8444-444444444444', 'member',  'active'),
  ('0a000000-0000-4000-8000-00000000000a', 'e5555555-5555-4555-8555-555555555555', 'manager', 'suspended'),
  ('0a000000-0000-4000-8000-00000000000a', 'f6666666-6666-4666-8666-666666666666', 'manager', 'active');

-- Shared lookups prepared as postgres for the role-switched calls.
create temp table t (name text primary key, value text);
grant select on t to anon, authenticated, public_form_service;

-- ===========================================================================
-- A. Structure and privileges
-- ===========================================================================

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
     'public.forms'::regclass, 'public.form_versions'::regclass, 'public.form_questions'::regclass,
     'public.public_form_links'::regclass, 'public.form_submissions'::regclass,
     'public.form_answers'::regclass, 'private.form_rate_events'::regclass)),
  'RLS is enabled on every new table'
);
select ok(
  not has_table_privilege('anon', 'public.forms', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.form_versions', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.form_questions', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.public_form_links', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.form_submissions', 'select,insert,update,delete')
  and not has_table_privilege('anon', 'public.form_answers', 'select,insert,update,delete'),
  'anon has no privileges on any form table'
);
select ok(
  has_table_privilege('authenticated', 'public.form_answers', 'select')
  and not has_table_privilege('authenticated', 'public.forms', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.form_versions', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.form_questions', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.public_form_links', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.form_submissions', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.form_answers', 'insert,update,delete'),
  'authenticated can only read form tables (filtered by RLS)'
);
select ok(
  not has_function_privilege('anon', 'public.enable_public_inquiry_form(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.rotate_public_form_link(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.revoke_public_form_link(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.enable_public_inquiry_form(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.rotate_public_form_link(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.revoke_public_form_link(uuid)', 'execute'),
  'only authenticated can execute the staff operations'
);
select is_empty(
  $$ select r.rolname from pg_roles r
      where not r.rolsuper and r.rolname not in ('public_form_service', 'postgres')
        and (has_function_privilege(r.oid, 'form_service.get_public_form(text)', 'execute')
             or has_function_privilege(r.oid, 'form_service.submit_public_form(text, uuid, uuid, text, jsonb)', 'execute')) $$,
  'no role but public_form_service (and the owner, postgres) can execute the public functions: not anon, authenticated, service_role or authenticator'
);
select is(
  (select array_agg(r.rolname::text order by r.rolname) from pg_roles r
    where not r.rolsuper and has_schema_privilege(r.oid, 'form_service', 'usage')),
  array['pg_read_all_data', 'pg_write_all_data', 'postgres', 'public_form_service',
        'supabase_etl_admin', 'supabase_read_only_user'],
  'form_service is usable only by its owner, the service role and the platform data roles (which cannot execute)'
);

-- ---------------------------------------------------------------------------
-- A2. public_form_service: effective privileges (direct, inherited, PUBLIC)
-- ---------------------------------------------------------------------------

select ok(
  (select not rolcanlogin and not rolsuper and not rolinherit and not rolcreaterole
          and not rolcreatedb and not rolreplication and not rolbypassrls
          and rolconnlimit = 10 and rolpassword is null
     from pg_authid where rolname = 'public_form_service'),
  'public_form_service: NOLOGIN without a password, NOINHERIT, no special attributes, 10 connections'
);
select is(
  (select array_agg(c order by c) from pg_db_role_setting s, unnest(s.setconfig) c
    where s.setrole = 'public_form_service'::regrole and s.setdatabase = 0),
  array['idle_in_transaction_session_timeout=10s', 'lock_timeout=3s', 'statement_timeout=5s'],
  'public_form_service has short statement, lock and idle timeouts'
);
select is_empty(
  $$ select m.roleid::regrole::text from pg_auth_members m where m.member = 'public_form_service'::regrole $$,
  'public_form_service is a member of no role (including predefined pg_* roles)'
);
select is_empty(
  $$ select m.member::regrole::text from pg_auth_members m
      where m.roleid = 'public_form_service'::regrole
        and not (m.member = 'postgres'::regrole and m.admin_option and not m.inherit_option and not m.set_option) $$,
  'no role can become or inherit public_form_service (postgres only administers it)'
);
select is(
  (select array_agg(p.oid::regprocedure::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('pg_catalog', 'information_schema')
      and has_schema_privilege('public_form_service', n.oid, 'usage')
      and has_function_privilege('public_form_service', p.oid, 'execute')),
  array['form_service.get_public_form(text)',
        'form_service.submit_public_form(text,uuid,uuid,text,jsonb)'],
  'outside the system catalog, public_form_service can execute exactly the two public functions'
);
select is_empty(
  $$ select c.oid::regclass::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
        and n.nspname not in ('pg_catalog', 'information_schema')
        and n.nspname !~ '^pg_(temp|toast)'
        and has_schema_privilege('public_form_service', n.oid, 'usage')
        and (has_table_privilege('public_form_service', c.oid,
               'select, insert, update, delete, truncate, references, trigger, maintain')
             or (c.relkind = 'S' and has_sequence_privilege('public_form_service', c.oid, 'usage, select, update'))
             or has_any_column_privilege('public_form_service', c.oid, 'select, insert, update, references')) $$,
  'public_form_service has no privilege on any table, view, sequence or column it can reach'
);
select is(
  (select array_agg(n.nspname::text order by n.nspname) from pg_namespace n
    where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
      and has_schema_privilege('public_form_service', n.oid, 'usage')),
  array['form_service', 'public'],
  'public_form_service uses only form_service and public (the latter through PUBLIC)'
);
select is_empty(
  $$ select n.nspname from pg_namespace n
      where n.nspname !~ '^pg_temp_' and has_schema_privilege('public_form_service', n.oid, 'create') $$,
  'public_form_service can create objects in no schema'
);
select ok(
  has_database_privilege('public_form_service', current_database(), 'connect')
  and has_database_privilege('public_form_service', current_database(), 'temporary')
  and not has_database_privilege('public_form_service', current_database(), 'create'),
  'database: CONNECT and TEMPORARY only, both through PUBLIC; no CREATE'
);
select is_empty(
  $$ select d.defaclrole::regrole::text || ' ' || d.defaclobjtype::text
       from pg_default_acl d, aclexplode(d.defaclacl) a
      where a.grantee in (0, 'public_form_service'::regrole) $$,
  'no default privileges grant future objects to public_form_service or PUBLIC'
);
select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')) $$,
  'no private function is executable by API roles'
);
select ok(
  has_function_privilege('authenticated', 'authz.can_manage_forms(uuid)', 'execute')
  and not has_function_privilege('anon', 'authz.can_manage_forms(uuid)', 'execute')
  and not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage'),
  'the forms helper is for authenticated only; private stays closed'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef and not (p.proconfig @> array['search_path=""'])
      and n.nspname in ('public', 'private', 'authz')),
  0,
  'every SECURITY DEFINER function pins an empty search_path'
);

-- ===========================================================================
-- B. Enabling the default Inquiry form and its link
-- ===========================================================================

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  'an Owner enables the public Inquiry form'
);
select is(
  (select count(*)::int from public.forms where organization_id = '0a000000-0000-4000-8000-00000000000a' and purpose = 'inquiry'),
  1,
  'one Inquiry form exists'
);
select ok(
  (select version = 1 and published_at is not null and published_by = 'a1111111-1111-4111-8111-111111111111'
     from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a'),
  'version 1 is published by the Owner'
);
select results_eq(
  $$ select binding::text, kind::text, required from public.form_questions
      where organization_id = '0a000000-0000-4000-8000-00000000000a' order by position $$,
  $$ values ('requester_name', 'short_text', false), ('requester_email', 'short_text', false),
            ('requester_phone', 'short_text', false), ('client_message', 'long_text', true),
            ('requested_event_date', 'date', false), ('estimated_guests', 'number', false) $$,
  'default questions: only the message is required; every question is bound'
);
select ok(
  (select count(*) = 1 and bool_and(public_key ~ '^[A-Za-z0-9_-]{22}$')
     from public.public_form_links where organization_id = '0a000000-0000-4000-8000-00000000000a' and revoked_at is null),
  'one active link with a 22-character random key'
);

set local request.jwt.claims to '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok(
  $$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  'a Manager may enable it too (idempotent)'
);
select ok(
  (select (select count(*) from public.forms where organization_id = '0a000000-0000-4000-8000-00000000000a') = 1
      and (select count(*) from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a') = 1
      and (select count(*) from public.public_form_links where organization_id = '0a000000-0000-4000-8000-00000000000a') = 1),
  'enabling again creates nothing new'
);

set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'a Member cannot enable');
set local request.jwt.claims to '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}';
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'a suspended Manager cannot enable');
set local request.jwt.claims to '{"sub":"f6666666-6666-4666-8666-666666666666","role":"authenticated"}';
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'an unverified Manager cannot enable');
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'the Owner of B cannot enable A''s form');
select is((select count(*)::int from public.forms), 0, 'the Owner of B reads none of A''s forms');
select is((select count(*)::int from public.public_form_links), 0, 'the Owner of B reads none of A''s links');
select lives_ok($$ select public.enable_public_inquiry_form('0b000000-0000-4000-8000-00000000000b') $$,
  'the Owner of B enables B''s own form');

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'anon cannot enable');

reset role;
set local request.jwt.claims to '';
insert into t
select 'key_a', public_key from public.public_form_links where organization_id = '0a000000-0000-4000-8000-00000000000a'
union all select 'key_b', public_key from public.public_form_links where organization_id = '0b000000-0000-4000-8000-00000000000b'
union all select 'link_a', id::text from public.public_form_links where organization_id = '0a000000-0000-4000-8000-00000000000a'
union all select 'link_b', id::text from public.public_form_links where organization_id = '0b000000-0000-4000-8000-00000000000b'
union all select 'v1_a', id::text from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a'
union all select 'v1_b', id::text from public.form_versions where organization_id = '0b000000-0000-4000-8000-00000000000b'
union all select 'form_a', id::text from public.forms where organization_id = '0a000000-0000-4000-8000-00000000000a'
union all select 'form_b', id::text from public.forms where organization_id = '0b000000-0000-4000-8000-00000000000b'
union all select 'q_' || binding::text, id::text from public.form_questions
  where form_version_id = (select id from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a');

-- Answer payloads for A's version 1, keyed by question id.
create temp table p (name text primary key, answers jsonb);
grant select on p to anon, public_form_service;
insert into p values
  ('valid', jsonb_build_object(
     (select value from t where name = 'q_client_message'), e'Olá!\nQueremos um orçamento para 120 pessoas. ANSWER-MARKER',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     (select value from t where name = 'q_requester_name'), '  Ana Marques ',
     (select value from t where name = 'q_requested_event_date'), '2027-06-12',
     (select value from t where name = 'q_estimated_guests'), 120)),
  ('valid_other', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'Outra mensagem',
     (select value from t where name = 'q_requester_phone'), '+351 912 000 000')),
  ('no_message', jsonb_build_object((select value from t where name = 'q_requester_email'), 'ana@example.test')),
  ('no_contact', jsonb_build_object((select value from t where name = 'q_client_message'), 'Sem contacto')),
  ('bad_email', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@')),
  ('unknown_key', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     gen_random_uuid()::text, 'extra')),
  ('guests_text', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     (select value from t where name = 'q_estimated_guests'), '120')),
  ('guests_fraction', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     (select value from t where name = 'q_estimated_guests'), 1.5)),
  ('bad_date', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     (select value from t where name = 'q_requested_event_date'), '2027-02-30')),
  ('multiline_name', jsonb_build_object(
     (select value from t where name = 'q_client_message'), 'x',
     (select value from t where name = 'q_requester_email'), 'ana@example.test',
     (select value from t where name = 'q_requester_name'), e'Ana\nMarques'));

-- ===========================================================================
-- C. Publishing rules (drafts prepared directly, as a future editor would)
-- ===========================================================================

insert into public.form_versions (form_id, organization_id, version, title, created_by)
values ((select value::uuid from t where name = 'form_b'), '0b000000-0000-4000-8000-00000000000b', 2, 'Rascunho',
        'b2222222-2222-4222-8222-222222222222');
insert into t select 'draft_b', id::text from public.form_versions
  where organization_id = '0b000000-0000-4000-8000-00000000000b' and published_at is null;
insert into public.form_questions (form_version_id, organization_id, position, kind, label, required, binding)
values ((select value::uuid from t where name = 'draft_b'), '0b000000-0000-4000-8000-00000000000b', 1, 'short_text', 'Email', false, 'requester_email');

select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'an Inquiry form without a message question cannot be published');

insert into public.form_questions (form_version_id, organization_id, position, kind, label, required, binding)
values ((select value::uuid from t where name = 'draft_b'), '0b000000-0000-4000-8000-00000000000b', 2, 'long_text', 'Mensagem', false, 'client_message');
select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'the message question must be required');

update public.form_questions set required = true
 where form_version_id = (select value::uuid from t where name = 'draft_b') and binding = 'client_message';
update public.form_questions set binding = null
 where form_version_id = (select value::uuid from t where name = 'draft_b') and position = 1;
select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'an Inquiry form needs an email or phone question');

update public.form_questions set binding = 'requester_email'
 where form_version_id = (select value::uuid from t where name = 'draft_b') and position = 1;
insert into public.form_questions (form_version_id, organization_id, position, kind, label, required, binding)
values ((select value::uuid from t where name = 'draft_b'), '0b000000-0000-4000-8000-00000000000b', 3, 'short_text', 'Data', false, 'requested_event_date');
select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'a bound question must have the matching kind');

update public.form_questions set kind = 'single_choice', binding = null,
       options = '[{"key":"a","label":"A"},{"key":"a","label":"Repetida"}]'::jsonb, label = 'Tipo'
 where form_version_id = (select value::uuid from t where name = 'draft_b') and position = 3;
select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'choice options need unique keys');

select throws_ok(
  $$ insert into public.form_questions (form_version_id, organization_id, position, kind, label, required, binding)
     values ((select value::uuid from t where name = 'draft_b'), '0b000000-0000-4000-8000-00000000000b', 4, 'long_text', 'Outra', false, 'client_message') $$,
  '23505', null, 'a binding appears at most once per version');

update public.form_questions set options = '[{"key":"casamento","label":"Casamento"},{"key":"empresa","label":"Empresa"}]'::jsonb
 where form_version_id = (select value::uuid from t where name = 'draft_b') and position = 3;
select lives_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  'a valid draft publishes');
select throws_ok(
  $$ select private.publish_form_version((select value::uuid from t where name = 'draft_b'), 'b2222222-2222-4222-8222-222222222222') $$,
  '22023', null, 'a published version cannot be published again');

-- ===========================================================================
-- D. Immutability (privileged session)
-- ===========================================================================

select throws_ok($$ update public.form_questions set label = 'Mudado' where form_version_id = (select value::uuid from t where name = 'v1_a') $$,
  '23514', null, 'questions of a published version cannot change');
select throws_ok($$ insert into public.form_questions (form_version_id, organization_id, position, kind, label)
                    values ((select value::uuid from t where name = 'v1_a'), '0a000000-0000-4000-8000-00000000000a', 9, 'short_text', 'Nova') $$,
  '23514', null, 'questions cannot be added to a published version');
select throws_ok($$ delete from public.form_questions where form_version_id = (select value::uuid from t where name = 'v1_a') $$,
  '23514', null, 'questions of a published version cannot be deleted');
select throws_ok($$ update public.form_versions set title = 'Mudado' where id = (select value::uuid from t where name = 'v1_a') $$,
  '23514', null, 'a published version cannot change');
select throws_ok($$ delete from public.form_versions where id = (select value::uuid from t where name = 'v1_a') $$,
  '23514', null, 'a published version cannot be deleted');
select throws_ok($$ delete from public.forms where id = (select value::uuid from t where name = 'form_a') $$,
  '23514', null, 'forms are never deleted');
select throws_ok($$ update public.public_form_links set public_key = 'AAAAAAAAAAAAAAAAAAAAAA' where id = (select value::uuid from t where name = 'link_a') $$,
  '23514', null, 'a link key cannot change');
select throws_ok($$ delete from public.public_form_links where id = (select value::uuid from t where name = 'link_a') $$,
  '23514', null, 'links are never deleted');
select throws_ok($$ truncate public.form_answers $$, '23514', null, 'answers cannot be truncated');

-- ===========================================================================
-- E. Public read and submission (as public_form_service)
-- ===========================================================================

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok($$ select form_service.get_public_form((select value from t where name = 'key_a')) $$,
  '42501', null, 'anon cannot read a public form directly');
select throws_ok(
  $$ select form_service.submit_public_form((select value from t where name = 'key_a'),
       (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), null, (select answers from p where name = 'valid')) $$,
  '42501', null, 'anon cannot submit directly');
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select form_service.get_public_form('AAAAAAAAAAAAAAAAAAAAAA') $$,
  '42501', null, 'a signed-in Owner cannot call the public functions either');

-- postgres administers the role; membership lets this session switch to it.
reset role;
grant public_form_service to postgres with inherit false, set true;
-- Test-only, rolled back: pgTAP itself lives in schema extensions. The
-- privilege audit (A2) ran before this; the connection test has no grant.
grant usage on schema extensions to public_form_service;
set local role public_form_service;
set local request.jwt.claims to '';

select ok(
  (select f ->> 'organizationName' = 'Org A' and jsonb_array_length(f -> 'questions') = 6
          and f ->> 'formVersionId' = (select value from t where name = 'v1_a')
     from (select form_service.get_public_form((select value from t where name = 'key_a')) f) x),
  'the server reads the current version: organization name and six questions'
);
select throws_ok($$ select form_service.get_public_form('AAAAAAAAAAAAAAAAAAAAAA') $$,
  'SF001', null, 'an unknown key is unavailable');

select lives_ok(
  $$ select form_service.submit_public_form((select value from t where name = 'key_a'),
       (select value::uuid from t where name = 'v1_a'), '11111111-0000-4000-8000-000000000001', repeat('a', 64),
       (select answers from p where name = 'valid')) $$,
  'a valid public submission is accepted'
);
select lives_ok(
  $$ select form_service.submit_public_form((select value from t where name = 'key_a'),
       (select value::uuid from t where name = 'v1_a'), '11111111-0000-4000-8000-000000000001', repeat('a', 64),
       (select answers from p where name = 'valid')) $$,
  'retrying the same request is accepted quietly'
);
select throws_ok(
  $$ select form_service.submit_public_form((select value from t where name = 'key_a'),
       (select value::uuid from t where name = 'v1_a'), '11111111-0000-4000-8000-000000000001', repeat('a', 64),
       (select answers from p where name = 'valid_other')) $$,
  '23505', null, 'reusing a request id with other answers is refused'
);

select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'no_message')) $$,
  '22023', null, 'the message is required');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'no_contact')) $$,
  '22023', null, 'an email or phone is required');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'bad_email')) $$,
  '22023', null, 'an invalid email is refused');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'unknown_key')) $$,
  '22023', null, 'answers to unknown questions are refused');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'guests_text')) $$,
  '22023', null, 'a number answer must be a number');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'guests_fraction')) $$,
  '22023', null, 'guests must be a whole number');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'bad_date')) $$,
  '22023', null, 'an impossible date is refused');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'multiline_name')) $$,
  '22023', null, 'short text is single-line');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_b'), gen_random_uuid(), repeat('a', 64), (select answers from p where name = 'valid')) $$,
  'SF002', null, 'a version of another form is not accepted');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), 'not-a-fingerprint', (select answers from p where name = 'valid')) $$,
  '22023', null, 'a malformed fingerprint is refused');
select throws_ok($$ select count(*) from public.inquiries $$, '42501', null, 'the service role cannot read inquiries');
select throws_ok($$ select count(*) from public.form_answers $$, '42501', null, 'the service role cannot read answers');
select throws_ok($$ insert into public.form_submissions (organization_id, form_id, form_version_id, public_form_link_id, request_id, payload_sha256)
     values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '\x00') $$,
  '42501', null, 'the service role cannot write tables directly');
select throws_ok($$ select count(*) from private.form_rate_events $$, '42501', null, 'the service role cannot use private');
select throws_ok($$ select public.enable_public_inquiry_form('0a000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'the service role cannot run staff operations');

-- Without a trusted client address: accepted, per-link limits only, no rate event.
select lives_ok(
  $$ select form_service.submit_public_form((select value from t where name = 'key_a'),
       (select value::uuid from t where name = 'v1_a'), '11111111-0000-4000-8000-0000000000aa', null,
       (select answers from p where name = 'valid_other')) $$,
  'a submission without a fingerprint is accepted'
);

-- Per-fingerprint limit: five accepted in ten minutes, the sixth refused.
select lives_ok($$
  select form_service.submit_public_form((select value from t where name = 'key_a'),
           (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('b', 64), (select answers from p where name = 'valid_other'))
    from generate_series(1, 5) $$,
  'five submissions from one client are accepted'
);
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('b', 64), (select answers from p where name = 'valid_other')) $$,
  'SF003', null, 'the sixth from the same client within ten minutes is refused');

-- ===========================================================================
-- F. What was stored
-- ===========================================================================

reset role;
set local request.jwt.claims to '';

select ok(
  (select i.submission_channel = 'public_form' and i.source is null and i.created_by is null
          and i.client_message = e'Olá!\nQueremos um orçamento para 120 pessoas. ANSWER-MARKER'
          and i.requester_email = 'ana@example.test' and i.requester_name = 'Ana Marques'
          and i.requested_event_date = '2027-06-12' and i.estimated_guests = 120
          and i.status = 'open' and i.received_at between now() - interval '1 minute' and now()
     from public.inquiries i join public.form_submissions s on s.id = i.form_submission_id
    where s.request_id = '11111111-0000-4000-8000-000000000001'),
  'the submission created a public Inquiry from the bound answers'
);
select is(
  (select count(*)::int from public.form_submissions where request_id = '11111111-0000-4000-8000-000000000001'),
  1, 'the retry created no second submission'
);
select is(
  (select count(*)::int from public.form_answers a join public.form_submissions s on s.id = a.form_submission_id
    where s.request_id = '11111111-0000-4000-8000-000000000001'),
  5, 'one typed answer per answered question (phone left empty)'
);
select ok(
  (select bool_and(fingerprint ~ '^[0-9a-f]{64}$') and count(*) = 6 from private.form_rate_events),
  'rate events hold only fingerprints: six fingerprinted submissions, none for the one without'
);

-- Staff reads (RLS).
set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::int from public.inquiries where submission_channel = 'public_form'), 7,
  'the Owner of A reads the public inquiries');
select is((select count(*)::int from public.form_answers), 5 + 6 * 2,
  'the Owner of A reads their answers');
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.form_submissions), 0, 'the Owner of B reads none of A''s submissions');
select is((select count(*)::int from public.form_answers), 0, 'the Owner of B reads none of A''s answers');
set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.form_answers), 0, 'a Member reads no answers');

-- Manual registration is unchanged.
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
create temp table manual as
  select public.create_inquiry('0a000000-0000-4000-8000-00000000000a', gen_random_uuid(), 'phone', null,
                               'Registo manual', null, null, null, null, null, null) as id;
select ok(
  (select i.submission_channel = 'staff_entry' and i.source = 'phone' and i.created_by = 'a1111111-1111-4111-8111-111111111111'
     from public.inquiries i join manual m on m.id = i.id),
  'manual registration still creates a staff_entry inquiry with author and source'
);

-- ===========================================================================
-- G. Version window, link limits, rotation and revocation
-- ===========================================================================

reset role;
set local request.jwt.claims to '';

-- B: version 2 was published in C. A third version published 25 hours ago
-- makes version 2 too old (its successor is beyond the window).
insert into public.form_versions (form_id, organization_id, version, title, created_by, published_at, published_by)
values ((select value::uuid from t where name = 'form_b'), '0b000000-0000-4000-8000-00000000000b', 3, 'Antiga',
        'b2222222-2222-4222-8222-222222222222', now() - interval '25 hours', 'b2222222-2222-4222-8222-222222222222');
insert into t select 'v2_b', id::text from public.form_versions
  where organization_id = '0b000000-0000-4000-8000-00000000000b' and version = 2;
insert into t select 'v3_b', id::text from public.form_versions
  where organization_id = '0b000000-0000-4000-8000-00000000000b' and version = 3;
insert into p select 'b_v1', jsonb_build_object(
    (select id::text from public.form_questions where form_version_id = (select value::uuid from t where name = 'v1_b') and binding = 'client_message'), 'B v1',
    (select id::text from public.form_questions where form_version_id = (select value::uuid from t where name = 'v1_b') and binding = 'requester_email'), 'b@example.test');

-- A: a second version published now keeps version 1 within the window.
insert into public.form_versions (form_id, organization_id, version, title, created_by)
values ((select value::uuid from t where name = 'form_a'), '0a000000-0000-4000-8000-00000000000a', 2, 'Versão 2',
        'a1111111-1111-4111-8111-111111111111');
insert into public.form_questions (form_version_id, organization_id, position, kind, label, required, binding)
select v.id, v.organization_id, q.position, q.kind, q.label, q.required, q.binding
  from public.form_versions v, public.form_questions q
 where v.organization_id = '0a000000-0000-4000-8000-00000000000a' and v.version = 2
   and q.form_version_id = (select value::uuid from t where name = 'v1_a');
select private.publish_form_version(
  (select id from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a' and version = 2),
  'a1111111-1111-4111-8111-111111111111');

-- B: 20 submissions in the last hour fill the link's hourly quota.
insert into public.form_submissions (organization_id, form_id, form_version_id, public_form_link_id, request_id, payload_sha256)
select '0b000000-0000-4000-8000-00000000000b', (select value::uuid from t where name = 'form_b'),
       (select value::uuid from t where name = 'v1_b'), (select value::uuid from t where name = 'link_b'),
       gen_random_uuid(), sha256(convert_to(g::text, 'UTF8'))
  from generate_series(1, 20) g;

set local role public_form_service;
set local request.jwt.claims to '';

select lives_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a'),
     (select value::uuid from t where name = 'v1_a'), gen_random_uuid(), repeat('c', 64), (select answers from p where name = 'valid_other')) $$,
  'the previous version is accepted within 24 hours of being superseded');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_b'),
     (select value::uuid from t where name = 'v2_b'), gen_random_uuid(), repeat('d', 64), '{}'::jsonb) $$,
  'SF002', null, 'a version superseded more than 24 hours ago is not accepted');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_b'),
     (select value::uuid from t where name = 'v1_b'), gen_random_uuid(), repeat('d', 64), (select answers from p where name = 'b_v1')) $$,
  'SF002', null, 'an older superseded version is not accepted either');
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_b'),
     (select value::uuid from t where name = 'v3_b'), gen_random_uuid(), repeat('d', 64), '{}'::jsonb) $$,
  'SF003', null, 'a link with 20 submissions in the last hour accepts no more');

set local role authenticated;
set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok($$ select public.rotate_public_form_link((select value::uuid from t where name = 'link_a')) $$,
  '42501', null, 'a Member cannot rotate a link');
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok($$ select public.revoke_public_form_link((select value::uuid from t where name = 'link_a')) $$,
  '42501', null, 'the Owner of B cannot revoke A''s link');

set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.rotate_public_form_link((select value::uuid from t where name = 'link_a')) $$,
  'the Owner rotates the link');
reset role;
set local request.jwt.claims to '';
insert into t select 'key_a2', public_key from public.public_form_links
  where organization_id = '0a000000-0000-4000-8000-00000000000a' and revoked_at is null;
insert into p select 'valid_v2', jsonb_build_object(
    (select q.id::text from public.form_questions q join public.form_versions v on v.id = q.form_version_id
      where v.organization_id = '0a000000-0000-4000-8000-00000000000a' and v.version = 2 and q.binding = 'client_message'), 'Via novo link',
    (select q.id::text from public.form_questions q join public.form_versions v on v.id = q.form_version_id
      where v.organization_id = '0a000000-0000-4000-8000-00000000000a' and v.version = 2 and q.binding = 'requester_email'), 'novo@example.test');
insert into t select 'v2_a', id::text from public.form_versions where organization_id = '0a000000-0000-4000-8000-00000000000a' and version = 2;

set local role public_form_service;
set local request.jwt.claims to '';
select throws_ok($$ select form_service.get_public_form((select value from t where name = 'key_a')) $$,
  'SF001', null, 'the rotated-out key no longer works');
select lives_ok($$ select form_service.submit_public_form((select value from t where name = 'key_a2'),
     (select value::uuid from t where name = 'v2_a'), gen_random_uuid(), repeat('e', 64), (select answers from p where name = 'valid_v2')) $$,
  'the new key accepts the current version');

set local role authenticated;
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok($$ select public.revoke_public_form_link((select value::uuid from t where name = 'link_b')) $$,
  'the Owner of B revokes B''s link');
select lives_ok($$ select public.revoke_public_form_link((select value::uuid from t where name = 'link_b')) $$,
  'revoking again changes nothing');
set local role public_form_service;
set local request.jwt.claims to '';
select throws_ok($$ select form_service.submit_public_form((select value from t where name = 'key_b'),
     (select value::uuid from t where name = 'v1_b'), gen_random_uuid(), repeat('f', 64), (select answers from p where name = 'b_v1')) $$,
  'SF001', null, 'a revoked link accepts nothing');

-- Enabling again after revocation issues a new link.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok($$ select public.enable_public_inquiry_form('0b000000-0000-4000-8000-00000000000b') $$,
  'enabling again after revocation issues a new link');
select is(
  (select count(*)::int from public.public_form_links where revoked_at is null), 1,
  'B has exactly one active link again'
);

-- ===========================================================================
-- H. Audit and inquiry protections
-- ===========================================================================

reset role;
set local request.jwt.claims to '';

select throws_ok($$ update public.inquiries set submission_channel = 'staff_entry' where submission_channel = 'public_form' $$,
  '23514', null, 'the submission channel cannot change');
select throws_ok($$ update public.inquiries set form_submission_id = null where submission_channel = 'public_form' $$,
  '23514', null, 'the link to the submission cannot change');
select throws_ok(
  $$ insert into public.inquiries (organization_id, source, client_message, received_at, created_by, creation_request_id)
     values ('0a000000-0000-4000-8000-00000000000a', null, 'x', now(), 'a1111111-1111-4111-8111-111111111111', gen_random_uuid()) $$,
  '23514', null, 'a staff inquiry still needs a source'
);
select ok(
  (select count(*) = 9 and bool_and(actor_role = session_user::text and actor_user_id is null and details = '{"source": null}'::jsonb)
     from private.audit_events a join public.inquiries i on i.id = a.subject_id
    where a.action = 'inquiry.created' and i.submission_channel = 'public_form'),
  'public inquiries are audited with the login role (public_form_service on a real connection), no user and no personal data'
);
select is(
  (select count(*)::int from private.audit_events
    where action = 'form.published' and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  4, 'each publication is audited (A v1, v2; B v1, v2)'
);
select ok(
  (select count(*) filter (where action = 'public_form_link.created') = 4
      and count(*) filter (where action = 'public_form_link.revoked') = 2
     from private.audit_events
    where organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  'link creation (4) and revocation (2) are audited'
);
select is(
  (select count(*)::int from private.audit_events
    where details::text like any (array['%MARKER%', '%@%', '%Ana Marques%', '%912%', '%Olá%'])),
  0, 'no audit event holds answers or contact details'
);

select * from finish();
rollback;
