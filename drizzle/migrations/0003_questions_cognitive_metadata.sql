ALTER TABLE public.questions
  ADD COLUMN question_kind text,
  ADD COLUMN cognitive_level text,
  ADD COLUMN complexity_level text,
  ADD COLUMN context_depth text,
  ADD COLUMN requires_integration boolean;
COMMENT ON COLUMN public.questions.question_kind IS 'analytical | comprehension | direct';
COMMENT ON COLUMN public.questions.cognitive_level IS 'remember | understand | apply | analyze | evaluate | create';
COMMENT ON COLUMN public.questions.complexity_level IS 'basic | intermediate | advanced';
COMMENT ON COLUMN public.questions.context_depth IS 'shallow | medium | deep';