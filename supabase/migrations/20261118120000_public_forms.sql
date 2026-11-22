-- Versioned forms and public Inquiry intake (Increment 2, Step 2.2a).
-- Decisions: docs/decisions/0009-versioned-public-forms.md
--
-- Invariants enforced here:
--   * Forms belong to one organization and have a purpose (only 'inquiry'
--     so far). Versions are drafts until published; published versions and
--     their questions never change and are never deleted.
--   * Publishing validates the questions, and for Inquiry forms the core
--     field bindings: a required long-text message, at least one of email
--     or phone, and the right kind for every bound field.
--   * Public links point at a form, not a version. At most one active link
--     per form; revoked links stay as history.
--   * Public submissions and their answers are immutable and never deleted.
--     Each answer belongs to a question of the version that was answered.
--   * Public reads and writes go only through two functions in schema
--     form_service, executable only by the role public_form_service, which
--     the Next.js server alone uses. The role has no other privileges and is
--     created NOLOGIN; an operator enables login per environment. API roles
--     (anon, authenticated) cannot call them; no table is readable by anon.
--   * A submission may answer the current published version, or a previous
--     one for 24 hours after it was superseded.
--   * Rate limits per link, and per client fingerprint when the server has a
--     trusted client address (an HMAC computed by the server; no IP address
--     is stored).
--   * Inquiry submissions create an Inquiry with channel 'public_form', no
--     author and no source. Manual registration is unchanged.
--   * Only verified, active Owners and Managers read or manage forms, links,
--     submissions and answers.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.form_purpose as enum ('inquiry');

create type public.form_question_kind as enum (
  'short_text',
  'long_text',
  'number',
  'date',
  'single_choice',
  'multiple_choice'
);

-- Inquiry columns a question can fill.
create type public.form_binding as enum (
  'requester_name',
  'requester_email',
  'requester_phone',
  'client_message',
  'requested_event_date',
  'estimated_guests'
);

create type public.inquiry_submission_channel as enum ('staff_entry', 'public_form');

-- ---------------------------------------------------------------------------
-- Forms, versions and questions
-- ---------------------------------------------------------------------------

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  purpose public.form_purpose not null,
  name text not null
    constraint forms_name_check check (name = btrim(name) and char_length(name) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint forms_organization_purpose_key unique (organization_id, purpose),
  constraint forms_id_organization_key unique (id, organization_id)
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null,
  organization_id uuid not null,
  version integer not null constraint form_versions_version_check check (version >= 1),
  title text not null
    constraint form_versions_title_check check (title = btrim(title) and char_length(title) between 1 and 120),
  intro text
    constraint form_versions_intro_check check (char_length(intro) between 1 and 1000),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users (id) on delete restrict,
  constraint form_versions_form_fkey foreign key (form_id, organization_id)
    references public.forms (id, organization_id) on delete restrict,
  constraint form_versions_publication_check check ((published_at is null) = (published_by is null)),
  constraint form_versions_number_key unique (form_id, version),
  constraint form_versions_id_organization_key unique (id, organization_id),
  constraint form_versions_id_form_key unique (id, form_id)
);

-- At most one draft per form.
create unique index form_versions_one_draft_key on public.form_versions (form_id)
  where published_at is null;

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null,
  organization_id uuid not null,
  position integer not null constraint form_questions_position_check check (position between 1 and 30),
  kind public.form_question_kind not null,
  label text not null
    constraint form_questions_label_check check (label = btrim(label) and char_length(label) between 1 and 200),
  help_text text
    constraint form_questions_help_text_check check (char_length(help_text) between 1 and 500),
  required boolean not null default false,
  -- Choices: [{"key": "...", "label": "..."}]; validated when publishing.
  options jsonb,
  binding public.form_binding,
  constraint form_questions_version_fkey foreign key (form_version_id, organization_id)
    references public.form_versions (id, organization_id) on delete restrict,
  constraint form_questions_options_check check (
    (kind in ('single_choice', 'multiple_choice')) = (options is not null)
    and (options is null or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 1 and 20))
  ),
  constraint form_questions_position_key unique (form_version_id, position),
  constraint form_questions_id_version_key unique (id, form_version_id)
);

create unique index form_questions_binding_key on public.form_questions (form_version_id, binding)
  where binding is not null;

comment on table public.forms is
  'Organization-owned forms. Purpose decides what a submission creates (inquiry: an Inquiry).';
comment on table public.form_versions is
  'Draft (published_at null) or published. Published versions and their questions are immutable.';
comment on column public.form_questions.binding is
  'Inquiry column filled by this answer. Validated against the kind when publishing.';

-- ---------------------------------------------------------------------------
-- Public links, submissions and answers
-- ---------------------------------------------------------------------------

create table public.public_form_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  form_id uuid not null,
  -- 22 URL-safe characters from a random UUID (122 random bits).
  public_key text not null unique
    constraint public_form_links_key_check check (public_key ~ '^[A-Za-z0-9_-]{22}$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete restrict,
  constraint public_form_links_form_fkey foreign key (form_id, organization_id)
    references public.forms (id, organization_id) on delete restrict,
  constraint public_form_links_revocation_check check ((revoked_at is null) = (revoked_by is null)),
  constraint public_form_links_id_form_key unique (id, form_id)
);

-- At most one active link per form.
create unique index public_form_links_one_active_key on public.public_form_links (form_id)
  where revoked_at is null;

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  form_id uuid not null,
  form_version_id uuid not null,
  public_form_link_id uuid not null,
  request_id uuid not null,
  -- SHA-256 of the version and answers, to recognise retries.
  payload_sha256 bytea not null
    constraint form_submissions_payload_check check (octet_length(payload_sha256) = 32),
  submitted_at timestamptz not null default now(),
  constraint form_submissions_form_fkey foreign key (form_id, organization_id)
    references public.forms (id, organization_id) on delete restrict,
  constraint form_submissions_version_fkey foreign key (form_version_id, form_id)
    references public.form_versions (id, form_id) on delete restrict,
  constraint form_submissions_link_fkey foreign key (public_form_link_id, form_id)
    references public.public_form_links (id, form_id) on delete restrict,
  constraint form_submissions_request_key unique (public_form_link_id, request_id),
  constraint form_submissions_id_organization_key unique (id, organization_id),
  constraint form_submissions_id_version_key unique (id, form_version_id)
);

create index form_submissions_link_time_idx on public.form_submissions (public_form_link_id, submitted_at);

create table public.form_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  form_submission_id uuid not null,
  form_version_id uuid not null,
  form_question_id uuid not null,
  value_text text constraint form_answers_text_check check (char_length(value_text) between 1 and 5000),
  value_number numeric constraint form_answers_number_check check (value_number between -1e12 and 1e12),
  value_date date,
  value_choices text[] constraint form_answers_choices_check check (cardinality(value_choices) between 1 and 20),
  constraint form_answers_submission_fkey foreign key (form_submission_id, organization_id)
    references public.form_submissions (id, organization_id) on delete restrict,
  -- The answer's question belongs to the version that this submission answered.
  constraint form_answers_submission_version_fkey foreign key (form_submission_id, form_version_id)
    references public.form_submissions (id, form_version_id) on delete restrict,
  constraint form_answers_question_fkey foreign key (form_question_id, form_version_id)
    references public.form_questions (id, form_version_id) on delete restrict,
  constraint form_answers_one_value_check check (num_nonnulls(value_text, value_number, value_date, value_choices) = 1),
  constraint form_answers_question_key unique (form_submission_id, form_question_id)
);

comment on table public.form_submissions is
  'Immutable public submissions; written only by submit_public_form.';
comment on table public.form_answers is
  'Immutable typed answers; unanswered optional questions have no row.';

-- ---------------------------------------------------------------------------
-- Inquiries: submission channel and link to the form submission
-- ---------------------------------------------------------------------------

alter table public.inquiries
  add column submission_channel public.inquiry_submission_channel not null default 'staff_entry',
  add column form_submission_id uuid
    constraint inquiries_form_submission_key unique;

alter table public.inquiries
  add constraint inquiries_form_submission_fkey foreign key (form_submission_id, organization_id)
    references public.form_submissions (id, organization_id) on delete restrict;

-- Public submissions have no author and no stated source.
alter table public.inquiries alter column created_by drop not null;
alter table public.inquiries alter column source drop not null;

alter table public.inquiries
  add constraint inquiries_channel_check check (
    (submission_channel = 'staff_entry'
       and created_by is not null and source is not null and form_submission_id is null)
    or (submission_channel = 'public_form'
       and created_by is null and form_submission_id is not null
       and client_message is not null and staff_summary is null)
  );

comment on column public.inquiries.submission_channel is
  'How the record entered the system (technical). Source is the commercial origin.';

-- The channel and submission join the frozen intake.
create or replace function private.guard_inquiry_change()
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
     or new.created_at is distinct from old.created_at
     or new.submission_channel is distinct from old.submission_channel
     or new.form_submission_id is distinct from old.form_submission_id then
    raise exception 'the original intake and authorship of an inquiry cannot change'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Private: rate events
-- ---------------------------------------------------------------------------

-- Short-lived rate-limit evidence: a server-computed HMAC of the client, not
-- an IP address (pseudonymous personal data). Only recorded when the server
-- has a trusted client address. Pruned after two days by submit_public_form.
create table private.form_rate_events (
  id bigint generated always as identity primary key,
  public_form_link_id uuid not null references public.public_form_links (id) on delete restrict,
  fingerprint text not null constraint form_rate_events_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now()
);

create index form_rate_events_fingerprint_idx on private.form_rate_events (fingerprint, occurred_at);

alter table private.form_rate_events enable row level security;

-- ---------------------------------------------------------------------------
-- Access helper
-- ---------------------------------------------------------------------------

-- Verified, non-deleted, non-anonymous user with an active Owner or Manager
-- membership. Same rule as can_access_inquiries today; separate so the two
-- can diverge with the capability catalogue.
create function authz.can_manage_forms(p_organization_id uuid)
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

revoke all on function authz.can_manage_forms(uuid) from public;
grant execute on function authz.can_manage_forms(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Protection triggers
-- ---------------------------------------------------------------------------

create function private.guard_form_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'forms are never deleted' using errcode = '23514';
  end if;
  if new.id <> old.id or new.organization_id <> old.organization_id
     or new.purpose <> old.purpose or new.created_by <> old.created_by
     or new.created_at <> old.created_at then
    raise exception 'form identity and authorship cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.guard_form_version_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'published form versions are immutable' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old; -- an unpublished draft
  end if;
  if new.id <> old.id or new.form_id <> old.form_id
     or new.organization_id <> old.organization_id or new.version <> old.version
     or new.created_by <> old.created_by or new.created_at <> old.created_at then
    raise exception 'form version identity cannot change' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Questions change only while their version is a draft.
create function private.guard_form_question_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  version_ids uuid[];
begin
  version_ids := case tg_op
    when 'INSERT' then array[new.form_version_id]
    when 'DELETE' then array[old.form_version_id]
    else array[old.form_version_id, new.form_version_id]
  end;
  if exists (
    select 1 from public.form_versions v
     where v.id = any (version_ids) and v.published_at is not null
  ) then
    raise exception 'questions of a published form version are immutable' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.id <> old.id or new.form_version_id <> old.form_version_id
     or new.organization_id <> old.organization_id) then
    raise exception 'question identity cannot change' using errcode = '23514';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end;
$$;

create function private.guard_public_form_link_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'public form links are never deleted; revoke them instead' using errcode = '23514';
  end if;
  if old.revoked_at is not null
     or new.id <> old.id or new.organization_id <> old.organization_id
     or new.form_id <> old.form_id or new.public_key <> old.public_key
     or new.created_by <> old.created_by or new.created_at <> old.created_at
     or new.revoked_at is null then
    raise exception 'a public form link can only be revoked, once' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.prevent_submission_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'form submissions and answers are immutable' using errcode = '23514';
end;
$$;

create trigger guard_form_change before update or delete on public.forms
  for each row execute function private.guard_form_change();
create trigger guard_form_version_change before update or delete on public.form_versions
  for each row execute function private.guard_form_version_change();
create trigger guard_form_question_change before insert or update or delete on public.form_questions
  for each row execute function private.guard_form_question_change();
create trigger guard_public_form_link_change before update or delete on public.public_form_links
  for each row execute function private.guard_public_form_link_change();
create trigger prevent_submission_change before update or delete on public.form_submissions
  for each row execute function private.prevent_submission_change();
create trigger prevent_answer_change before update or delete on public.form_answers
  for each row execute function private.prevent_submission_change();

create trigger prevent_truncate before truncate on public.forms
  for each statement execute function private.prevent_truncate();
create trigger prevent_truncate before truncate on public.form_versions
  for each statement execute function private.prevent_truncate();
create trigger prevent_truncate before truncate on public.form_questions
  for each statement execute function private.prevent_truncate();
create trigger prevent_truncate before truncate on public.public_form_links
  for each statement execute function private.prevent_truncate();
create trigger prevent_truncate before truncate on public.form_submissions
  for each statement execute function private.prevent_truncate();
create trigger prevent_truncate before truncate on public.form_answers
  for each statement execute function private.prevent_truncate();

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

alter table private.audit_events drop constraint audit_events_action_check;
alter table private.audit_events
  add constraint audit_events_action_check
  check (
    action in (
      'organization.created',
      'membership.created',
      'membership.changed',
      'inquiry.created',
      'inquiry.closed',
      'inquiry.reopened',
      'form.published',
      'public_form_link.created',
      'public_form_link.revoked'
    )
  );

create function private.audit_form_version_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.published_at is null and new.published_at is not null then
    perform private.record_audit_event(
      new.organization_id, 'form.published', new.id,
      jsonb_build_object('version', new.version)
    );
  end if;
  return null;
end;
$$;

create function private.audit_public_form_link_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_audit_event(
      new.organization_id, 'public_form_link.created', new.id, '{}'::jsonb
    );
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.record_audit_event(
      new.organization_id, 'public_form_link.revoked', new.id, '{}'::jsonb
    );
  end if;
  return null;
end;
$$;

create trigger audit_form_version_publish after update on public.form_versions
  for each row execute function private.audit_form_version_publish();
create trigger audit_public_form_link_change after insert or update on public.public_form_links
  for each row execute function private.audit_public_form_link_change();

-- ---------------------------------------------------------------------------
-- Private operations
-- ---------------------------------------------------------------------------

-- Validates and publishes a draft. For Inquiry forms: a required long-text
-- message, at least one of email or phone, and matching kinds for bindings.
create function private.publish_form_version(p_version_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.form_versions%rowtype;
  form_purpose public.form_purpose;
  question_count integer;
begin
  select * into target from public.form_versions v where v.id = p_version_id for update;
  if not found or target.published_at is not null then
    raise exception 'only a draft can be published' using errcode = '22023';
  end if;
  if exists (select 1 from public.form_versions v
              where v.form_id = target.form_id and v.version > target.version) then
    raise exception 'only the newest version can be published' using errcode = '22023';
  end if;
  select f.purpose into form_purpose from public.forms f where f.id = target.form_id;

  select count(*) into question_count from public.form_questions q where q.form_version_id = p_version_id;
  if question_count not between 1 and 30 then
    raise exception 'a form needs 1 to 30 questions' using errcode = '22023';
  end if;

  -- Choice options: objects with a unique key and a label.
  if exists (
    select 1 from public.form_questions q
     where q.form_version_id = p_version_id and q.options is not null
       and (
         exists (select 1 from jsonb_array_elements(q.options) o
                  where jsonb_typeof(o) <> 'object'
                     or coalesce(o ->> 'key', '') !~ '^[a-z0-9_]{1,40}$'
                     or char_length(btrim(coalesce(o ->> 'label', ''))) not between 1 and 120)
         or (select count(distinct o ->> 'key') from jsonb_array_elements(q.options) o)
            <> jsonb_array_length(q.options)
       )
  ) then
    raise exception 'choice options need unique keys and labels' using errcode = '22023';
  end if;

  if form_purpose = 'inquiry' then
    if exists (
      select 1 from public.form_questions q
       where q.form_version_id = p_version_id and q.binding is not null
         and q.kind <> case q.binding
           when 'requester_name' then 'short_text'::public.form_question_kind
           when 'requester_email' then 'short_text'
           when 'requester_phone' then 'short_text'
           when 'client_message' then 'long_text'
           when 'requested_event_date' then 'date'
           when 'estimated_guests' then 'number'
         end
    ) then
      raise exception 'a bound question has the wrong kind' using errcode = '22023';
    end if;
    if not exists (select 1 from public.form_questions q
                    where q.form_version_id = p_version_id
                      and q.binding = 'client_message' and q.required) then
      raise exception 'an inquiry form needs a required message question' using errcode = '22023';
    end if;
    if not exists (select 1 from public.form_questions q
                    where q.form_version_id = p_version_id
                      and q.binding in ('requester_email', 'requester_phone')) then
      raise exception 'an inquiry form needs an email or phone question' using errcode = '22023';
    end if;
  end if;

  update public.form_versions
     set published_at = now(), published_by = p_actor
   where id = p_version_id;
end;
$$;

-- The default Inquiry form, published as version 1. Message required; email
-- and phone optional individually (at least one is enforced per submission);
-- name, event date and guests optional.
create function private.create_default_inquiry_form(p_organization_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_form_id uuid;
  new_version_id uuid;
begin
  insert into public.forms (organization_id, purpose, name, created_by)
  values (p_organization_id, 'inquiry', 'Pedido de informação', p_actor)
  returning id into new_form_id;

  insert into public.form_versions (form_id, organization_id, version, title, intro, created_by)
  values (new_form_id, p_organization_id, 1, 'Pedido de informação',
          'Conte-nos o que procura e entraremos em contacto.', p_actor)
  returning id into new_version_id;

  insert into public.form_questions (form_version_id, organization_id, position, kind, label, help_text, required, binding)
  values
    (new_version_id, p_organization_id, 1, 'short_text', 'Nome', null, false, 'requester_name'),
    (new_version_id, p_organization_id, 2, 'short_text', 'Email', null, false, 'requester_email'),
    (new_version_id, p_organization_id, 3, 'short_text', 'Telefone', 'Indique o email, o telefone ou ambos.', false, 'requester_phone'),
    (new_version_id, p_organization_id, 4, 'long_text', 'Mensagem', 'O que procura, para quando e para quantas pessoas.', true, 'client_message'),
    (new_version_id, p_organization_id, 5, 'date', 'Data pretendida', null, false, 'requested_event_date'),
    (new_version_id, p_organization_id, 6, 'number', 'N.º de convidados (estimativa)', null, false, 'estimated_guests');

  perform private.publish_form_version(new_version_id, p_actor);
  return new_form_id;
end;
$$;

create function private.new_public_form_link(p_organization_id uuid, p_form_id uuid, p_actor uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.public_form_links (organization_id, form_id, public_key, created_by)
  values (
    p_organization_id, p_form_id,
    rtrim(translate(encode(uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '='),
    p_actor
  );
$$;

revoke all on function private.guard_form_change() from public;
revoke all on function private.guard_form_version_change() from public;
revoke all on function private.guard_form_question_change() from public;
revoke all on function private.guard_public_form_link_change() from public;
revoke all on function private.prevent_submission_change() from public;
revoke all on function private.audit_form_version_publish() from public;
revoke all on function private.audit_public_form_link_change() from public;
revoke all on function private.publish_form_version(uuid, uuid) from public;
revoke all on function private.create_default_inquiry_form(uuid, uuid) from public;
revoke all on function private.new_public_form_link(uuid, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- Staff operations (authenticated; verified active Owner or Manager)
-- ---------------------------------------------------------------------------

-- Creates the default Inquiry form if needed and an active public link if
-- none exists. Calling again changes nothing.
create function public.enable_public_inquiry_form(p_organization_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  target_form_id uuid;
begin
  if caller_id is null or p_organization_id is null
     or not authz.can_manage_forms(p_organization_id) then
    raise exception 'not allowed to manage forms in this organization' using errcode = '42501';
  end if;

  -- Serialise concurrent enabling for the organization.
  perform pg_advisory_xact_lock(hashtextextended('public_inquiry_form:' || p_organization_id::text, 0));

  select f.id into target_form_id from public.forms f
   where f.organization_id = p_organization_id and f.purpose = 'inquiry';
  if target_form_id is null then
    target_form_id := private.create_default_inquiry_form(p_organization_id, caller_id);
  end if;

  if not exists (select 1 from public.public_form_links l
                  where l.form_id = target_form_id and l.revoked_at is null) then
    perform private.new_public_form_link(p_organization_id, target_form_id, caller_id);
  end if;
end;
$$;

-- Revokes a link. Revoking a revoked link changes nothing. Not found and
-- forbidden are the same error.
create function public.revoke_public_form_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.public_form_links%rowtype;
begin
  select * into target from public.public_form_links l where l.id = p_link_id;
  if not found or auth.uid() is null or not authz.can_manage_forms(target.organization_id) then
    raise exception 'link not found or not allowed' using errcode = '42501';
  end if;
  update public.public_form_links
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_link_id and revoked_at is null;
end;
$$;

-- Replaces an active link with a new key; the old key stops working.
create function public.rotate_public_form_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.public_form_links%rowtype;
begin
  select * into target from public.public_form_links l where l.id = p_link_id;
  if not found or auth.uid() is null or not authz.can_manage_forms(target.organization_id) then
    raise exception 'link not found or not allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('public_inquiry_form:' || target.organization_id::text, 0));
  update public.public_form_links
     set revoked_at = now(), revoked_by = auth.uid()
   where id = p_link_id and revoked_at is null;
  if not found then
    raise exception 'only an active link can be rotated' using errcode = '22023';
  end if;
  perform private.new_public_form_link(target.organization_id, target.form_id, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Server-only role and schema for public operations
-- ---------------------------------------------------------------------------
-- The Next.js server connects as public_form_service (through the Supabase
-- pooler) and can only execute the two functions below. NOLOGIN here: an
-- operator enables LOGIN with a password per environment, outside
-- migrations, so no secret is ever in the repository. NOINHERIT and no
-- memberships: it gains nothing if a role is granted to it later by mistake.
-- Not granted to authenticator, so the Data API can never switch to it.

create role public_form_service
  nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls
  connection limit 10;
alter role public_form_service set statement_timeout = '5s';
alter role public_form_service set lock_timeout = '3s';
alter role public_form_service set idle_in_transaction_session_timeout = '10s';
comment on role public_form_service is
  'Sollelio public forms: Next.js server only. EXECUTE on form_service.get_public_form and form_service.submit_public_form; nothing else (ADR 0009).';

-- Not exposed by the Data API (only public and graphql_public are).
create schema form_service;
revoke all on schema form_service from public;
grant usage on schema form_service to public_form_service;

-- ---------------------------------------------------------------------------
-- Public operations (public_form_service only)
-- ---------------------------------------------------------------------------
-- Errors: SF001 link unavailable; SF002 version no longer accepted; SF003
-- rate limited; 22023 invalid answers; 23505 request id reused with
-- different answers. Callers other than public_form_service get 42501 from
-- PostgreSQL itself.

-- The current published version of an active link's form, client-facing
-- fields only.
create function form_service.get_public_form(p_public_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  link public.public_form_links%rowtype;
  current_version public.form_versions%rowtype;
  organization_name text;
begin
  select * into link from public.public_form_links l
   where l.public_key = p_public_key and l.revoked_at is null;
  if not found then
    raise exception 'form unavailable' using errcode = 'SF001';
  end if;
  select * into current_version from public.form_versions v
   where v.form_id = link.form_id and v.published_at is not null
   order by v.version desc limit 1;
  if not found then
    raise exception 'form unavailable' using errcode = 'SF001';
  end if;
  select o.name into organization_name from public.organizations o where o.id = link.organization_id;

  return jsonb_build_object(
    'organizationName', organization_name,
    'formVersionId', current_version.id,
    'title', current_version.title,
    'intro', current_version.intro,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'position', q.position, 'kind', q.kind, 'label', q.label,
               'helpText', q.help_text, 'required', q.required, 'options', q.options,
               'binding', q.binding) order by q.position)
        from public.form_questions q where q.form_version_id = current_version.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Validates and stores a submission; for Inquiry forms, creates the Inquiry.
-- p_fingerprint is null when the server has no trusted client address; the
-- per-client limit is then not applied (the per-link limits always are).
create function form_service.submit_public_form(
  p_public_key text,
  p_form_version_id uuid,
  p_request_id uuid,
  p_fingerprint text,
  p_answers jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  link public.public_form_links%rowtype;
  answered public.form_versions%rowtype;
  form_purpose public.form_purpose;
  successor_published_at timestamptz;
  payload bytea;
  existing_payload bytea;
  submission_id uuid;
  q record;
  raw jsonb;
  text_value text;
  number_value numeric;
  date_value date;
  choices text[];
  inquiry_values jsonb := '{}'::jsonb;
begin
  if p_request_id is null or p_form_version_id is null
     or (p_fingerprint is not null and p_fingerprint !~ '^[0-9a-f]{64}$') then
    raise exception 'request id and version are required; a fingerprint must be 64 hex characters' using errcode = '22023';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or octet_length(p_answers::text) > 65536 then
    raise exception 'answers must be an object of at most 64 KB' using errcode = '22023';
  end if;

  select * into link from public.public_form_links l
   where l.public_key = p_public_key and l.revoked_at is null;
  if not found then
    raise exception 'form unavailable' using errcode = 'SF001';
  end if;

  -- One submission at a time per link: counts and retries stay exact.
  perform pg_advisory_xact_lock(hashtextextended('public_form_link:' || link.id::text, 0));

  -- A retry of the same request returns quietly; other answers are refused.
  payload := sha256(convert_to(p_form_version_id::text || ':' || p_answers::text, 'UTF8'));
  select s.payload_sha256 into existing_payload from public.form_submissions s
   where s.public_form_link_id = link.id and s.request_id = p_request_id;
  if found then
    if existing_payload = payload then
      return;
    end if;
    raise exception 'request id was already used for different answers' using errcode = '23505';
  end if;

  -- The current published version, or the previous one for 24 hours.
  select * into answered from public.form_versions v
   where v.id = p_form_version_id and v.form_id = link.form_id and v.published_at is not null;
  if not found then
    raise exception 'form version not accepted' using errcode = 'SF002';
  end if;
  select min(v.published_at) into successor_published_at from public.form_versions v
   where v.form_id = link.form_id and v.version > answered.version and v.published_at is not null;
  if successor_published_at is not null and successor_published_at < now() - interval '24 hours' then
    raise exception 'form version not accepted' using errcode = 'SF002';
  end if;

  -- Rate limits: per link always; per client only with a fingerprint.
  if (select count(*) from public.form_submissions s
       where s.public_form_link_id = link.id and s.submitted_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.form_submissions s
          where s.public_form_link_id = link.id and s.submitted_at > now() - interval '1 day') >= 100
     or (p_fingerprint is not null and (select count(*) from private.form_rate_events e
          where e.fingerprint = p_fingerprint and e.occurred_at > now() - interval '10 minutes') >= 5)
     or (p_fingerprint is not null and (select count(*) from private.form_rate_events e
          where e.fingerprint = p_fingerprint and e.occurred_at > now() - interval '1 day') >= 20) then
    raise exception 'too many submissions' using errcode = 'SF003';
  end if;

  -- Only questions of the answered version.
  if exists (
    select 1 from jsonb_object_keys(p_answers) k
     where not exists (select 1 from public.form_questions known
                        where known.form_version_id = answered.id and known.id::text = k)
  ) then
    raise exception 'unknown question' using errcode = '22023';
  end if;

  select f.purpose into form_purpose from public.forms f where f.id = link.form_id;

  insert into public.form_submissions (
    organization_id, form_id, form_version_id, public_form_link_id, request_id, payload_sha256
  )
  values (link.organization_id, link.form_id, answered.id, link.id, p_request_id, payload)
  returning id into submission_id;

  for q in
    select * from public.form_questions fq where fq.form_version_id = answered.id order by fq.position
  loop
    raw := p_answers -> q.id::text;
    text_value := null; number_value := null; date_value := null; choices := null;

    if raw is null or raw = 'null'::jsonb
       or (jsonb_typeof(raw) = 'string' and btrim(raw #>> '{}', e' \t\r\n') = '')
       or (jsonb_typeof(raw) = 'array' and jsonb_array_length(raw) = 0) then
      if q.required then
        raise exception 'a required question is unanswered' using errcode = '22023';
      end if;
      continue;
    end if;

    case q.kind
      when 'short_text', 'long_text' then
        if jsonb_typeof(raw) <> 'string' then
          raise exception 'text expected' using errcode = '22023';
        end if;
        text_value := btrim(raw #>> '{}', e' \t\r\n');
        if char_length(text_value) > (case q.kind when 'short_text' then 2000 else 5000 end) then
          raise exception 'answer too long' using errcode = '22023';
        end if;
        if q.kind = 'short_text' and text_value ~ '[\r\n]' then
          raise exception 'single-line text expected' using errcode = '22023';
        end if;
      when 'number' then
        if jsonb_typeof(raw) <> 'number' then
          raise exception 'number expected' using errcode = '22023';
        end if;
        number_value := (raw #>> '{}')::numeric;
        if number_value not between -1e12 and 1e12 then
          raise exception 'number out of range' using errcode = '22023';
        end if;
      when 'date' then
        if jsonb_typeof(raw) <> 'string' or (raw #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
          raise exception 'date expected' using errcode = '22023';
        end if;
        begin
          date_value := make_date(substr(raw #>> '{}', 1, 4)::int, substr(raw #>> '{}', 6, 2)::int,
                                  substr(raw #>> '{}', 9, 2)::int);
        exception when others then
          raise exception 'invalid date' using errcode = '22023';
        end;
        if date_value not between date '1900-01-01' and date '2200-12-31' then
          raise exception 'date out of range' using errcode = '22023';
        end if;
      when 'single_choice' then
        if jsonb_typeof(raw) <> 'string'
           or not exists (select 1 from jsonb_array_elements(q.options) o where o ->> 'key' = raw #>> '{}') then
          raise exception 'unknown choice' using errcode = '22023';
        end if;
        choices := array[raw #>> '{}'];
      when 'multiple_choice' then
        if jsonb_typeof(raw) <> 'array'
           or exists (select 1 from jsonb_array_elements(raw) e where jsonb_typeof(e) <> 'string')
           or exists (select 1 from jsonb_array_elements_text(raw) e
                       where not exists (select 1 from jsonb_array_elements(q.options) o where o ->> 'key' = e))
           or (select count(distinct e) from jsonb_array_elements_text(raw) e) <> jsonb_array_length(raw) then
          raise exception 'unknown or repeated choice' using errcode = '22023';
        end if;
        select array_agg(e order by e) into choices from jsonb_array_elements_text(raw) e;
    end case;

    -- Bound Inquiry fields have the Inquiry's own limits.
    if form_purpose = 'inquiry' and q.binding is not null then
      case q.binding
        when 'requester_name' then
          if char_length(text_value) > 200 then
            raise exception 'name too long' using errcode = '22023';
          end if;
        when 'requester_email' then
          if char_length(text_value) > 320 or text_value !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
            raise exception 'invalid email' using errcode = '22023';
          end if;
        when 'requester_phone' then
          if char_length(text_value) > 40 or text_value !~ '\d' then
            raise exception 'invalid phone' using errcode = '22023';
          end if;
        when 'requested_event_date' then
          if date_value not between date '2000-01-01' and date '2100-12-31' then
            raise exception 'event date out of range' using errcode = '22023';
          end if;
        when 'estimated_guests' then
          if number_value <> trunc(number_value) or number_value not between 1 and 100000 then
            raise exception 'guests must be a whole number from 1 to 100000' using errcode = '22023';
          end if;
        else null;
      end case;
      inquiry_values := inquiry_values || jsonb_build_object(
        q.binding::text, coalesce(to_jsonb(text_value), to_jsonb(number_value), to_jsonb(date_value))
      );
    end if;

    insert into public.form_answers (
      organization_id, form_submission_id, form_version_id, form_question_id,
      value_text, value_number, value_date, value_choices
    )
    values (link.organization_id, submission_id, answered.id, q.id,
            text_value, number_value, date_value, choices);
  end loop;

  if form_purpose = 'inquiry' then
    if not (inquiry_values ? 'requester_email' or inquiry_values ? 'requester_phone') then
      raise exception 'an email or a phone number is required' using errcode = '22023';
    end if;
    insert into public.inquiries (
      organization_id, source, client_message, staff_summary, received_at,
      requester_name, requester_phone, requester_email,
      requested_event_date, estimated_guests,
      created_by, creation_request_id, submission_channel, form_submission_id
    )
    values (
      link.organization_id, null, inquiry_values ->> 'client_message', null, now(),
      inquiry_values ->> 'requester_name', inquiry_values ->> 'requester_phone',
      inquiry_values ->> 'requester_email',
      (inquiry_values ->> 'requested_event_date')::date,
      (inquiry_values ->> 'estimated_guests')::integer,
      null, p_request_id, 'public_form', submission_id
    );
  end if;

  if p_fingerprint is not null then
    insert into private.form_rate_events (public_form_link_id, fingerprint)
    values (link.id, p_fingerprint);
  end if;
  delete from private.form_rate_events e
   where e.id in (select e2.id from private.form_rate_events e2
                   where e2.occurred_at < now() - interval '2 days' limit 500);
end;
$$;

revoke all on function public.enable_public_inquiry_form(uuid) from public, anon;
revoke all on function public.revoke_public_form_link(uuid) from public, anon;
revoke all on function public.rotate_public_form_link(uuid) from public, anon;
revoke all on function form_service.get_public_form(text) from public, anon, authenticated, service_role;
revoke all on function form_service.submit_public_form(text, uuid, uuid, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.enable_public_inquiry_form(uuid) to authenticated;
grant execute on function public.revoke_public_form_link(uuid) to authenticated;
grant execute on function public.rotate_public_form_link(uuid) to authenticated;
grant execute on function form_service.get_public_form(text) to public_form_service;
grant execute on function form_service.submit_public_form(text, uuid, uuid, text, jsonb) to public_form_service;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security (default deny; read-only for staff)
-- ---------------------------------------------------------------------------

revoke all on table public.forms from anon, authenticated;
revoke all on table public.form_versions from anon, authenticated;
revoke all on table public.form_questions from anon, authenticated;
revoke all on table public.public_form_links from anon, authenticated;
revoke all on table public.form_submissions from anon, authenticated;
revoke all on table public.form_answers from anon, authenticated;
grant select on table public.forms to authenticated;
grant select on table public.form_versions to authenticated;
grant select on table public.form_questions to authenticated;
grant select on table public.public_form_links to authenticated;
grant select on table public.form_submissions to authenticated;
grant select on table public.form_answers to authenticated;

alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_questions enable row level security;
alter table public.public_form_links enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_answers enable row level security;

create policy "Owners and managers can read their organization's forms"
  on public.forms for select to authenticated
  using (authz.can_manage_forms(organization_id));
create policy "Owners and managers can read their organization's form versions"
  on public.form_versions for select to authenticated
  using (authz.can_manage_forms(organization_id));
create policy "Owners and managers can read their organization's form questions"
  on public.form_questions for select to authenticated
  using (authz.can_manage_forms(organization_id));
create policy "Owners and managers can read their organization's public form links"
  on public.public_form_links for select to authenticated
  using (authz.can_manage_forms(organization_id));
create policy "Owners and managers can read their organization's form submissions"
  on public.form_submissions for select to authenticated
  using (authz.can_manage_forms(organization_id));
create policy "Owners and managers can read their organization's form answers"
  on public.form_answers for select to authenticated
  using (authz.can_manage_forms(organization_id));
