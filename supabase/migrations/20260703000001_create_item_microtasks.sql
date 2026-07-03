-- Create item_microtasks table
CREATE TABLE IF NOT EXISTS public.item_microtasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_type text NOT NULL CHECK (parent_type IN ('task', 'project', 'team', 'agenda_task')),
    parent_id uuid NOT NULL,
    title text NOT NULL,
    is_completed boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_item_microtasks_parent ON public.item_microtasks(parent_id, parent_type);
CREATE INDEX IF NOT EXISTS idx_item_microtasks_tenant ON public.item_microtasks(tenant_id);

-- Enable RLS
ALTER TABLE public.item_microtasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view microtasks in their tenant"
    ON public.item_microtasks
    FOR SELECT
    USING (
        tenant_id = (SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), ''))::uuid
        OR 
        tenant_id IN (
            SELECT company_id 
            FROM public.company_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert microtasks in their tenant"
    ON public.item_microtasks
    FOR INSERT
    WITH CHECK (
        tenant_id = (SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), ''))::uuid
        OR 
        tenant_id IN (
            SELECT company_id 
            FROM public.company_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update microtasks in their tenant"
    ON public.item_microtasks
    FOR UPDATE
    USING (
        tenant_id = (SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), ''))::uuid
        OR 
        tenant_id IN (
            SELECT company_id 
            FROM public.company_users 
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id = (SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), ''))::uuid
        OR 
        tenant_id IN (
            SELECT company_id 
            FROM public.company_users 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete microtasks in their tenant"
    ON public.item_microtasks
    FOR DELETE
    USING (
        tenant_id = (SELECT NULLIF(current_setting('request.jwt.claim.company_id', true), ''))::uuid
        OR 
        tenant_id IN (
            SELECT company_id 
            FROM public.company_users 
            WHERE user_id = auth.uid()
        )
    );

-- Add Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_item_microtasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_item_microtasks_updated_at ON public.item_microtasks;
CREATE TRIGGER trigger_item_microtasks_updated_at
    BEFORE UPDATE ON public.item_microtasks
    FOR EACH ROW
    EXECUTE FUNCTION public.set_item_microtasks_updated_at();

-- Enable realtime
alter publication supabase_realtime add table public.item_microtasks;
