-- 1) Remove duplicate attempts: keep the best (highest score, then most recent) per user/exam/question
DELETE FROM public.attempts a
USING (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, exam_id, question_id
    ORDER BY score DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM public.attempts
) d
WHERE a.id = d.id AND d.rn > 1;

-- 2) Prevent duplicates permanently
ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_unique_per_question UNIQUE (user_id, exam_id, question_id);

-- 3) Recompute scores of completed exams from the deduplicated attempts
UPDATE public.exams e
SET score = sub.pct
FROM (
  SELECT exam_id, round(sum(coalesce(score, 0)) / (count(*) * 10.0) * 100) AS pct
  FROM public.attempts
  GROUP BY exam_id
) sub
WHERE e.id = sub.exam_id AND e.status = 'completed';