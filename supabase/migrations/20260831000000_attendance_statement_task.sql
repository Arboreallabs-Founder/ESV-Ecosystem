-- Link an attendance statement to the task raised when it is sent for approval.
--
-- Sending a statement now creates a real Task assigned to the employee. That is deliberately the
-- same mechanism as the notification: the alerts bell is fed by tasks assigned to you, so one
-- write both tells them and gives them something that will nag until it is done. A separate
-- notification table would have been a second thing to build and a second thing to forget.
--
-- The column exists so a re-send replaces its task instead of leaving a trail of stale ones.

ALTER TABLE public.attendance_statements
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.attendance_statements.task_id IS
  'The approval task raised for the employee when the statement was sent. Cleared if that task is deleted.';
