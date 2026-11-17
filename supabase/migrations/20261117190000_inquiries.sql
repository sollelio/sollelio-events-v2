-- Inquiries: manual registration, close and reopen (Increment 2, Step 2.1).
-- Decisions: docs/decisions/0008-inquiry-registration.md
--
-- Invariants enforced here:
--   * An inquiry belongs to exactly one organization, for ever.
--   * Its original intake (source, the client's own message and/or a staff
--     summary, receipt time, requester details as given, event hints) and its
--     authorship never change. At least one form of request description
--     exists; everything else may be missing.
--   * Status is open or closed. Closing records a reason, who and when;
--     reopening clears them. History lives in the audit log. Closing an
--     inquiry implies nothing about any Event.
--   * Only verified users with an active Owner or Manager membership in the
--     inquiry's organization can read or change it. Clients write only
--     through the functions below.
--   * Retrying a creation request returns the same inquiry.
--   * Inquiries are never deleted or truncated.
--   * Audit events hold no message text, names, phone numbers or email
--     addresses.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.inquiry_source as enum (
  'phone',
  'whatsapp',
  'email',
  'social_media',
  'in_person',
  'website',
  'referral',
  'other'
);

create type public.inquiry_status as enum ('open', 'closed');

create type public.inquiry_close_reason as enum (
  'spam',
  'duplicate',
  'not_pursued',
  'registered_in_error'
);

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations (id) on delete restrict,
  source public.inquiry_source not null,
  -- The client's own words, verbatim (written channels).
  client_message text
    constraint inquiries_client_message_check
    check (char_length(client_message) between 1 and 10000 and client_message ~ '\S'),
  -- Written by staff for oral or unavailable messages.
  staff_summary text
    constraint inquiries_staff_summary_check
    check (char_length(staff_summary) between 1 and 5000 and staff_summary ~ '\S'),
  received_at timestamptz not null,
  -- Requester details exactly as given; not a Contact.
  requester_name text
    constraint inquiries_requester_name_check
    check (requester_name = btrim(requester_name) and char_length(requester_name) between 1 and 200),
  requester_phone text
    constraint inquiries_requester_phone_check
    check (requester_phone = btrim(requester_phone) and char_length(requester_phone) between 1 and 40),
  requester_email text
    constraint inquiries_requester_email_check
    check (requester_email = btrim(requester_email) and char_length(requester_email) between 3 and 320),
  requested_event_date date
    constraint inquiries_requested_event_date_check
    check (requested_event_date between date '2000-01-01' and date '2100-12-31'),
  estimated_guests integer
    constraint inquiries_estimated_guests_check
    check (estimated_guests between 1 and 100000),
  status public.inquiry_status not null default 'open',
  close_reason public.inquiry_close_reason,
  closed_at timestamptz,
  closed_by uuid references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  creation_request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint inquiries_description_check
    check (client_message is not null or staff_summary is not null),
  constraint inquiries_received_at_check
    check (received_at >= timestamptz '2000-01-01 00:00:00+00'
           and received_at <= created_at + interval '1 hour'),
  constraint inquiries_closure_check
    check (
      (status = 'open' and close_reason is null and closed_at is null and closed_by is null)
      or (status = 'closed' and close_reason is not null and closed_at is not null and closed_by is not null)
    ),
  constraint inquiries_creation_request_key
    unique (organization_id, created_by, creation_request_id)
);

comment on table public.inquiries is
  'Incoming client requests. Original intake is immutable; status is open or closed; never deleted. Written only through create_inquiry, close_inquiry and reopen_inquiry.';
comment on column public.inquiries.client_message is
  'The client''s own message, verbatim. At least one of client_message and staff_summary is present.';
comment on column public.inquiries.staff_summary is
  'Staff-written account of an oral or unavailable request. Not the client''s words.';
comment on column public.inquiries.received_at is
  'When the client made contact (UTC instant). Organization timezone is a future setting.';
comment on column public.inquiries.requested_event_date is
  'Event date as given by the client; date-only, no timezone.';

-- Lists: one organization, one status, newest first.
create index inquiries_list_idx
  on public.inquiries (organization_id, status, received_at desc, id desc);

-- ---------------------------------------------------------------------------
-- Access helper (used by RLS and by the write functions)
-- ---------------------------------------------------------------------------

-- RLS policies run with the caller's privileges, and the caller cannot read
-- auth.users, so the verification check needs a SECURITY DEFINER helper. It
-- lives in its own schema, `authz`, which holds only such predicates about
-- the caller: the private schema stays closed to API roles (ADR 0004), and
-- `authz` is not exposed by the Data API.
create schema authz;
revoke all on schema authz from public;
grant usage on schema authz to authenticated;

-- True when the caller is a verified, non-deleted, non-anonymous user with an
-- active Owner or Manager membership in the organization. Members need a
-- future assignment mechanism and get no access. It only ever reads the
-- caller's own rows.
create function authz.can_access_inquiries(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
      join auth.users u on u.id = m.user_id
     where m.organization_id = p_organization_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and m.role in ('owner', 'manager')
       and u.email_confirmed_at is not null
       and u.deleted_at is null
       and coalesce(u.is_anonymous, false) = false
  );
$$;

revoke all on function authz.can_access_inquiries(uuid) from public;
grant execute on function authz.can_access_inquiries(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Protection and audit triggers
-- ---------------------------------------------------------------------------

-- Original intake, organization and authorship never change; only the
-- closure fields do. Inquiries are never deleted.
create function private.guard_inquiry_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'inquiries are never deleted; close them instead'
      using errcode = '23514';
  end if;

  if new.id is distinct from old.id
     or new.organization_id is distinct from old.organization_id
     or new.source is distinct from old.source
     or new.client_message is distinct from old.client_message
     or new.staff_summary is distinct from old.staff_summary
     or new.received_at is distinct from old.received_at
     or new.requester_name is distinct from old.requester_name
     or new.requester_phone is distinct from old.requester_phone
     or new.requester_email is distinct from old.requester_email
     or new.requested_event_date is distinct from old.requested_event_date
     or new.estimated_guests is distinct from old.estimated_guests
     or new.created_by is distinct from old.created_by
     or new.creation_request_id is distinct from old.creation_request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'the original intake and authorship of an inquiry cannot change'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Roles, statuses and reasons only: never message text or requester details.
create function private.audit_inquiry_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_audit_event(
      new.organization_id,
      'inquiry.created',
      new.id,
      jsonb_build_object('source', new.source)
    );
  elsif new.status is distinct from old.status then
    if new.status = 'closed' then
      perform private.record_audit_event(
        new.organization_id,
        'inquiry.closed',
        new.id,
        jsonb_build_object('reason', new.close_reason)
      );
    else
      perform private.record_audit_event(
        new.organization_id,
        'inquiry.reopened',
        new.id,
        jsonb_build_object('previous_reason', old.close_reason)
      );
    end if;
  end if;
  return null;
end;
$$;

revoke all on function private.guard_inquiry_change() from public;
revoke all on function private.audit_inquiry_change() from public;

create trigger guard_inquiry_change
  before update or delete on public.inquiries
  for each row execute function private.guard_inquiry_change();

create trigger audit_inquiry_change
  after insert or update on public.inquiries
  for each row execute function private.audit_inquiry_change();

create trigger prevent_truncate
  before truncate on public.inquiries
  for each statement execute function private.prevent_truncate();

-- The audit log accepts the inquiry actions.
alter table private.audit_events
  drop constraint audit_events_action_check;
alter table private.audit_events
  add constraint audit_events_action_check
  check (
    action in (
      'organization.created',
      'membership.created',
      'membership.changed',
      'inquiry.created',
      'inquiry.closed',
      'inquiry.reopened'
    )
  );

-- ---------------------------------------------------------------------------
-- Write functions (the only client write paths)
-- ---------------------------------------------------------------------------

-- Registers an inquiry in an organization the caller may work in. The author
-- is always auth.uid(). Calling again with the same request id returns the
-- same inquiry; reusing it with different intake fails with 23505.
create function public.create_inquiry(
  p_organization_id uuid,
  p_request_id uuid,
  p_source public.inquiry_source,
  p_client_message text,
  p_staff_summary text,
  p_received_at timestamptz,
  p_requester_name text,
  p_requester_phone text,
  p_requester_email text,
  p_requested_event_date date,
  p_estimated_guests integer
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  received timestamptz := coalesce(p_received_at, now());
  new_id uuid;
  existing public.inquiries%rowtype;
begin
  if caller_id is null or p_organization_id is null
     or not authz.can_access_inquiries(p_organization_id) then
    raise exception 'not allowed to register inquiries in this organization'
      using errcode = '42501';
  end if;

  if p_request_id is null or p_source is null then
    raise exception 'request_id and source are required' using errcode = '22023';
  end if;

  if (p_client_message is null or p_client_message !~ '\S')
     and (p_staff_summary is null or p_staff_summary !~ '\S') then
    raise exception 'a client message or a staff summary is required'
      using errcode = '22023';
  end if;

  if char_length(p_client_message) > 10000 or char_length(p_staff_summary) > 5000
     or char_length(p_requester_name) > 200 or char_length(p_requester_phone) > 40
     or char_length(p_requester_email) > 320 then
    raise exception 'a field is too long' using errcode = '22023';
  end if;

  if received < timestamptz '2000-01-01 00:00:00+00'
     or received > now() + interval '1 hour' then
    raise exception 'received_at is out of range' using errcode = '22023';
  end if;

  if p_estimated_guests is not null and p_estimated_guests not between 1 and 100000 then
    raise exception 'estimated_guests is out of range' using errcode = '22023';
  end if;

  if p_requested_event_date is not null
     and p_requested_event_date not between date '2000-01-01' and date '2100-12-31' then
    raise exception 'requested_event_date is out of range' using errcode = '22023';
  end if;

  insert into public.inquiries (
    organization_id, source, client_message, staff_summary, received_at,
    requester_name, requester_phone, requester_email,
    requested_event_date, estimated_guests, created_by, creation_request_id
  )
  values (
    p_organization_id, p_source,
    case when p_client_message ~ '\S' then p_client_message end,
    case when p_staff_summary ~ '\S' then p_staff_summary end,
    received,
    nullif(btrim(p_requester_name), ''),
    nullif(btrim(p_requester_phone), ''),
    nullif(btrim(p_requester_email), ''),
    p_requested_event_date, p_estimated_guests, caller_id, p_request_id
  )
  on conflict on constraint inquiries_creation_request_key do nothing
  returning id into new_id;

  if new_id is not null then
    return new_id;
  end if;

  -- Retry or concurrent duplicate of an earlier request by the same user.
  select * into existing
    from public.inquiries i
   where i.organization_id = p_organization_id
     and i.created_by = caller_id
     and i.creation_request_id = p_request_id;

  if existing.source is distinct from p_source
     or existing.client_message is distinct from (case when p_client_message ~ '\S' then p_client_message end)
     or existing.staff_summary is distinct from (case when p_staff_summary ~ '\S' then p_staff_summary end)
     or existing.requester_name is distinct from nullif(btrim(p_requester_name), '')
     or existing.requester_phone is distinct from nullif(btrim(p_requester_phone), '')
     or existing.requester_email is distinct from nullif(btrim(p_requester_email), '')
     or existing.requested_event_date is distinct from p_requested_event_date
     or existing.estimated_guests is distinct from p_estimated_guests
     or (p_received_at is not null and existing.received_at is distinct from p_received_at) then
    raise exception 'request_id was already used for a different inquiry'
      using errcode = '23505';
  end if;

  return existing.id;
end;
$$;

-- Closes an open inquiry with a reason. Closing an already closed inquiry
-- changes nothing (a retry). An inquiry the caller may not work on is
-- reported exactly like one that does not exist.
create function public.close_inquiry(
  p_inquiry_id uuid,
  p_reason public.inquiry_close_reason
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.inquiries%rowtype;
begin
  select * into target from public.inquiries i where i.id = p_inquiry_id for update;

  if not found or auth.uid() is null
     or not authz.can_access_inquiries(target.organization_id) then
    raise exception 'inquiry not found or not allowed' using errcode = '42501';
  end if;

  if p_reason is null then
    raise exception 'a close reason is required' using errcode = '22023';
  end if;

  if target.status = 'closed' then
    return;
  end if;

  update public.inquiries
     set status = 'closed', close_reason = p_reason,
         closed_at = now(), closed_by = auth.uid()
   where id = target.id;
end;
$$;

-- Reopens a closed inquiry. Reopening an open inquiry changes nothing.
create function public.reopen_inquiry(p_inquiry_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.inquiries%rowtype;
begin
  select * into target from public.inquiries i where i.id = p_inquiry_id for update;

  if not found or auth.uid() is null
     or not authz.can_access_inquiries(target.organization_id) then
    raise exception 'inquiry not found or not allowed' using errcode = '42501';
  end if;

  if target.status = 'open' then
    return;
  end if;

  update public.inquiries
     set status = 'open', close_reason = null, closed_at = null, closed_by = null
   where id = target.id;
end;
$$;

revoke all on function public.create_inquiry(uuid, uuid, public.inquiry_source, text, text, timestamptz, text, text, text, date, integer) from public, anon;
revoke all on function public.close_inquiry(uuid, public.inquiry_close_reason) from public, anon;
revoke all on function public.reopen_inquiry(uuid) from public, anon;
grant execute on function public.create_inquiry(uuid, uuid, public.inquiry_source, text, text, timestamptz, text, text, text, date, integer) to authenticated;
grant execute on function public.close_inquiry(uuid, public.inquiry_close_reason) to authenticated;
grant execute on function public.reopen_inquiry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security (default deny)
-- ---------------------------------------------------------------------------

revoke all on table public.inquiries from anon, authenticated;
grant select on table public.inquiries to authenticated;

alter table public.inquiries enable row level security;

create policy "Owners and managers can read their organization's inquiries"
  on public.inquiries
  for select
  to authenticated
  using (authz.can_access_inquiries(organization_id));

-- No INSERT, UPDATE or DELETE policies: clients cannot write directly.
