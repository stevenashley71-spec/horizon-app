select
  ws.code as step,
  sr.scan_entity_type
from public.workflow_step_scan_requirements sr
join public.workflow_steps ws
  on ws.id = sr.workflow_step_id
join public.workflow_definitions wd
  on wd.id = ws.workflow_definition_id
where wd.code = 'default_horizon_production_workflow'
order by ws.sort_order, sr.scan_entity_type;