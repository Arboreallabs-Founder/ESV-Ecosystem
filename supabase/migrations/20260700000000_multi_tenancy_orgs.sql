-- Multi-tenancy Phase 1: organizations table + super_admin role

-- 1. Add super_admin to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID  -- intentionally no FK to users to avoid circular dependency on first insert
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
-- Policies added in Migration 4 after helper functions exist (Migration 3)
