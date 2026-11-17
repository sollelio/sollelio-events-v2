-- Security tests for migration 20261117190000_inquiries.
--
-- Run only against an isolated database whose auth schema comes from Supabase
-- Auth (GoTrue) migrations, after both migrations are applied. Never run
-- against the remote project. Everything runs in one transaction and is
-- rolled back.
--
-- Identity is switched with `set local role` and `request.jwt.claims`, as
-- PostgREST does for API requests. auth.uid() is the real Supabase Auth
-- definition; nothing is mocked.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(82);

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
  ('f6666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'dave@example.test',    null,  false, null),  -- unverified manager A
  ('a7777777-7777-4777-8777-777777777777', 'authenticated', 'authenticated', 'erin@example.test',    now(), false, now()), -- soft-deleted manager A
  ('b8888888-8888-4888-8888-888888888888', 'authenticated', 'authenticated', null,                   null,  true,  null);  -- anonymous sign-in

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
  ('0a000000-0000-4000-8000-00000000000a', 'f6666666-6666-4666-8666-666666666666', 'manager', 'active'),
  ('0a000000-0000-4000-8000-00000000000a', 'a7777777-7777-4777-8777-777777777777', 'manager', 'active'),
  ('0a000000-0000-4000-8000-00000000000a', 'b8888888-8888-4888-8888-888888888888', 'manager', 'active');

-- ===========================================================================
-- A. Structure and privileges
-- ===========================================================================

select ok(
  (select relrowsecurity from pg_class where oid = 'public.inquiries'::regclass),
  'RLS is enabled on inquiries'
);
select ok(
  not has_table_privilege('anon', 'public.inquiries', 'select,insert,update,delete,truncate'),
  'anon has no privileges on inquiries'
);
select ok(
  has_table_privilege('authenticated', 'public.inquiries', 'select'),
  'authenticated can select inquiries (filtered by RLS)'
);
select ok(
  not has_table_privilege('authenticated', 'public.inquiries', 'insert,update,delete,truncate'),
  'authenticated cannot write inquiries directly'
);
select ok(
  not has_function_privilege('anon', 'public.create_inquiry(uuid, uuid, public.inquiry_source, text, text, timestamptz, text, text, text, date, integer)', 'execute')
  and not has_function_privilege('anon', 'public.close_inquiry(uuid, public.inquiry_close_reason)', 'execute')
  and not has_function_privilege('anon', 'public.reopen_inquiry(uuid)', 'execute'),
  'anon cannot execute the inquiry functions'
);
select ok(
  has_function_privilege('authenticated', 'public.create_inquiry(uuid, uuid, public.inquiry_source, text, text, timestamptz, text, text, text, date, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.close_inquiry(uuid, public.inquiry_close_reason)', 'execute')
  and has_function_privilege('authenticated', 'public.reopen_inquiry(uuid)', 'execute'),
  'authenticated can execute the inquiry functions'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage')
  and not has_schema_privilege('anon', 'authz', 'usage'),
  'private stays closed to API roles; anon has no usage on authz'
);
select ok(
  has_schema_privilege('authenticated', 'authz', 'usage')
  and has_function_privilege('authenticated', 'authz.can_access_inquiries(uuid)', 'execute')
  and not has_function_privilege('anon', 'authz.can_access_inquiries(uuid)', 'execute')
  and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'authz'),
  'authz holds only the access helper, executable by authenticated alone'
);
select ok(
  not has_table_privilege('authenticated', 'private.audit_events', 'select,insert,update,delete,truncate'),
  'authenticated has no privileges on the audit log'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('create_inquiry', 'close_inquiry', 'reopen_inquiry', 'can_access_inquiries')
      and p.prosecdef and p.proconfig @> array['search_path=""']),
  4,
  'the write functions and the access helper are SECURITY DEFINER with an empty search_path'
);

-- ===========================================================================
-- B. create_inquiry by an Owner
-- ===========================================================================

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000001', 'whatsapp',
       'Olá! Casamento em junho, cerca de 120 pessoas. VERBATIM-MARKER', null,
       '2026-11-10 09:30:00+00', '  Ana Marques  ', '+351 912 345 678', 'ana@example.test',
       '2027-06-12', 120) $$,
  'an owner registers an inquiry with a verbatim client message'
);
select is(
  (select count(*)::int from public.inquiries),
  1,
  'the owner reads the new inquiry'
);
select lives_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000002', 'phone',
       null, 'Telefonou a pedir orçamento para um jantar de empresa. SUMMARY-MARKER',
       null, null, null, null, null, null) $$,
  'a staff summary alone is enough; everything else may be missing'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       null, null, null, 'Ana', null, null, null, null) $$,
  '22023', null,
  'an inquiry needs a client message or a staff summary'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       e'  \n\t ', null, null, null, null, null, null, null) $$,
  '22023', null,
  'a whitespace-only message does not count as a description'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       repeat('x', 10001), null, null, null, null, null, null, null) $$,
  '22023', null,
  'the client message is limited to 10000 characters'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       'ok', null, null, null, null, null, null, 0) $$,
  '22023', null,
  'estimated guests must be at least 1'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       'ok', null, now() + interval '2 hours', null, null, null, null, null) $$,
  '22023', null,
  'received_at cannot be in the future'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000003', 'email',
       'ok', null, '1999-12-31 23:59:59+00', null, null, null, null, null) $$,
  '22023', null,
  'received_at cannot be before 2000'
);
select is(
  public.create_inquiry(
    '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000001', 'whatsapp',
    'Olá! Casamento em junho, cerca de 120 pessoas. VERBATIM-MARKER', null,
    '2026-11-10 09:30:00+00', 'Ana Marques', '+351 912 345 678', 'ana@example.test',
    '2027-06-12', 120),
  (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'retrying with the same request id returns the same inquiry'
);
select is(
  (select count(*)::int from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  1,
  'the retry created nothing new'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000001', 'whatsapp',
       'A different message', null, '2026-11-10 09:30:00+00', null, null, null, null, null) $$,
  '23505', null,
  'reusing a request id with different intake fails'
);
select is(
  public.create_inquiry(
    '0a000000-0000-4000-8000-00000000000a', '11111111-0000-4000-8000-000000000002', 'phone',
    null, 'Telefonou a pedir orçamento para um jantar de empresa. SUMMARY-MARKER',
    null, null, null, null, null, null),
  (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000002'),
  'a retry without received_at ("now") returns the same inquiry'
);
select ok(
  (select created_by = 'a1111111-1111-4111-8111-111111111111'
          and status = 'open' and close_reason is null
          and requester_name = 'Ana Marques'
          and received_at = '2026-11-10 09:30:00+00'
          and requested_event_date = '2027-06-12' and estimated_guests = 120
     from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'the inquiry records the caller as author, opens, and keeps the intake as given (trimmed name)'
);
select ok(
  (select received_at between now() - interval '1 minute' and now() + interval '1 minute'
     from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000002'),
  'received_at defaults to the registration time'
);

-- ===========================================================================
-- C. Who may register inquiries in organization A
-- ===========================================================================

set local request.jwt.claims to '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '33333333-0000-4000-8000-000000000001', 'email',
       'Pedido recebido por email.', null, null, null, null, null, null, null) $$,
  'an active, verified Manager can register'
);

set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '44444444-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'a Member cannot register (needs a future assignment mechanism)'
);

set local request.jwt.claims to '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '55555555-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'a suspended Manager cannot register'
);

set local request.jwt.claims to '{"sub":"f6666666-6666-4666-8666-666666666666","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '66666666-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'an unverified Manager cannot register'
);

set local request.jwt.claims to '{"sub":"a7777777-7777-4777-8777-777777777777","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '77777777-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'a soft-deleted Manager cannot register'
);

set local request.jwt.claims to '{"sub":"b8888888-8888-4888-8888-888888888888","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '88888888-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'an anonymous-sign-in user cannot register, even with a membership'
);

set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '22222222-0000-4000-8000-000000000009', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'an Owner of another organization cannot register in A (forged organization id)'
);
select throws_ok(
  $$ select public.create_inquiry(
       '0c000000-0000-4000-8000-00000000000c', '22222222-0000-4000-8000-000000000008', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'an unknown organization id is refused'
);
select lives_ok(
  $$ select public.create_inquiry(
       '0b000000-0000-4000-8000-00000000000b', '22222222-0000-4000-8000-000000000001', 'in_person',
       null, 'Visitou o espaço. B-ONLY-MARKER', null, null, null, null, null, null) $$,
  'the Owner of B registers in B'
);

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
select throws_ok(
  $$ select public.create_inquiry(
       '0a000000-0000-4000-8000-00000000000a', '99999999-0000-4000-8000-000000000001', 'email',
       'x', null, null, null, null, null, null, null) $$,
  '42501', null,
  'anon cannot call create_inquiry'
);

-- ===========================================================================
-- D. Reading (RLS)
-- ===========================================================================

select throws_ok(
  $$ select count(*) from public.inquiries $$,
  '42501', null,
  'anon cannot read inquiries'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.inquiries),
  3,
  'the Owner of A reads all of A''s inquiries'
);
select is(
  (select count(*)::int from public.inquiries where organization_id = '0b000000-0000-4000-8000-00000000000b'),
  0,
  'the Owner of A reads none of B''s inquiries'
);

set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  (select count(*)::int from public.inquiries),
  1,
  'the Owner of B reads only B''s inquiry'
);
select is(
  (select count(*)::int from public.inquiries
    where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  0,
  'the Owner of B cannot read an A inquiry even when filtering for it'
);

set local request.jwt.claims to '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 3, 'a Manager of A reads A''s inquiries');

set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 0, 'a Member reads nothing');

set local request.jwt.claims to '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 0, 'a suspended Manager reads nothing');

set local request.jwt.claims to '{"sub":"f6666666-6666-4666-8666-666666666666","role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 0, 'an unverified Manager reads nothing');

set local request.jwt.claims to '{"sub":"a7777777-7777-4777-8777-777777777777","role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 0, 'a soft-deleted Manager reads nothing');

set local request.jwt.claims to '{"role":"authenticated"}';
select is((select count(*)::int from public.inquiries), 0, 'an authenticated request without a user reads nothing');

-- ===========================================================================
-- E. Close and reopen
-- ===========================================================================

set local request.jwt.claims to '{"sub":"a1111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.close_inquiry(
       (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
       'spam') $$,
  'the Owner closes an inquiry with a reason'
);
select ok(
  (select status = 'closed' and close_reason = 'spam'
          and closed_by = 'a1111111-1111-4111-8111-111111111111' and closed_at is not null
     from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'closing records the reason, who and when'
);

create temp table closed_snapshot as
  select closed_at from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001';

select lives_ok(
  $$ select public.close_inquiry(
       (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
       'duplicate') $$,
  'closing an already closed inquiry is accepted (a retry)'
);
select ok(
  (select i.close_reason = 'spam' and i.closed_at = s.closed_at
     from public.inquiries i, closed_snapshot s
    where i.creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'the retry changed nothing'
);
select throws_ok(
  $$ select public.close_inquiry(
       (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000002'),
       null) $$,
  '22023', null,
  'a close reason is required'
);
select throws_ok(
  $$ select public.close_inquiry('00000000-0000-4000-8000-000000000000', 'spam') $$,
  '42501', null,
  'an unknown inquiry id is refused like a forbidden one'
);

reset role;
create temp table a_ids as
  select creation_request_id as request_id, id from public.inquiries
   where organization_id = '0a000000-0000-4000-8000-00000000000a';
grant select on a_ids to authenticated;
set local role authenticated;

set local request.jwt.claims to '{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select public.close_inquiry(
       (select id from a_ids where request_id = '11111111-0000-4000-8000-000000000002'), 'spam') $$,
  '42501', null,
  'the Owner of B cannot close an A inquiry'
);
select throws_ok(
  $$ select public.reopen_inquiry(
       (select id from a_ids where request_id = '11111111-0000-4000-8000-000000000001')) $$,
  '42501', null,
  'the Owner of B cannot reopen an A inquiry'
);

set local request.jwt.claims to '{"sub":"d4444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok(
  $$ select public.close_inquiry(
       (select id from a_ids where request_id = '11111111-0000-4000-8000-000000000002'), 'spam') $$,
  '42501', null,
  'a Member cannot close'
);

set local request.jwt.claims to '{"sub":"e5555555-5555-4555-8555-555555555555","role":"authenticated"}';
select throws_ok(
  $$ select public.reopen_inquiry(
       (select id from a_ids where request_id = '11111111-0000-4000-8000-000000000001')) $$,
  '42501', null,
  'a suspended Manager cannot reopen'
);

set local request.jwt.claims to '{"sub":"c3333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok(
  $$ select public.reopen_inquiry(
       (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001')) $$,
  'a Manager reopens the inquiry'
);
select ok(
  (select status = 'open' and close_reason is null and closed_at is null and closed_by is null
     from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'reopening clears the closure fields'
);
select lives_ok(
  $$ select public.reopen_inquiry(
       (select id from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000001')) $$,
  'reopening an open inquiry is accepted (a retry) and changes nothing'
);

-- ===========================================================================
-- F. Direct writes and immutability
-- ===========================================================================

select throws_ok(
  $$ insert into public.inquiries (organization_id, source, client_message, received_at, created_by, creation_request_id)
     values ('0a000000-0000-4000-8000-00000000000a', 'email', 'x', now(),
             'c3333333-3333-4333-8333-333333333333', gen_random_uuid()) $$,
  '42501', null,
  'authenticated cannot insert directly'
);
select throws_ok(
  $$ update public.inquiries set status = 'closed' $$,
  '42501', null,
  'authenticated cannot update directly'
);
select throws_ok(
  $$ delete from public.inquiries $$,
  '42501', null,
  'authenticated cannot delete directly'
);

-- As postgres (bypasses RLS, like a maintenance or service-role session).
reset role;
set local request.jwt.claims to '';

select throws_ok(
  $$ update public.inquiries set client_message = 'rewritten'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'the client message cannot change, even for privileged sessions'
);
select throws_ok(
  $$ update public.inquiries set staff_summary = 'added later'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'a staff summary cannot be added afterwards'
);
select throws_ok(
  $$ update public.inquiries set organization_id = '0b000000-0000-4000-8000-00000000000b'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'an inquiry cannot move to another organization'
);
select throws_ok(
  $$ update public.inquiries set received_at = now() - interval '1 day'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'received_at cannot change'
);
select throws_ok(
  $$ update public.inquiries set requester_phone = '000'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'requester details as given cannot change'
);
select throws_ok(
  $$ update public.inquiries set source = 'email'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'the source cannot change'
);
select throws_ok(
  $$ update public.inquiries set created_by = 'b2222222-2222-4222-8222-222222222222'
      where creation_request_id = '11111111-0000-4000-8000-000000000001' $$,
  '23514', null,
  'authorship cannot change'
);
select throws_ok(
  $$ update public.inquiries set status = 'closed'
      where creation_request_id = '11111111-0000-4000-8000-000000000002' $$,
  '23514', null,
  'a closed inquiry must have a reason, author and time'
);
select throws_ok(
  $$ insert into public.inquiries (organization_id, source, received_at, created_by, creation_request_id)
     values ('0a000000-0000-4000-8000-00000000000a', 'email', now(),
             'a1111111-1111-4111-8111-111111111111', gen_random_uuid()) $$,
  '23514', null,
  'an inquiry without any description is rejected by the table itself'
);
select throws_ok(
  $$ delete from public.inquiries where creation_request_id = '11111111-0000-4000-8000-000000000002' $$,
  '23514', null,
  'inquiries are never deleted'
);
select throws_ok(
  $$ truncate public.inquiries $$,
  '23514', null,
  'inquiries cannot be truncated'
);

-- ===========================================================================
-- G. Audit
-- ===========================================================================

select is(
  (select count(*)::int from private.audit_events where action = 'inquiry.created'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  4,
  'each new inquiry is audited once (retries add nothing)'
);
select ok(
  (select bool_and(details ?& array['source'] and (select count(*) from jsonb_object_keys(details)) = 1)
     from private.audit_events where action = 'inquiry.created'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  'creation events hold only the source'
);
select is(
  (select count(*)::int from private.audit_events
    where action like 'inquiry.%'
      and (details::text ilike any (array['%MARKER%', '%Ana%', '%example.test%', '%912%', '%Olá%']))),
  0,
  'audit events hold no message text or requester details'
);
select ok(
  (select actor_user_id = 'a1111111-1111-4111-8111-111111111111' and actor_role = 'authenticated'
     from private.audit_events a join public.inquiries i on i.id = a.subject_id
    where a.action = 'inquiry.created' and i.creation_request_id = '11111111-0000-4000-8000-000000000001'),
  'the creation event records the acting user and role'
);
select is(
  (select count(*)::int from private.audit_events where action = 'inquiry.closed'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  1,
  'closing is audited once (the retry added nothing)'
);
select ok(
  (select details = '{"reason": "spam"}'::jsonb and actor_user_id = 'a1111111-1111-4111-8111-111111111111'
     from private.audit_events where action = 'inquiry.closed'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  'the close event records the reason and the actor'
);
select ok(
  (select details = '{"previous_reason": "spam"}'::jsonb and actor_user_id = 'c3333333-3333-4333-8333-333333333333'
     from private.audit_events where action = 'inquiry.reopened'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  'the reopen event records the previous reason and the actor'
);
select is(
  (select count(*)::int from private.audit_events where action = 'inquiry.reopened'
      and organization_id in ('0a000000-0000-4000-8000-00000000000a', '0b000000-0000-4000-8000-00000000000b')),
  1,
  'reopening is audited once (the retry added nothing)'
);
select ok(
  (select bool_and(a.organization_id = i.organization_id)
     from private.audit_events a join public.inquiries i on i.id = a.subject_id
    where a.action like 'inquiry.%'),
  'audit events belong to the inquiry''s organization'
);

select * from finish();
rollback;
