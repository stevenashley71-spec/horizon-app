insert into public.workflow_definitions (
  code,
  name,
  version,
  status,
  applies_to_cremation_type,
  description
)
select
  'default_horizon_production_workflow',
  'Default Horizon Production Workflow',
  1,
  'active',
  'all',
  null
where not exists (
  select 1
  from public.workflow_definitions
  where code = 'default_horizon_production_workflow'
    and version = 1
);

insert into public.workflow_steps (
  workflow_definition_id,
  code,
  name,
  step_type,
  sort_order,
  required,
  case_event_type,
  target_case_status,
  intake_section,
  description
)
select
  wd.id,
  seed.code,
  seed.name,
  seed.step_type,
  seed.sort_order,
  true,
  seed.case_event_type,
  null,
  null,
  null
from public.workflow_definitions wd
join (
  values
    ('case_created', 'Case Created', 'task', 1, 'case_created'),
    ('picked_up', 'Picked Up', 'scan', 2, 'picked_up'),
    ('received_at_facility', 'Received At Facility', 'scan', 3, 'received_at_facility'),
    ('cremation_started', 'Cremation Started', 'scan', 4, 'cremation_started'),
    ('cremation_completed', 'Cremation Completed', 'scan', 5, 'cremation_completed'),
    ('packaged', 'Packaged', 'scan', 6, 'packaged'),
    ('returned', 'Returned', 'scan', 7, 'returned'),
    ('scattered', 'Scattered', 'scan', 8, 'scattered')
) as seed(code, name, step_type, sort_order, case_event_type)
  on true
where wd.code = 'default_horizon_production_workflow'
  and wd.version = 1
  and not exists (
    select 1
    from public.workflow_steps ws
    where ws.workflow_definition_id = wd.id
      and ws.code = seed.code
  );

insert into public.workflow_step_dependencies (
  workflow_definition_id,
  step_id,
  depends_on_step_id,
  dependency_type
)
select
  wd.id,
  step_ws.id,
  depends_ws.id,
  'completion'
from public.workflow_definitions wd
join (
  values
    ('picked_up', 'case_created'),
    ('received_at_facility', 'picked_up'),
    ('cremation_started', 'received_at_facility'),
    ('cremation_completed', 'cremation_started'),
    ('packaged', 'cremation_completed'),
    ('returned', 'packaged'),
    ('scattered', 'cremation_completed')
) as seed(step_code, depends_on_code)
  on true
join public.workflow_steps step_ws
  on step_ws.workflow_definition_id = wd.id
 and step_ws.code = seed.step_code
join public.workflow_steps depends_ws
  on depends_ws.workflow_definition_id = wd.id
 and depends_ws.code = seed.depends_on_code
where wd.code = 'default_horizon_production_workflow'
  and wd.version = 1
  and not exists (
    select 1
    from public.workflow_step_dependencies d
    where d.step_id = step_ws.id
      and d.depends_on_step_id = depends_ws.id
  );

insert into public.workflow_step_scan_requirements (
  workflow_step_id,
  scan_entity_type,
  required
)
select
  ws.id,
  seed.scan_entity_type,
  true
from public.workflow_definitions wd
join public.workflow_steps ws
  on ws.workflow_definition_id = wd.id
join (
  values
    ('picked_up', 'case'),
    ('picked_up', 'remains'),
    ('received_at_facility', 'case'),
    ('received_at_facility', 'remains'),
    ('cremation_started', 'case'),
    ('cremation_started', 'remains'),
    ('cremation_completed', 'case'),
    ('cremation_completed', 'remains'),
    ('packaged', 'case'),
    ('packaged', 'remains'),
    ('returned', 'case'),
    ('returned', 'remains'),
    ('scattered', 'case'),
    ('scattered', 'remains')
) as seed(step_code, scan_entity_type)
  on ws.code = seed.step_code
where wd.code = 'default_horizon_production_workflow'
  and wd.version = 1
  and not exists (
    select 1
    from public.workflow_step_scan_requirements sr
    where sr.workflow_step_id = ws.id
      and sr.scan_entity_type = seed.scan_entity_type
  );

insert into public.workflow_step_rules (
  workflow_step_id,
  rule_type,
  operator,
  value_json
)
select
  ws.id,
  'cremation_type_in',
  'in',
  seed.value_json
from public.workflow_definitions wd
join public.workflow_steps ws
  on ws.workflow_definition_id = wd.id
join (
  values
    ('packaged', '["private"]'::jsonb),
    ('returned', '["private"]'::jsonb),
    ('scattered', '["general"]'::jsonb)
) as seed(step_code, value_json)
  on ws.code = seed.step_code
where wd.code = 'default_horizon_production_workflow'
  and wd.version = 1
  and not exists (
    select 1
    from public.workflow_step_rules r
    where r.workflow_step_id = ws.id
      and r.rule_type = 'cremation_type_in'
      and r.operator = 'in'
      and r.value_json = seed.value_json
  );

notify pgrst, 'reload schema';
