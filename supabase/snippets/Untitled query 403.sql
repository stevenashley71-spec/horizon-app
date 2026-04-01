select
  wd.code as workflow_code,
  ws.code as step_code,
  ws.sort_order,
  ws.step_type
from public.workflow_definitions wd
join public.workflow_steps ws
  on ws.workflow_definition_id = wd.id
where wd.code = 'default_horizon_production_workflow'
order by ws.sort_order;