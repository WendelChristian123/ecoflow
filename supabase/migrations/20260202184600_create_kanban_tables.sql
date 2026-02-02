-- Create kanbans table
CREATE TABLE IF NOT EXISTS public.kanbans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    module TEXT NOT NULL CHECK (module IN ('crm', 'tasks', 'projects', 'teams')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create kanban_stages table
CREATE TABLE IF NOT EXISTS public.kanban_stages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    kanban_id UUID REFERENCES public.kanbans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'bg-slate-500',
    position INTEGER NOT NULL DEFAULT 0,
    system_status TEXT, -- Maps to internal statuses like 'approved', 'draft'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kanbans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_stages ENABLE ROW LEVEL SECURITY;

-- Policies for kanbans
CREATE POLICY "Users can view kanbans of their tenant" ON public.kanbans
    FOR SELECT USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert kanbans to their tenant" ON public.kanbans
    FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update kanbans of their tenant" ON public.kanbans
    FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete kanbans of their tenant" ON public.kanbans
    FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Policies for kanban_stages
CREATE POLICY "Users can view stages of their tenant's kanbans" ON public.kanban_stages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.kanbans
            WHERE kanbans.id = kanban_stages.kanban_id
            AND kanbans.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert stages to their tenant's kanbans" ON public.kanban_stages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.kanbans
            WHERE kanbans.id = kanban_stages.kanban_id
            AND kanbans.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update stages of their tenant's kanbans" ON public.kanban_stages
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.kanbans
            WHERE kanbans.id = kanban_stages.kanban_id
            AND kanbans.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can delete stages of their tenant's kanbans" ON public.kanban_stages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.kanbans
            WHERE kanbans.id = kanban_stages.kanban_id
            AND kanbans.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Add columns to existing tables
ALTER TABLE public.quotes 
    ADD COLUMN IF NOT EXISTS kanban_id UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kanban_stage_id UUID REFERENCES public.kanban_stages(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS kanban_id UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kanban_stage_id UUID REFERENCES public.kanban_stages(id) ON DELETE SET NULL;

ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS kanban_id UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kanban_stage_id UUID REFERENCES public.kanban_stages(id) ON DELETE SET NULL;

ALTER TABLE public.teams 
    ADD COLUMN IF NOT EXISTS kanban_id UUID REFERENCES public.kanbans(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS kanban_stage_id UUID REFERENCES public.kanban_stages(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_kanbans_tenant ON public.kanbans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kanbans_module ON public.kanbans(module);
CREATE INDEX IF NOT EXISTS idx_stages_kanban ON public.kanban_stages(kanban_id);
