select
  ws.code as step,
  r.value_json
from public.workflow_step_rules r
join public.workflow_steps ws
  on ws.id = r.workflow_step_id
join public.workflow_definitions wd
  on wd.id = ws.workflow_definition_id
where wd.code = 'default_horizon_production_workflow'
order by ws.sort_order;