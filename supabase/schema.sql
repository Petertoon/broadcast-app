-- Run this once in your Supabase project's SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste this -> Run)

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade not null,
  platform text not null,
  name text not null,
  created_at timestamptz default now()
);

alter table accounts enable row level security;

-- Each person can only see, add, and remove their own channels
create policy "Users manage their own accounts"
  on accounts
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
