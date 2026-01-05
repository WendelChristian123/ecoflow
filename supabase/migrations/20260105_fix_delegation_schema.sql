/*
  # 20260105_fix_delegation_schema.sql
  # MIGRATION: FIX DELEGATION SCHEMA AND RLS
  #
  # DESCRIPTION:
  # 1. Adds 'tenant_id' column to 'delegations' table (found missing, causing 400 errors if client sends it).
  # 2. Ensures strict RLS policy for INSERTing delegations.
*/

-- 1. ADD TENANT_ID COLUMN (If not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'delegations' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.delegations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
    END IF;
END $$;

-- 2. DROP EXISTING POLICY (To be safe and replace with explicit ones)
DROP POLICY IF EXISTS "Users can see own delegations" ON public.delegations;

-- 3. CREATE EXPLICIT POLICIES
-- VIEW: Owner or Delegate can see
CREATE POLICY "Delegations View" ON public.delegations
FOR SELECT USING (
  owner_id = auth.uid() OR 
  delegate_id = auth.uid()
);

-- INSERT: Only Owner can create (and must own the record)
CREATE POLICY "Delegations Create" ON public.delegations
FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);

-- DELETE: Only Owner can delete
CREATE POLICY "Delegations Delete" ON public.delegations
FOR DELETE USING (
  owner_id = auth.uid()
);
