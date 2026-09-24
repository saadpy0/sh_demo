-- Singapore Hardwares CRM
-- Run this in Supabase SQL editor when you connect the app.
-- The UI currently uses localStorage with the same field names.

create extension if not exists "pgcrypto";

create type lead_stage as enum (
  'new', 'contacted', 'qualified', 'quoted', 'hold', 'won', 'lost'
);
create type lead_source as enum (
  'walk_in', 'whatsapp', 'phone', 'referral', 'site_visit', 'web'
);
create type trade_type as enum (
  'contractor', 'subcontractor', 'retailer', 'homeowner', 'institution', 'fitout'
);
create type product_line as enum (
  'plumbing', 'electrical', 'tools', 'paint', 'fasteners', 'building', 'hvac', 'safety'
);
create type activity_type as enum (
  'note', 'call', 'whatsapp', 'visit', 'quote', 'stage', 'convert'
);
create type quote_status as enum (
  'draft', 'sent', 'revised', 'accepted', 'expired'
);
create type payment_terms as enum ('cod', 'net_15', 'net_30', 'net_45');
create type next_action_kind as enum (
  'call', 'whatsapp', 'visit', 'quote', 'follow_up'
);

create table staff (
  id text primary key,
  name text not null,
  role text not null,
  photo_seed text
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  ticket text unique not null,
  company text not null,
  contact_name text not null,
  contact_role text,
  phone text,
  whatsapp text,
  email text,
  city text,
  area text,
  source lead_source not null,
  trade_type trade_type not null,
  lines product_line[] not null default '{}',
  estimated_value numeric not null default 0,
  stage lead_stage not null default 'new',
  owner_id text not null references staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  next_action_kind next_action_kind,
  next_action_due_at timestamptz,
  next_action_note text,
  brief text,
  account_id uuid,
  lost_reason text
);

create table accounts (
  id text primary key,
  name text not null,
  trade_type trade_type not null,
  contact_name text not null,
  phone text,
  email text,
  city text,
  area text,
  owner_id text not null references staff(id),
  credit_limit numeric not null default 0,
  payment_terms payment_terms not null default 'cod',
  trn text,
  opened_at timestamptz not null default now(),
  source_lead_id uuid references leads(id),
  notes text
);

alter table leads
  add constraint leads_account_fk
  foreign key (account_id) references accounts(id);

create table activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  account_id text references accounts(id),
  type activity_type not null,
  body text not null,
  at timestamptz not null default now(),
  author_id text not null references staff(id)
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id),
  number text unique not null,
  amount numeric not null,
  status quote_status not null default 'draft',
  sent_at timestamptz,
  valid_until date,
  note text
);

create index leads_stage_idx on leads(stage);
create index leads_owner_idx on leads(owner_id);
create index activities_lead_idx on activities(lead_id);
