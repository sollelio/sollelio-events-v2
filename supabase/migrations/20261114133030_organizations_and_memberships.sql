-- Organization and membership foundation (Increment 1, Step 3).
-- Decisions: docs/decisions/0004-organization-membership-foundation.md
--
-- Invariants enforced here:
--   * An organization and its first active Owner are created atomically, by
--     an authenticated user with a verified email address.
--   * Retrying a creation request returns the same organization.
--   * An organization always keeps at least one active Owner.
--   * At most one current (non-removed) membership per user and organization.
--     Removed memberships are historical and never change again.
--   * Organizations and memberships are never deleted; memberships never move
--     between organizations; authorship columns and invitation addresses
--     never change.
--   * Users read only their own memberships and the organizations in which
--     they hold an active membership. Clients have no direct write access.
--   * Organization and membership changes leave an append-only audit record
--     that holds no names or email addresses.

-- ---------------------------------------------------------------------------
-- Internal schema: not exposed through the Data API, no access for API roles.
-- ---------------------------------------------------------------------------

create schema private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Reference data: ISO 3166-1 alpha-2 country codes
-- (249 officially assigned codes; source: Debian iso-codes 4.20.1).
-- Locale, timezone and currency are separate concepts and are not derived
-- from the country here.
-- ---------------------------------------------------------------------------

create table private.country_codes (
  code text primary key
    constraint country_codes_code_check check (code ~ '^[A-Z]{2}$')
);

insert into private.country_codes (code) values
  ('AD'), ('AE'), ('AF'), ('AG'), ('AI'), ('AL'), ('AM'), ('AO'), ('AQ'),
  ('AR'), ('AS'), ('AT'), ('AU'), ('AW'), ('AX'), ('AZ'), ('BA'), ('BB'),
  ('BD'), ('BE'), ('BF'), ('BG'), ('BH'), ('BI'), ('BJ'), ('BL'), ('BM'),
  ('BN'), ('BO'), ('BQ'), ('BR'), ('BS'), ('BT'), ('BV'), ('BW'), ('BY'),
  ('BZ'), ('CA'), ('CC'), ('CD'), ('CF'), ('CG'), ('CH'), ('CI'), ('CK'),
  ('CL'), ('CM'), ('CN'), ('CO'), ('CR'), ('CU'), ('CV'), ('CW'), ('CX'),
  ('CY'), ('CZ'), ('DE'), ('DJ'), ('DK'), ('DM'), ('DO'), ('DZ'), ('EC'),
  ('EE'), ('EG'), ('EH'), ('ER'), ('ES'), ('ET'), ('FI'), ('FJ'), ('FK'),
  ('FM'), ('FO'), ('FR'), ('GA'), ('GB'), ('GD'), ('GE'), ('GF'), ('GG'),
  ('GH'), ('GI'), ('GL'), ('GM'), ('GN'), ('GP'), ('GQ'), ('GR'), ('GS'),
  ('GT'), ('GU'), ('GW'), ('GY'), ('HK'), ('HM'), ('HN'), ('HR'), ('HT'),
  ('HU'), ('ID'), ('IE'), ('IL'), ('IM'), ('IN'), ('IO'), ('IQ'), ('IR'),
  ('IS'), ('IT'), ('JE'), ('JM'), ('JO'), ('JP'), ('KE'), ('KG'), ('KH'),
  ('KI'), ('KM'), ('KN'), ('KP'), ('KR'), ('KW'), ('KY'), ('KZ'), ('LA'),
  ('LB'), ('LC'), ('LI'), ('LK'), ('LR'), ('LS'), ('LT'), ('LU'), ('LV'),
  ('LY'), ('MA'), ('MC'), ('MD'), ('ME'), ('MF'), ('MG'), ('MH'), ('MK'),
  ('ML'), ('MM'), ('MN'), ('MO'), ('MP'), ('MQ'), ('MR'), ('MS'), ('MT'),
  ('MU'), ('MV'), ('MW'), ('MX'), ('MY'), ('MZ'), ('NA'), ('NC'), ('NE'),
  ('NF'), ('NG'), ('NI'), ('NL'), ('NO'), ('NP'), ('NR'), ('NU'), ('NZ'),
  ('OM'), ('PA'), ('PE'), ('PF'), ('PG'), ('PH'), ('PK'), ('PL'), ('PM'),
  ('PN'), ('PR'), ('PS'), ('PT'), ('PW'), ('PY'), ('QA'), ('RE'), ('RO'),
  ('RS'), ('RU'), ('RW'), ('SA'), ('SB'), ('SC'), ('SD'), ('SE'), ('SG'),
  ('SH'), ('SI'), ('SJ'), ('SK'), ('SL'), ('SM'), ('SN'), ('SO'), ('SR'),
  ('SS'), ('ST'), ('SV'), ('SX'), ('SY'), ('SZ'), ('TC'), ('TD'), ('TF'),
  ('TG'), ('TH'), ('TJ'), ('TK'), ('TL'), ('TM'), ('TN'), ('TO'), ('TR'),
  ('TT'), ('TV'), ('TW'), ('TZ'), ('UA'), ('UG'), ('UM'), ('US'), ('UY'),
  ('UZ'), ('VA'), ('VC'), ('VE'), ('VG'), ('VI'), ('VN'), ('VU'), ('WF'),
  ('WS'), ('YE'), ('YT'), ('ZA'), ('ZM'), ('ZW');

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.membership_role as enum ('owner', 'manager', 'member');

create type public.membership_status as enum (
  'invited',
  'active',
  'suspended',
  'removed'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint organizations_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  country_code text not null references private.country_codes (code),
  -- Authorship: the authenticated user who created the organization.
  created_by uuid not null references auth.users (id) on delete restrict,
  -- Client-generated idempotency key, unique per creator.
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint organizations_creation_request_key
    unique (created_by, creation_request_id)
);

comment on table public.organizations is
  'Customer organizations (tenants). Created only through public.create_organization; never deleted.';
comment on column public.organizations.country_code is
  'ISO 3166-1 alpha-2. Locale, timezone and currency are separate settings.';
comment on column public.organizations.creation_request_id is
  'Idempotency key supplied once per creation attempt; retries return the same organization.';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete restrict,
  -- Null only for an invitation to an email address without an account.
  user_id uuid references auth.users (id) on delete restrict,
  invited_email text
    constraint memberships_invited_email_check
    check (
      invited_email = lower(btrim(invited_email))
      and char_length(invited_email) between 3 and 320
      and invited_email like '%_@_%'
    ),
  role public.membership_role not null,
  status public.membership_status not null,
  created_at timestamptz not null default now(),
  -- Without an account, a membership can only be a pending or removed email
  -- invitation.
  constraint memberships_identity_check
    check (
      user_id is not null
      or (invited_email is not null and status in ('invited', 'removed'))
    )
);

comment on table public.memberships is
  'Organization-specific memberships. Lifecycle is a status; rows are never deleted. Removed rows are history; rejoining creates a new row.';
comment on column public.memberships.invited_email is
  'Address of an invitation for a person without an account. Immutable after insertion. No workflow uses it yet.';

-- At most one current membership per account and organization.
create unique index memberships_current_user_key
  on public.memberships (organization_id, user_id)
  where status <> 'removed';

-- At most one pending email-only invitation per address and organization.
create unique index memberships_pending_email_key
  on public.memberships (organization_id, invited_email)
  where status = 'invited' and user_id is null;

create index memberships_user_id_idx on public.memberships (user_id);

create index memberships_active_owners_idx
  on public.memberships (organization_id)
  where role = 'owner' and status = 'active';

create table private.audit_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  organization_id uuid not null
    references public.organizations (id) on delete restrict,
  -- auth.uid() of the acting user; null for privileged maintenance.
  actor_user_id uuid,
  -- JWT role ('authenticated', 'service_role') or the database session user.
  actor_role text not null,
  action text not null
    constraint audit_events_action_check
    check (
      action in (
        'organization.created',
        'membership.created',
        'membership.changed'
      )
    ),
  subject_id uuid not null,
  -- Roles, statuses and flags only: never names or email addresses.
  details jsonb not null default '{}'::jsonb
);

create index audit_events_organization_idx
  on private.audit_events (organization_id, occurred_at);

-- ---------------------------------------------------------------------------
-- Trigger functions (private; SECURITY DEFINER where they must see all rows
-- regardless of the caller's RLS; not executable by any API role)
-- ---------------------------------------------------------------------------

create function private.record_audit_event(
  p_organization_id uuid,
  p_action text,
  p_subject_id uuid,
  p_details jsonb
)
returns void
language sql
set search_path = ''
as $$
  insert into private.audit_events (
    organization_id, actor_user_id, actor_role, action, subject_id, details
  )
  values (
    p_organization_id,
    auth.uid(),
    coalesce(auth.jwt() ->> 'role', session_user::text),
    p_action,
    p_subject_id,
    p_details
  );
$$;

create function private.audit_organization_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.record_audit_event(
    new.id, 'organization.created', new.id, '{}'::jsonb
  );
  return null;
end;
$$;

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_audit_event(
      new.organization_id,
      'membership.created',
      new.id,
      jsonb_build_object('role', new.role, 'status', new.status)
    );
  elsif new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.user_id is distinct from old.user_id then
    perform private.record_audit_event(
      new.organization_id,
      'membership.changed',
      new.id,
      jsonb_build_object(
        'from', jsonb_build_object('role', old.role, 'status', old.status),
        'to', jsonb_build_object('role', new.role, 'status', new.status),
        'account_linked', old.user_id is null and new.user_id is not null
      )
    );
  end if;
  return null;
end;
$$;

-- Protects organization identity and authorship; organizations are never
-- deleted.
create function private.guard_organization_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'organizations are never deleted' using errcode = '23514';
  end if;

  if new.id <> old.id
     or new.created_by <> old.created_by
     or new.creation_request_id <> old.creation_request_id
     or new.created_at <> old.created_at then
    raise exception 'organization identity and authorship cannot change'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Protects membership history and the last active Owner.
create function private.guard_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_owners integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'memberships are never deleted; set status to removed instead'
      using errcode = '23514';
  end if;

  if old.status = 'removed' then
    raise exception 'removed memberships are historical; rejoining creates a new membership'
      using errcode = '23514';
  end if;

  -- user_id may be set once (when an email invitation is linked to an
  -- account), never changed afterwards.
  if new.id <> old.id
     or new.organization_id <> old.organization_id
     or new.created_at <> old.created_at
     or (old.user_id is not null and new.user_id is distinct from old.user_id) then
    raise exception 'a membership cannot change its organization or user'
      using errcode = '23514';
  end if;

  -- The invitation address is fixed at insertion, including after the
  -- invitation is linked to an account. A mistaken invitation is removed and
  -- recreated, so history is preserved.
  if new.invited_email is distinct from old.invited_email then
    raise exception 'an invitation address cannot change; remove the invitation and create a new one'
      using errcode = '23514';
  end if;

  if old.role = 'owner' and old.status = 'active'
     and (new.role <> 'owner' or new.status <> 'active') then
    -- Serialize owner changes per organization, then lock the other active
    -- owners so that concurrent demotions cannot both succeed.
    perform 1
      from public.organizations o
     where o.id = old.organization_id
       for update;

    perform 1
      from public.memberships m
     where m.organization_id = old.organization_id
       and m.role = 'owner'
       and m.status = 'active'
       and m.id <> old.id
       for update;
    get diagnostics remaining_owners = row_count;

    if remaining_owners = 0 then
      raise exception 'an organization must keep at least one active owner'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- Deferred to commit: every new organization must have an active Owner by the
-- end of the transaction that created it.
create function private.require_initial_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
      from public.memberships m
     where m.organization_id = new.id
       and m.role = 'owner'
       and m.status = 'active'
  ) then
    raise exception 'an organization must be created with an active owner'
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit events are append-only' using errcode = '23514';
end;
$$;

create function private.prevent_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% cannot be truncated', tg_table_name using errcode = '23514';
end;
$$;

revoke all on function private.record_audit_event(uuid, text, uuid, jsonb) from public;
revoke all on function private.audit_organization_insert() from public;
revoke all on function private.audit_membership_change() from public;
revoke all on function private.guard_organization_change() from public;
revoke all on function private.guard_membership_change() from public;
revoke all on function private.require_initial_owner() from public;
revoke all on function private.prevent_audit_mutation() from public;
revoke all on function private.prevent_truncate() from public;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger guard_organization_change
  before update or delete on public.organizations
  for each row execute function private.guard_organization_change();

create trigger audit_organization_insert
  after insert on public.organizations
  for each row execute function private.audit_organization_insert();

create constraint trigger require_initial_owner
  after insert on public.organizations
  deferrable initially deferred
  for each row execute function private.require_initial_owner();

create trigger guard_membership_change
  before update or delete on public.memberships
  for each row execute function private.guard_membership_change();

create trigger audit_membership_change
  after insert or update on public.memberships
  for each row execute function private.audit_membership_change();

create trigger prevent_audit_mutation
  before update or delete on private.audit_events
  for each row execute function private.prevent_audit_mutation();

create trigger prevent_truncate
  before truncate on public.organizations
  for each statement execute function private.prevent_truncate();

create trigger prevent_truncate
  before truncate on public.memberships
  for each statement execute function private.prevent_truncate();

create trigger prevent_truncate
  before truncate on private.audit_events
  for each statement execute function private.prevent_truncate();

-- ---------------------------------------------------------------------------
-- Organization creation (the only write path for clients)
-- ---------------------------------------------------------------------------

-- Creates an organization with the caller as its first active Owner, in one
-- transaction. The caller must have a verified email address (checked here,
-- independently of the Auth "Confirm email" setting). The owner is always
-- auth.uid(); no organization or user identifier is accepted from the client.
-- Calling again with the same request_id returns the same organization
-- without creating anything.
create function public.create_organization(
  organization_name text,
  country_code text,
  request_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  clean_name text := btrim(organization_name);
  clean_country text := upper(btrim(country_code));
  caller_verified boolean;
  new_organization_id uuid;
  existing_name text;
  existing_country text;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select u.email_confirmed_at is not null and u.deleted_at is null
    into caller_verified
    from auth.users u
   where u.id = caller_id;

  if not coalesce(caller_verified, false) then
    raise exception 'a verified email address is required'
      using errcode = '42501';
  end if;

  if request_id is null then
    raise exception 'request_id is required' using errcode = '22023';
  end if;

  if clean_name is null or char_length(clean_name) not between 1 and 120 then
    raise exception 'organization name must be 1 to 120 characters'
      using errcode = '22023';
  end if;

  if clean_country is null or not exists (
    select 1 from private.country_codes c where c.code = clean_country
  ) then
    raise exception 'country_code must be an ISO 3166-1 alpha-2 code'
      using errcode = '22023';
  end if;

  insert into public.organizations (
    name, country_code, created_by, creation_request_id
  )
  values (clean_name, clean_country, caller_id, request_id)
  on conflict on constraint organizations_creation_request_key do nothing
  returning id into new_organization_id;

  if new_organization_id is null then
    -- Retry or concurrent duplicate of an earlier request by the same user.
    select o.id, o.name, o.country_code
      into new_organization_id, existing_name, existing_country
      from public.organizations o
     where o.created_by = caller_id
       and o.creation_request_id = request_id;

    if existing_name is distinct from clean_name
       or existing_country is distinct from clean_country then
      raise exception 'request_id was already used for a different organization'
        using errcode = '23505';
    end if;

    return new_organization_id;
  end if;

  insert into public.memberships (organization_id, user_id, role, status)
  values (new_organization_id, caller_id, 'owner', 'active');

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, uuid) from public, anon;
grant execute on function public.create_organization(text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security (default deny)
-- ---------------------------------------------------------------------------

-- Supabase grants API roles full table privileges by default; narrow them.
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.memberships to authenticated;

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table private.audit_events enable row level security;
alter table private.country_codes enable row level security;

-- Non-recursive: this policy reads memberships, whose own policy does not
-- read organizations.
create policy "Active members can read their organizations"
  on public.organizations
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.memberships m
       where m.organization_id = organizations.id
         and m.user_id = (select auth.uid())
         and m.status = 'active'
    )
  );

-- Members see only their own memberships. Owner/Manager access to the member
-- list arrives with the screen that needs it (see ADR 0004).
create policy "Users can read their own memberships"
  on public.memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No INSERT, UPDATE or DELETE policies: clients cannot write these tables
-- directly. private tables have no policies and no API-role grants.
