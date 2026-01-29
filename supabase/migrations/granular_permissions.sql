-- GRANTS & PERMISSIONS SYSTEM (3-LAYER)
-- 1. App Modules (System Catalog)
CREATE TABLE IF NOT EXISTS public.app_modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text
);

-- 2. App Features (System Catalog - Submodules)
CREATE TABLE IF NOT EXISTS public.app_features (
  id text PRIMARY KEY, -- e.g. 'finance.dashboard'
  module_id text REFERENCES public.app_modules(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL
);

-- 3. Tenant Modules (Layer 1: Hard Limit)
CREATE TABLE IF NOT EXISTS public.tenant_modules (
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  module_id text REFERENCES public.app_modules(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('included', 'extra', 'disabled')) NOT NULL DEFAULT 'disabled',
  PRIMARY KEY (tenant_id, module_id)
);

-- 4. User Permissions (Layer 2: Base Permissions)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  feature_id text REFERENCES public.app_features(id) ON DELETE CASCADE NOT NULL,
  actions jsonb NOT NULL DEFAULT '{"view": false, "create": false, "edit": false, "delete": false}'::jsonb,
  PRIMARY KEY (tenant_id, user_id, feature_id)
);

-- 5. Shared Access (Layer 3: Delegation)
CREATE TABLE IF NOT EXISTS public.shared_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Grantor
  target_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Recipient
  feature_id text REFERENCES public.app_features(id) ON DELETE CASCADE NOT NULL,
  actions jsonb NOT NULL DEFAULT '{"view": false, "create": false, "edit": false, "delete": false}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  -- Constraints to ensure logic
  CONSTRAINT shared_access_owner_target_check CHECK (owner_id != target_id)
);

-- SEED DATA (System Catalog)
INSERT INTO public.app_modules (id, name) VALUES 
('finance', 'Gestão Financeira'),
('routines', 'Rotinas & Execução'),
('commercial', 'Gestão Comercial')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_features (id, module_id, name) VALUES
('finance.dashboard', 'finance', 'Visão Geral'),
('finance.transactions', 'finance', 'Lançamentos'),
('finance.accounts', 'finance', 'Contas & Bancos'),
('finance.categories', 'finance', 'Categorias'),
('finance.cards', 'finance', 'Cartões'),
('routines.tasks', 'routines', 'Tarefas'),
('commercial.contacts', 'commercial', 'Contatos'),
('commercial.quotes', 'commercial', 'Orçamentos')
ON CONFLICT (id) DO NOTHING;

-- RLS POLICIES

-- Enable RLS
ALTER TABLE public.tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_features ENABLE ROW LEVEL SECURITY;

-- Public Read for Catalog
CREATE POLICY "Public read app_modules" ON public.app_modules FOR SELECT USING (true);
CREATE POLICY "Public read app_features" ON public.app_features FOR SELECT USING (true);

-- Tenant Modules: Users can see what's enabled for their tenant
CREATE POLICY "Users view own tenant modules" ON public.tenant_modules
FOR SELECT USING (tenant_id = public.get_current_tenant_id());

-- User Permissions: Users see ONLY their own
CREATE POLICY "Users view own permissions" ON public.user_permissions
FOR SELECT USING (user_id = auth.uid());

-- Shared Access: Users see existing shares where they are owner OR target
CREATE POLICY "Users view relevant shared access" ON public.shared_access
FOR SELECT USING (owner_id = auth.uid() OR target_id = auth.uid());

-- FUNCTIONS

-- Function to Grant Shared Access (Safe Backend Logic)
CREATE OR REPLACE FUNCTION public.grant_shared_access(
  _target_id uuid,
  _feature_id text,
  _actions jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _tenant_id uuid;
  _grantor_perms jsonb;
  _module_id text;
  _module_status text;
BEGIN
  -- 1. Get Context
  _tenant_id := public.get_current_tenant_id();
  
  -- 2. Check Module Status (Layer 1)
  SELECT module_id INTO _module_id FROM public.app_features WHERE id = _feature_id;
  SELECT status INTO _module_status FROM public.tenant_modules WHERE tenant_id = _tenant_id AND module_id = _module_id;
  
  IF _module_status IS NULL OR _module_status = 'disabled' THEN
    RAISE EXCEPTION 'Module disabled for this tenant';
  END IF;

  -- 3. Check Grantor Base Permissions (Layer 2)
  SELECT actions INTO _grantor_perms FROM public.user_permissions 
  WHERE tenant_id = _tenant_id AND user_id = auth.uid() AND feature_id = _feature_id;

  -- Logic: Grantor must have 'view' to grant anything, and ideally strictly sub-permissions.
  -- For MVP: If grantor has NO record, he can't grant.
  IF _grantor_perms IS NULL OR (_grantor_perms->>'view')::boolean IS DISTINCT FROM true THEN
     RAISE EXCEPTION 'You do not have permission to share this feature';
  END IF;

  -- 4. Insert
  INSERT INTO public.shared_access (tenant_id, owner_id, target_id, feature_id, actions)
  VALUES (_tenant_id, auth.uid(), _target_id, _feature_id, _actions);

  RETURN true;
END;
$$;
