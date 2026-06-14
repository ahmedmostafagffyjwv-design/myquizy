ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS question_shape TEXT NOT NULL DEFAULT 'mixed';
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS content_nature TEXT;
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS focus_areas JSONB;