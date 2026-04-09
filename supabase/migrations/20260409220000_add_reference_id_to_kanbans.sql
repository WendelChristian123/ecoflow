ALTER TABLE public.kanbans ADD COLUMN IF NOT EXISTS reference_id UUID;
CREATE INDEX IF NOT EXISTS idx_kanbans_reference_id ON public.kanbans(reference_id);
