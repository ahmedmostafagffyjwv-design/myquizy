CREATE TABLE public.reference_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  subject_id uuid,
  title text NOT NULL,
  raw_text text NOT NULL,
  style_profile jsonb,
  status text NOT NULL DEFAULT 'processing',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_exams TO authenticated;
GRANT ALL ON public.reference_exams TO service_role;
ALTER TABLE public.reference_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reference exams" ON public.reference_exams FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX reference_exams_subject_idx ON public.reference_exams(subject_id);