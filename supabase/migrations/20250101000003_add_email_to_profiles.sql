
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- Optional: Backfill email from auth.users if possible, but requires permissions.
-- For now, just adding the column.
