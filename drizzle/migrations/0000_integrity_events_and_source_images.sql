-- images extracted from uploaded documents
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS image_urls JSONB NULL DEFAULT '[]'::jsonb;

-- exam integrity / anti-cheat events
CREATE TABLE IF NOT EXISTS public.integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  exam_id UUID NOT NULL,
  attempt_type TEXT NOT NULL,
  key_pressed TEXT NULL,
  warning_shown BOOLEAN NOT NULL DEFAULT TRUE,
  exam_continued BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_integrity_events_exam ON public.integrity_events (exam_id);

GRANT SELECT, INSERT ON public.integrity_events TO authenticated;
GRANT ALL ON public.integrity_events TO service_role;

ALTER TABLE public.integrity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own integrity events"
  ON public.integrity_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users select own integrity events"
  ON public.integrity_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());
