-- Security tests for migration 20261114133030_organizations_and_memberships.
--
-- Run only against an isolated database whose auth schema comes from Supabase
-- Auth (GoTrue) migrations: a local Supabase stack via `supabase test db`, or
-- a disposable database migrated by the same GoTrue version as the project.
-- Never run against the remote project. Everything here runs in one
-- transaction and is rolled back.
--
-- Identity is switched with `set local role` and `request.jwt.claims`, as
-- PostgREST does for API requests. auth.uid() and auth.jwt() are the real
-- Supabase Auth definitions; nothing is mocked.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(97);

-- Fixtures. alice, bob and carol have verified email addresses.
insert into auth.users (id, aud, role, email, email_confirmed_at, is_anonymous, deleted_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'alice@example.test', now(), false, null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'bob@example.test',   now(), false, null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'authenticated', 'authenticated', 'carol@example.test', now(), false, null),
  -- dave never confirmed his email address
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'authenticated', 'authenticated', 'dave@example.test',  null,  false, null),
  -- erin was soft-deleted by Supabase Auth
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'authenticated', 'authenticated', 'erin@example.test',  now(), false, now()),
  -- an anonymous-sign-in user (no email)
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'authenticated', 'authenticated', null,                 null,  true,  null);

-- ===========================================================================
-- A. Structure and privileges
-- ===========================================================================

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.organizations'::regclass, 'public.memberships'::regclass,
                  'private.audit_events'::regclass, 'private.country_codes'::regclass)),
  'RLS is enabled on every table'
);
select ok(
  not has_table_privilege('anon', 'public.organizations', 'select,insert,update,delete,truncate'),
  'anon has no privileges on organizations'
);
select ok(
  not has_table_privilege('anon', 'public.memberships', 'select,insert,update,delete,truncate'),
  'anon has no privileges on memberships'
);
select ok(
  has_table_privilege('authenticated', 'public.organizations', 'select')
  and has_table_privilege('authenticated', 'public.memberships', 'select'),
  'authenticated can select organizations and memberships (filtered by RLS)'
);
select ok(
  not has_table_privilege('authenticated', 'public.organizations', 'insert,update,delete,truncate'),
  'authenticated cannot write organizations directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.memberships', 'insert,update,delete,truncate'),
  'authenticated cannot write memberships directly'
);
select ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage'),
  'API roles have no access to the private schema'
);
select ok(
  not has_function_privilege('anon', 'public.create_organization(text, text, uuid)', 'execute'),
  'anon cannot execute create_organization'
);
select ok(
  has_function_privilege('authenticated', 'public.create_organization(text, text, uuid)', 'execute'),
  'authenticated can execute create_organization'
);
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'create_organization'
       and p.oid <> 'public.create_organization(text, text, uuid)'::regprocedure
  $$,
  'create_organization has exactly one signature'
);
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private')
       and p.prosecdef
       and not coalesce(p.proconfig @> array['search_path=""'], false)
  $$,
  'every SECURITY DEFINER function pins an empty search_path'
);
select is_empty(
  $$
    select p.oid::regprocedure::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private'
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))
  $$,
  'no private function is executable by API roles'
);
select is(
  (select count(*)::int from private.country_codes),
  249,
  'all 249 ISO 3166-1 alpha-2 codes are present'
);

-- ===========================================================================
-- B. Callers who may not create organizations
-- ===========================================================================

set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

select throws_ok(
  $$ select public.create_organization('Anon Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'permission denied for function create_organization',
  'anon cannot create an organization'
);
select throws_ok(
  $$ select * from public.organizations $$,
  '42501',
  'permission denied for table organizations',
  'anon cannot read organizations'
);

set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';

select throws_ok(
  $$ select public.create_organization('No Subject Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'authentication required',
  'a token without a user cannot create an organization'
);

set local request.jwt.claims to
  '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';
select throws_ok(
  $$ select public.create_organization('Dave Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'a verified email address is required',
  'a user with an unconfirmed email cannot create an organization'
);

set local request.jwt.claims to
  '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}';
select throws_ok(
  $$ select public.create_organization('Erin Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'a verified email address is required',
  'a soft-deleted user cannot create an organization'
);

set local request.jwt.claims to
  '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated","is_anonymous":true}';
select throws_ok(
  $$ select public.create_organization('Anonymous Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'a verified email address is required',
  'an anonymous-sign-in user cannot create an organization'
);

set local request.jwt.claims to
  '{"sub":"99999999-9999-4999-8999-999999999999","role":"authenticated"}';
select throws_ok(
  $$ select public.create_organization('Ghost Org', 'PT', gen_random_uuid()) $$,
  '42501',
  'a verified email address is required',
  'a token for a user that no longer exists cannot create an organization'
);

-- ===========================================================================
-- C. Creation, validation and duplicate requests (alice)
-- ===========================================================================

set local request.jwt.claims to
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select isnt(
  public.create_organization('  Alpha Events  ', ' pt ', '11111111-1111-4111-8111-111111111111'),
  null,
  'a verified user creates an organization'
);
select results_eq(
  $$ select name, country_code from public.organizations $$,
  $$ values ('Alpha Events', 'PT') $$,
  'the creator sees the organization; name trimmed, country normalised'
);
select results_eq(
  $$ select role::text, status::text from public.memberships $$,
  $$ values ('owner', 'active') $$,
  'the creator is its active owner'
);
select is(
  public.create_organization('Alpha Events', 'PT', '11111111-1111-4111-8111-111111111111'),
  (select id from public.organizations where name = 'Alpha Events'),
  'retrying the same request returns the same organization'
);
select throws_ok(
  $$ select public.create_organization('Other Name', 'PT', '11111111-1111-4111-8111-111111111111') $$,
  '23505',
  'request_id was already used for a different organization',
  'reusing a request_id with a different name is rejected'
);
select throws_ok(
  $$ select public.create_organization('Alpha Events', 'ES', '11111111-1111-4111-8111-111111111111') $$,
  '23505',
  'request_id was already used for a different organization',
  'reusing a request_id with a different country is rejected'
);
select throws_ok(
  $$ select public.create_organization('   ', 'PT', gen_random_uuid()) $$,
  '22023',
  'organization name must be 1 to 120 characters',
  'a blank name is rejected'
);
select throws_ok(
  $$ select public.create_organization(repeat('x', 121), 'PT', gen_random_uuid()) $$,
  '22023',
  'organization name must be 1 to 120 characters',
  'an over-long name is rejected'
);
select throws_ok(
  $$ select public.create_organization('Alpha Events', 'PT', null) $$,
  '22023',
  'request_id is required',
  'a missing request_id is rejected'
);
select throws_ok(
  $$ select public.create_organization('Alpha Events', 'XX', gen_random_uuid()) $$,
  '22023',
  'country_code must be an ISO 3166-1 alpha-2 code',
  'an unassigned country code is rejected'
);
select throws_ok(
  $$ select public.create_organization('Alpha Events', 'PRT', gen_random_uuid()) $$,
  '22023',
  'country_code must be an ISO 3166-1 alpha-2 code',
  'an alpha-3 country code is rejected'
);
select throws_ok(
  $$ select public.create_organization('Alpha Events', null, gen_random_uuid()) $$,
  '22023',
  'country_code must be an ISO 3166-1 alpha-2 code',
  'a missing country code is rejected'
);

reset role;
set local request.jwt.claims to '';

select is(
  (select count(*)::int from public.organizations
    where created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'retries and rejected calls created no extra organizations'
);
select is(
  (select count(*)::int from public.memberships
    where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  1,
  'retries and rejected calls created no extra memberships'
);

select id as alice_org
  from public.organizations
 where created_by = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' \gset

-- ===========================================================================
-- D. Tenant isolation (bob)
-- ===========================================================================

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

-- Same request_id as alice: keys are scoped to the caller.
select isnt(
  public.create_organization('Beta Catering', 'ES', '11111111-1111-4111-8111-111111111111'),
  :'alice_org'::uuid,
  'another user reusing the same request_id gets a separate organization'
);
select results_eq(
  $$ select name from public.organizations $$,
  $$ values ('Beta Catering') $$,
  'bob sees only his organization'
);
select is(
  (select count(*)::int from public.organizations where id = :'alice_org'),
  0,
  'bob cannot read alice''s organization by id'
);
select is(
  (select count(*)::int from public.memberships where organization_id = :'alice_org'),
  0,
  'bob cannot read alice''s memberships'
);
select is_empty(
  $$ select 1 from public.memberships where user_id is distinct from auth.uid() $$,
  'bob sees no memberships other than his own'
);

-- ===========================================================================
-- E. Direct writes and private data are denied (bob)
-- ===========================================================================

select throws_ok(
  $$ insert into public.organizations (name, country_code, created_by, creation_request_id)
     values ('Direct Org', 'PT', auth.uid(), gen_random_uuid()) $$,
  '42501',
  'permission denied for table organizations',
  'clients cannot insert organizations directly'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, user_id, role, status)
       values (%L, auth.uid(), 'owner', 'active') $$,
    :'alice_org'
  ),
  '42501',
  'permission denied for table memberships',
  'bob cannot make himself an owner of alice''s organization'
);
select throws_ok(
  $$ update public.organizations set name = 'Renamed' $$,
  '42501',
  'permission denied for table organizations',
  'clients cannot update organizations directly'
);
select throws_ok(
  $$ update public.memberships set role = 'member' $$,
  '42501',
  'permission denied for table memberships',
  'clients cannot update memberships directly'
);
select throws_ok(
  $$ delete from public.memberships $$,
  '42501',
  'permission denied for table memberships',
  'clients cannot delete memberships'
);
select throws_ok(
  $$ select * from private.audit_events $$,
  '42501',
  'permission denied for schema private',
  'clients cannot read audit events'
);

-- ===========================================================================
-- F. Atomicity
-- ===========================================================================

reset role;
set local request.jwt.claims to '';

set constraints public.require_initial_owner immediate;
select throws_ok(
  $$ insert into public.organizations (name, country_code, created_by, creation_request_id)
     values ('Ownerless', 'PT', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', gen_random_uuid()) $$,
  '23514',
  'an organization must be created with an active owner',
  'an organization cannot exist without an active owner, even for privileged roles'
);
set constraints public.require_initial_owner deferred;

-- Fault injection: make the owner insert fail inside create_organization.
create function public.zz_test_fail_membership_insert()
returns trigger language plpgsql as $$
begin
  raise exception 'injected failure';
end;
$$;
create trigger zz_test_fail_membership_insert
  before insert on public.memberships
  for each row execute function public.zz_test_fail_membership_insert();

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select throws_ok(
  $$ select public.create_organization('Gamma Hire', 'FR', '33333333-3333-4333-8333-333333333333') $$,
  'P0001',
  'injected failure',
  'create_organization fails when the owner membership cannot be created'
);

reset role;
set local request.jwt.claims to '';

select is(
  (select count(*)::int from public.organizations
    where created_by = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  0,
  'no organization persists when owner creation fails'
);

drop trigger zz_test_fail_membership_insert on public.memberships;
drop function public.zz_test_fail_membership_insert();

-- ===========================================================================
-- G. Sole active Owner protection (privileged role: the triggers apply to
--    every role, including future server-side workflows)
-- ===========================================================================

select throws_ok(
  format($$ update public.memberships set role = 'manager'
             where organization_id = %L $$, :'alice_org'),
  '23514',
  'an organization must keep at least one active owner',
  'the sole active owner cannot be demoted'
);
select throws_ok(
  format($$ update public.memberships set status = 'suspended'
             where organization_id = %L $$, :'alice_org'),
  '23514',
  'an organization must keep at least one active owner',
  'the sole active owner cannot be suspended'
);
select throws_ok(
  format($$ update public.memberships set status = 'removed'
             where organization_id = %L $$, :'alice_org'),
  '23514',
  'an organization must keep at least one active owner',
  'the sole active owner cannot be removed'
);
select throws_ok(
  format($$ delete from public.memberships where organization_id = %L $$, :'alice_org'),
  '23514',
  'memberships are never deleted; set status to removed instead',
  'memberships cannot be deleted'
);
select throws_ok(
  format(
    $$ update public.memberships
          set organization_id = (select id from public.organizations where name = 'Beta Catering')
        where organization_id = %L $$,
    :'alice_org'
  ),
  '23514',
  'a membership cannot change its organization or user',
  'a membership cannot move to another organization'
);
select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, user_id, role, status)
       values (%L, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'owner', 'active') $$,
    :'alice_org'
  ),
  'a second active owner can be added (privileged path)'
);
select lives_ok(
  format(
    $$ update public.memberships set role = 'manager'
        where organization_id = %L
          and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
    :'alice_org'
  ),
  'an owner can be demoted while another active owner remains'
);
select throws_ok(
  format(
    $$ update public.memberships set status = 'removed'
        where organization_id = %L
          and user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' $$,
    :'alice_org'
  ),
  '23514',
  'an organization must keep at least one active owner',
  'the remaining owner is protected once it is the only one'
);

-- ===========================================================================
-- H. Current versus historical memberships
-- ===========================================================================

select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, user_id, role, status)
       values (%L, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member', 'active') $$,
    :'alice_org'
  ),
  'bob joins alpha as a member'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, user_id, role, status)
       values (%L, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member', 'invited') $$,
    :'alice_org'
  ),
  '23505',
  'duplicate key value violates unique constraint "memberships_current_user_key"',
  'a user cannot hold two current memberships in one organization'
);
select lives_ok(
  format(
    $$ update public.memberships set status = 'removed'
        where organization_id = %L
          and user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
    :'alice_org'
  ),
  'bob''s membership is removed'
);
select throws_ok(
  format(
    $$ update public.memberships set status = 'active'
        where organization_id = %L
          and user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
    :'alice_org'
  ),
  '23514',
  'removed memberships are historical; rejoining creates a new membership',
  'a removed membership cannot be reactivated'
);
select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, user_id, role, status)
       values (%L, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'member', 'active') $$,
    :'alice_org'
  ),
  'rejoining creates a new membership'
);
select results_eq(
  format(
    $$ select status::text from public.memberships
        where organization_id = %L
          and user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        order by status $$,
    :'alice_org'
  ),
  $$ values ('active'), ('removed') $$,
  'the removed membership remains as history beside the current one'
);

-- ===========================================================================
-- I. Email invitations (schema support only; no workflow yet)
-- ===========================================================================

select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'new.person@example.test', 'member', 'invited') $$,
    :'alice_org'
  ),
  'an invitation can target an email address without an account'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'new.person@example.test', 'manager', 'invited') $$,
    :'alice_org'
  ),
  '23505',
  'duplicate key value violates unique constraint "memberships_pending_email_key"',
  'an address cannot have two pending invitations to one organization'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'someone@example.test', 'member', 'active') $$,
    :'alice_org'
  ),
  '23514',
  'new row for relation "memberships" violates check constraint "memberships_identity_check"',
  'only an invitation may lack an account'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, role, status)
       values (%L, 'member', 'invited') $$,
    :'alice_org'
  ),
  '23514',
  'new row for relation "memberships" violates check constraint "memberships_identity_check"',
  'an invitation needs an account or an email address'
);
select throws_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'Mixed.Case@Example.test', 'member', 'invited') $$,
    :'alice_org'
  ),
  '23514',
  'new row for relation "memberships" violates check constraint "memberships_invited_email_check"',
  'invitation addresses are stored normalised (lower case, trimmed)'
);
select throws_ok(
  format(
    $$ update public.memberships set invited_email = 'other.person@example.test'
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'an invitation address cannot change; remove the invitation and create a new one',
  'a pending invitation address cannot be changed'
);
select throws_ok(
  format(
    $$ update public.memberships set invited_email = null
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'an invitation address cannot change; remove the invitation and create a new one',
  'a pending invitation address cannot be cleared'
);
select lives_ok(
  format(
    $$ update public.memberships
          set user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status = 'active'
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  'an email invitation can be linked to an account once'
);
select throws_ok(
  format(
    $$ update public.memberships set user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'a membership cannot change its organization or user',
  'a linked account cannot be replaced'
);
select throws_ok(
  format(
    $$ update public.memberships set invited_email = 'other.person@example.test'
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'an invitation address cannot change; remove the invitation and create a new one',
  'an invitation address cannot be changed after linking to an account'
);
select throws_ok(
  format(
    $$ update public.memberships set invited_email = null
        where organization_id = %L and invited_email = 'new.person@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'an invitation address cannot change; remove the invitation and create a new one',
  'an invitation address cannot be cleared after linking to an account'
);
select throws_ok(
  format(
    $$ update public.memberships set invited_email = 'alice.alias@example.test'
        where organization_id = %L
          and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
    :'alice_org'
  ),
  '23514',
  'an invitation address cannot change; remove the invitation and create a new one',
  'an address cannot be added to a membership created without one'
);
select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'wrong.address@example.test', 'member', 'invited') $$,
    :'alice_org'
  ),
  'a mistaken invitation is created'
);
select lives_ok(
  format(
    $$ update public.memberships set status = 'removed'
        where organization_id = %L and invited_email = 'wrong.address@example.test' $$,
    :'alice_org'
  ),
  'an email-only invitation can be removed'
);
select lives_ok(
  format(
    $$ insert into public.memberships (organization_id, invited_email, role, status)
       values (%L, 'right.address@example.test', 'member', 'invited') $$,
    :'alice_org'
  ),
  'a corrected invitation is created as a new membership'
);
select throws_ok(
  format(
    $$ update public.memberships set status = 'active'
        where organization_id = %L and invited_email = 'right.address@example.test' $$,
    :'alice_org'
  ),
  '23514',
  'new row for relation "memberships" violates check constraint "memberships_identity_check"',
  'an email-only invitation cannot become active without an account'
);
select results_eq(
  format(
    $$ select invited_email, status::text from public.memberships
        where organization_id = %L
          and invited_email in ('wrong.address@example.test', 'right.address@example.test')
        order by invited_email $$,
    :'alice_org'
  ),
  $$ values ('right.address@example.test', 'invited'),
            ('wrong.address@example.test', 'removed') $$,
  'the mistaken invitation remains as history with its original address'
);

-- ===========================================================================
-- J. Organizations are never deleted; authorship is preserved
-- ===========================================================================

select throws_ok(
  format($$ delete from public.organizations where id = %L $$, :'alice_org'),
  '23514',
  'organizations are never deleted',
  'organizations cannot be deleted, even by privileged roles'
);
select throws_ok(
  format(
    $$ update public.organizations set created_by = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
        where id = %L $$,
    :'alice_org'
  ),
  '23514',
  'organization identity and authorship cannot change',
  'organization authorship cannot be rewritten'
);
select throws_ok(
  $$ truncate public.memberships $$,
  '23514',
  'memberships cannot be truncated',
  'memberships cannot be truncated'
);
select throws_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  '23503',
  NULL,
  'an account with organizations or memberships cannot be hard-deleted'
);

-- ===========================================================================
-- K. Audit evidence
-- ===========================================================================

select results_eq(
  format(
    $$ select actor_user_id, actor_role, details from private.audit_events
        where organization_id = %L and action = 'organization.created' $$,
    :'alice_org'
  ),
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'authenticated', '{}'::jsonb) $$,
  'organization creation records the authenticated creator and no business data'
);
select results_eq(
  format(
    $$ select actor_user_id, details from private.audit_events
        where organization_id = %L and action = 'membership.created'
        order by id
        limit 1 $$,
    :'alice_org'
  ),
  $$ values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
             '{"role":"owner","status":"active"}'::jsonb) $$,
  'the initial owner membership is recorded with its author'
);
select is(
  (select count(*)::int from private.audit_events
    where organization_id = :'alice_org'
      and action = 'membership.changed'
      and details @> '{"from":{"role":"owner"},"to":{"role":"manager"}}'),
  1,
  'a demotion is recorded with before and after values'
);
select is(
  (select count(*)::int from private.audit_events
    where organization_id = :'alice_org'
      and action = 'membership.changed'
      and details @> '{"account_linked":true}'),
  1,
  'linking an invitation to an account is recorded'
);
select is_empty(
  $$ select id from private.audit_events
      where details::text ilike '%@%'
         or details::text ilike '%alpha%'
         or details::text ilike '%beta%' $$,
  'audit details contain no email addresses or organization names'
);
select throws_ok(
  $$ update private.audit_events set action = 'membership.changed' $$,
  '23514',
  'audit events are append-only',
  'audit events cannot be updated'
);
select throws_ok(
  $$ delete from private.audit_events $$,
  '23514',
  'audit events are append-only',
  'audit events cannot be deleted'
);
select throws_ok(
  $$ truncate private.audit_events $$,
  '23514',
  'audit_events cannot be truncated',
  'audit events cannot be truncated'
);

-- ===========================================================================
-- L. Visibility follows membership status
-- ===========================================================================

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}';

select results_eq(
  $$ select name from public.organizations order by name $$,
  $$ values ('Alpha Events'), ('Beta Catering') $$,
  'a user with active memberships in two organizations sees both'
);
select is(
  (select count(*)::int from public.memberships),
  3,
  'a user sees all of their own memberships, including historical ones'
);

set local request.jwt.claims to
  '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';

select is(
  (select count(*)::int from public.memberships),
  1,
  'an owner currently sees only their own membership (member list deferred)'
);

reset role;
set local request.jwt.claims to '';

select lives_ok(
  format(
    $$ update public.memberships set status = 'suspended'
        where organization_id = %L
          and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
    :'alice_org'
  ),
  'a non-owner membership can be suspended'
);

set local role authenticated;
set local request.jwt.claims to
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.organizations $$,
  'a suspended member no longer sees the organization'
);
select results_eq(
  $$ select status::text from public.memberships $$,
  $$ values ('suspended') $$,
  'a suspended member still sees their own membership'
);

select * from finish();
rollback;
