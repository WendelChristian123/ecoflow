ALTER TABLE IF EXISTS public.saas_plans 
ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.tenant_addons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_type text CHECK (addon_type IN ('user_slot', 'storage_gb')),
  quantity integer DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tenant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for addons" ON public.tenant_addons
USING (tenant_id = public.get_current_tenant_id());
