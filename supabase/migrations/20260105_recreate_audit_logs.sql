-- Recreate audit_logs table to match API and Trigger expectations
DROP TABLE IF EXISTS public.audit_logs CASCADE;

CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid, -- Assuming UUID based on usage
  action text CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ACTION')) NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- FK added here directly
  tenant_id uuid,
  description text,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants can only see their own logs
CREATE POLICY "Tenant isolation for audit_logs" ON public.audit_logs
USING (tenant_id = public.get_current_tenant_id());
