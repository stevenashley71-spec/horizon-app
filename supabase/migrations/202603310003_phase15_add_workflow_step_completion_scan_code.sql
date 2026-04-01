alter table public.workflow_steps
add column if not exists completion_scan_code text null;

notify pgrst, 'reload schema';
