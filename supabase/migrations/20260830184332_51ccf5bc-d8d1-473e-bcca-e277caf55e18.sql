ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;
ALTER TABLE public.api_projects ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;