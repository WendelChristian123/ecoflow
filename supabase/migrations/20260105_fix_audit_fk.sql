-- Add FK to allow resolving user names in Audit Logs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'audit_logs_user_id_fkey'
    ) THEN
        ALTER TABLE public.audit_logs 
        ADD CONSTRAINT audit_logs_user_id_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id)
        ON DELETE SET NULL;
    END IF;
END $$;
