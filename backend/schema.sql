-- Smart Market Watchlist — full schema
-- Run this in Supabase SQL Editor. Safe to run once on a fresh project.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  symbol text not null,
  added_at timestamptz default now(),
  unique (user_id, symbol)
);

-- Append-only. Never updated, only inserted — this is what makes
-- "what changed since I last looked" a correct query instead of a guess.
create table if not exists price_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  price numeric not null,
  volume bigint,
  snapshot_at timestamptz default now(),
  source text
);

create index if not exists idx_price_snapshots_symbol_time
  on price_snapshots (symbol, snapshot_at);

create table if not exists change_events (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  event_type text not null,       -- 'needs_decision' | 'worth_a_look'
  magnitude numeric,
  reason_text text,
  score numeric,
  detected_at timestamptz default now()
);

create index if not exists idx_change_events_symbol_time
  on change_events (symbol, detected_at);

-- MIGRATION: Historical accuracy tracking (Priority A)
-- Add outcome columns to change_events so the worker can back-fill whether
-- a flagged event was actually followed by further movement in the same
-- direction over the next few poll cycles. Both are nullable — NULL means
-- "not yet evaluated" (event too recent or no subsequent snapshots yet).
-- Safe to run multiple times: IF NOT EXISTS guard.
alter table change_events add column if not exists follow_through_pct numeric;
alter table change_events add column if not exists was_significant boolean;

create table if not exists user_last_seen (
  user_id uuid references users(id) on delete cascade,
  symbol text not null,
  last_seen_at timestamptz default now(),
  primary key (user_id, symbol)
);

-- MIGRATION: User sensitivity threshold settings (Priority C)
create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  needs_decision_threshold integer not null default 55,
  worth_a_look_threshold integer not null default 25,
  updated_at timestamptz default now()
);

-- Disable Row Level Security on all tables.
-- Supabase enables RLS by default on new tables. Since this app uses a
-- server-side demo user (not Supabase Auth), RLS would silently block
-- all inserts/updates. These statements ensure a fresh project works
-- immediately after running this schema file — no manual SQL Editor step.
alter table users disable row level security;
alter table watchlist_items disable row level security;
alter table price_snapshots disable row level security;
alter table change_events disable row level security;
alter table user_last_seen disable row level security;
alter table user_settings disable row level security;


