-- Functional database baseline for a fresh Supabase project and for upgrading
-- the legacy SQL files that originally shipped with this repository.

create table if not exists public.bookmark_boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmark_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  board_id uuid references public.bookmark_boards(id) on delete cascade,
  name text not null,
  color text not null default 'blue',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- Upgrade databases initialized from the old bookmark_setup.sql.
alter table public.bookmark_folders
  add column if not exists board_id uuid references public.bookmark_boards(id) on delete cascade,
  add column if not exists color text default 'blue';

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  folder_id uuid references public.bookmark_folders(id) on delete cascade,
  title text not null,
  url text not null,
  favicon_url text,
  description text,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  type text not null default 'todo',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  content text not null,
  is_done boolean not null default false,
  due_date date,
  recurrence text not null default 'none',
  weekly_days integer[],
  last_completed_at timestamptz,
  type text not null default 'todo',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.note_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text not null default 'blue',
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint tags_user_id_name_key unique (user_id, name)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  group_id uuid references public.note_groups(id) on delete set null,
  title text,
  content text,
  type text not null default 'text',
  image_url text,
  source_app text,
  color text not null default 'default',
  is_pinned boolean not null default false,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_tags (
  note_id uuid references public.notes(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists bookmark_boards_user_order_idx
  on public.bookmark_boards (user_id, "order", created_at);
create index if not exists bookmark_folders_board_order_idx
  on public.bookmark_folders (board_id, "order", created_at);
create index if not exists bookmarks_folder_order_idx
  on public.bookmarks (folder_id, "order", created_at);
create index if not exists groups_user_type_order_idx
  on public.groups (user_id, type, "order", created_at);
create index if not exists todos_user_type_order_idx
  on public.todos (user_id, type, "order", created_at);
create index if not exists todos_recurring_idx
  on public.todos (is_done, recurrence) where is_done = true;
create unique index if not exists push_subscriptions_endpoint_uidx
  on public.push_subscriptions (endpoint);
create index if not exists note_groups_user_order_idx
  on public.note_groups (user_id, "order", created_at);
create index if not exists notes_user_pinned_created_idx
  on public.notes (user_id, is_pinned desc, created_at desc);
create index if not exists note_tags_tag_id_idx
  on public.note_tags (tag_id);

alter table public.bookmark_boards enable row level security;
alter table public.bookmark_folders enable row level security;
alter table public.bookmarks enable row level security;
alter table public.groups enable row level security;
alter table public.todos enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.note_groups enable row level security;
alter table public.tags enable row level security;
alter table public.notes enable row level security;
alter table public.note_tags enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookmark_boards' and policyname = 'Users can manage their own bookmark boards') then
    create policy "Users can manage their own bookmark boards" on public.bookmark_boards for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookmark_folders' and policyname = 'Users can manage their own bookmark folders') then
    create policy "Users can manage their own bookmark folders" on public.bookmark_folders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookmarks' and policyname = 'Users can manage their own bookmarks') then
    create policy "Users can manage their own bookmarks" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'groups' and policyname = 'Users can manage their own groups') then
    create policy "Users can manage their own groups" on public.groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'todos' and policyname = 'Users can manage their own todos') then
    create policy "Users can manage their own todos" on public.todos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'push_subscriptions' and policyname = 'Users can manage their own push subscriptions') then
    create policy "Users can manage their own push subscriptions" on public.push_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'note_groups' and policyname = 'Users can manage their own note groups') then
    create policy "Users can manage their own note groups" on public.note_groups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tags' and policyname = 'Users can manage their own tags') then
    create policy "Users can manage their own tags" on public.tags for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'notes' and policyname = 'Users can manage their own notes') then
    create policy "Users can manage their own notes" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'note_tags' and policyname = 'Users can manage their own note tags') then
    create policy "Users can manage their own note tags" on public.note_tags for all
      using (exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid()))
      with check (exists (select 1 from public.notes where notes.id = note_tags.note_id and notes.user_id = auth.uid()));
  end if;
end
$$;

insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can upload note images') then
    create policy "Users can upload note images" on storage.objects for insert
      with check (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Anyone can view note images') then
    create policy "Anyone can view note images" on storage.objects for select
      using (bucket_id = 'note-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'Users can delete note images') then
    create policy "Users can delete note images" on storage.objects for delete
      using (bucket_id = 'note-images' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end
$$;

-- Create a note and all of its tag links in one database transaction.
create or replace function public.create_note_with_tags(
  p_group_id uuid,
  p_title text,
  p_content text,
  p_type text,
  p_image_url text,
  p_source_app text,
  p_color text,
  p_is_pinned boolean,
  p_order integer,
  p_tag_ids uuid[]
)
returns public.notes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_note public.notes;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.notes (
    user_id, group_id, title, content, type, image_url, source_app,
    color, is_pinned, "order"
  ) values (
    auth.uid(), p_group_id, p_title, p_content, p_type, p_image_url,
    p_source_app, coalesce(p_color, 'default'), coalesce(p_is_pinned, false),
    coalesce(p_order, 0)
  )
  returning * into v_note;

  insert into public.note_tags (note_id, tag_id)
  select v_note.id, requested_tag.tag_id
  from unnest(coalesce(p_tag_ids, array[]::uuid[])) as requested_tag(tag_id)
  on conflict do nothing;

  return v_note;
end
$$;

-- Update the note and replace all tag links atomically. Any invalid tag or
-- failed insert rolls back the note update and the delete of the old links.
create or replace function public.update_note_with_tags(
  p_note_id uuid,
  p_group_id uuid,
  p_title text,
  p_content text,
  p_type text,
  p_image_url text,
  p_color text,
  p_is_pinned boolean,
  p_tag_ids uuid[]
)
returns public.notes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_note public.notes;
begin
  update public.notes
  set title = p_title,
      content = p_content,
      group_id = p_group_id,
      color = coalesce(p_color, 'default'),
      is_pinned = coalesce(p_is_pinned, false),
      image_url = p_image_url,
      type = p_type,
      updated_at = now()
  where id = p_note_id
  returning * into v_note;

  if not found then
    raise exception 'Note not found or update not permitted' using errcode = 'P0002';
  end if;

  delete from public.note_tags where note_id = p_note_id;

  insert into public.note_tags (note_id, tag_id)
  select p_note_id, requested_tag.tag_id
  from unnest(coalesce(p_tag_ids, array[]::uuid[])) as requested_tag(tag_id)
  on conflict do nothing;

  return v_note;
end
$$;

-- Import every folder and bookmark in one function call. PL/pgSQL functions
-- execute transactionally, so an error at any point leaves no partial import.
create or replace function public.import_bookmarks_transactional(
  p_board_id uuid,
  p_folders jsonb,
  p_bookmarks jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_folder_json jsonb;
  v_bookmark_json jsonb;
  v_folder public.bookmark_folders;
  v_bookmark public.bookmarks;
  v_folder_map jsonb := '{}'::jsonb;
  v_inserted_folders jsonb := '[]'::jsonb;
  v_inserted_bookmarks jsonb := '[]'::jsonb;
  v_temp_id text;
  v_folder_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if jsonb_typeof(coalesce(p_folders, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_bookmarks, '[]'::jsonb)) <> 'array' then
    raise exception 'Import payload must contain arrays' using errcode = '22023';
  end if;

  perform 1
  from public.bookmark_boards
  where id = p_board_id and user_id = auth.uid();
  if not found then
    raise exception 'Bookmark board not found' using errcode = 'P0002';
  end if;

  for v_folder_json in
    select value from jsonb_array_elements(coalesce(p_folders, '[]'::jsonb))
  loop
    v_temp_id := nullif(trim(v_folder_json ->> 'temp_id'), '');
    if v_temp_id is null or nullif(trim(v_folder_json ->> 'name'), '') is null then
      raise exception 'Every imported folder requires temp_id and name' using errcode = '22023';
    end if;
    if v_folder_map ? v_temp_id then
      raise exception 'Duplicate imported folder key: %', v_temp_id using errcode = '22023';
    end if;

    insert into public.bookmark_folders (
      user_id, board_id, name, color, "order"
    ) values (
      auth.uid(),
      p_board_id,
      trim(v_folder_json ->> 'name'),
      coalesce(nullif(v_folder_json ->> 'color', ''), 'blue'),
      coalesce((v_folder_json ->> 'order')::integer, 0)
    )
    returning * into v_folder;

    v_folder_map := v_folder_map || jsonb_build_object(v_temp_id, v_folder.id::text);
    v_inserted_folders := v_inserted_folders || jsonb_build_array(to_jsonb(v_folder));
  end loop;

  for v_bookmark_json in
    select value from jsonb_array_elements(coalesce(p_bookmarks, '[]'::jsonb))
  loop
    v_temp_id := nullif(trim(v_bookmark_json ->> 'folder_temp_id'), '');
    if v_temp_id is null or not (v_folder_map ? v_temp_id) then
      raise exception 'Unknown imported folder key: %', coalesce(v_temp_id, '<null>') using errcode = '22023';
    end if;
    if nullif(trim(v_bookmark_json ->> 'url'), '') is null then
      raise exception 'Every imported bookmark requires a URL' using errcode = '22023';
    end if;

    v_folder_id := (v_folder_map ->> v_temp_id)::uuid;
    insert into public.bookmarks (
      user_id, folder_id, title, url, favicon_url, description, "order"
    ) values (
      auth.uid(),
      v_folder_id,
      coalesce(nullif(trim(v_bookmark_json ->> 'title'), ''), trim(v_bookmark_json ->> 'url')),
      trim(v_bookmark_json ->> 'url'),
      nullif(v_bookmark_json ->> 'favicon_url', ''),
      nullif(v_bookmark_json ->> 'description', ''),
      coalesce((v_bookmark_json ->> 'order')::integer, 0)
    )
    returning * into v_bookmark;

    v_inserted_bookmarks := v_inserted_bookmarks || jsonb_build_array(to_jsonb(v_bookmark));
  end loop;

  return jsonb_build_object(
    'folders', v_inserted_folders,
    'bookmarks', v_inserted_bookmarks
  );
end
$$;

grant execute on function public.create_note_with_tags(uuid, text, text, text, text, text, text, boolean, integer, uuid[]) to authenticated;
grant execute on function public.update_note_with_tags(uuid, uuid, text, text, text, text, text, boolean, uuid[]) to authenticated;
grant execute on function public.import_bookmarks_transactional(uuid, jsonb, jsonb) to authenticated;
