-- Migration: update_tenant_constraints_cascade
-- Description: Update FK constraints on 'profiles' and 'delegations' to ON DELETE CASCADE to allow hard deletion of tenants.

-- 1. Profiles Table
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants (id)
ON DELETE CASCADE;

-- 2. Delegations Table
ALTER TABLE public.delegations
DROP CONSTRAINT IF EXISTS delegations_tenant_id_fkey;

ALTER TABLE public.delegations
ADD CONSTRAINT delegations_tenant_id_fkey
FOREIGN KEY (tenant_id)
REFERENCES public.tenants (id)
ON DELETE CASCADE;
