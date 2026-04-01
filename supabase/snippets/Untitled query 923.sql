select
  ws.code as step,
  depends.code as depends_on
from public.workflow_step_dependencies d
join public.workflow_steps ws
  on ws.id = d.step_id
join public.workflow_steps depends
  on depends.id = d.depends_on_step_id
join public.workflow_definitions wd
  on wd.id = ws.workflow_definition_id
where wd.code = 'default_horizon_production_workflow'
order by ws.sort_order, depends.sort_order;