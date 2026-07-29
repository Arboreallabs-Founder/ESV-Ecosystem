-- Adds 'wfh' to the leave_type enum. STANDALONE on purpose, and it must be run before
-- 20260822100000: Postgres will not let a new enum value be used by any statement in the same
-- transaction that added it, so the column default and policies that reference it have to land
-- in a separate migration.
ALTER TYPE leave_type ADD VALUE IF NOT EXISTS 'wfh';
