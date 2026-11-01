alter table public.ai_analyses
  add column if not exists visual_findings text,
  add column if not exists detailed_report text;
