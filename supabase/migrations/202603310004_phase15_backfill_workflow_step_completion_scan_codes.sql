update public.workflow_steps as ws
set completion_scan_code = case ws.code
  when 'picked_up' then 'picked_up_completed'
  when 'received_at_facility' then 'received_at_facility_completed'
  when 'cremation_started' then 'cremation_started_completed'
  when 'cremation_completed' then 'cremation_completed_completed'
  when 'packaged' then 'packaged_completed'
  when 'returned' then 'returned_completed'
  when 'scattered' then 'scattered_completed'
  else ws.completion_scan_code
end
from public.workflow_definitions as wd
where ws.workflow_definition_id = wd.id
  and wd.code = 'default_horizon_production_workflow'
  and wd.version = 1
  and ws.code in (
    'picked_up',
    'received_at_facility',
    'cremation_started',
    'cremation_completed',
    'packaged',
    'returned',
    'scattered'
  );

notify pgrst, 'reload schema';
