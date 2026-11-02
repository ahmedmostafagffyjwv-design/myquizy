CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT 'blue',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subjects" ON public.subjects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.subject_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_units TO authenticated;
GRANT ALL ON public.subject_units TO service_role;
ALTER TABLE public.subject_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own units" ON public.subject_units FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.subject_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  unit_id uuid NOT NULL REFERENCES public.subject_units(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subject_lessons TO authenticated;
GRANT ALL ON public.subject_lessons TO service_role;
ALTER TABLE public.subject_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lessons" ON public.subject_lessons FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.sources
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN unit_id uuid REFERENCES public.subject_units(id) ON DELETE SET NULL,
  ADD COLUMN lesson_id uuid REFERENCES public.subject_lessons(id) ON DELETE SET NULL;
ALTER TABLE public.exams
  ADD COLUMN subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN unit_id uuid REFERENCES public.subject_units(id) ON DELETE SET NULL,
  ADD COLUMN lesson_id uuid REFERENCES public.subject_lessons(id) ON DELETE SET NULL,
  ADD COLUMN source_ids jsonb;

-- Backfill: one "مصادر سابقة" subject per user with existing sources
INSERT INTO public.subjects (user_id, name, color, description)
SELECT DISTINCT user_id, 'مصادر سابقة', 'slate', 'مادة أُنشئت تلقائيًا لتجميع مصادرك القديمة'
FROM public.sources WHERE subject_id IS NULL;
UPDATE public.sources s SET subject_id = sub.id
FROM public.subjects sub WHERE sub.user_id = s.user_id AND sub.name = 'مصادر سابقة' AND s.subject_id IS NULL;
UPDATE public.exams e SET subject_id = s.subject_id FROM public.sources s WHERE e.source_id = s.id AND e.subject_id IS NULL;