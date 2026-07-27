-- New "hr" role: Team-tab-only nav (Tasks, Bulletin, Events, HR Zone, Approvals, Engage), takes
-- over the create/edit (not delete) tier on HR Zone policies, Bulletin, and Events that `general`
-- currently has, and is one of three leave/expense approvers alongside founder and admin.
-- Own migration file — Postgres requires an enum value to be committed before it can be
-- referenced by any policy, so this must apply before any migration that uses 'hr'.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'hr';
