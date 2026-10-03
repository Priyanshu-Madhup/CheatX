-- Run once in the Supabase SQL editor.

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled test',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question text not null,
  context text not null default '',
  options jsonb not null,          -- [{ "id": "A", "text": "..." }]
  choice text not null,            -- selected option id
  probabilities jsonb not null,    -- { "A": 0.02, "B": 0.98 }
  created_at timestamptz not null default now()
);

create index if not exists tests_user_created_idx on public.tests (user_id, created_at desc);
create index if not exists items_test_created_idx on public.items (test_id, created_at);

alter table public.tests enable row level security;
alter table public.items enable row level security;

create policy "tests: owner full access" on public.tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "items: owner full access" on public.items
  for all using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and exists (select 1 from public.tests t where t.id = test_id and t.user_id = auth.uid())
  );
