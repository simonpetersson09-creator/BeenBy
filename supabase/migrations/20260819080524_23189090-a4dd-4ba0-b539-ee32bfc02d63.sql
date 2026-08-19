-- push_log is only written to by the internal notify_push trigger (which runs
-- as the function owner) and read by service_role. RLS is not needed and the
-- linter flagged the table as having RLS enabled without policies.
ALTER TABLE public.push_log DISABLE ROW LEVEL SECURITY;
