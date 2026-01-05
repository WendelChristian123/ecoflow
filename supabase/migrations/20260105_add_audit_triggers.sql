-- Function to handle audit logging automatically
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_tenant_id uuid;
    v_old_data jsonb;
    v_new_data jsonb;
    v_description text;
BEGIN
    -- Attempt to get user_id from auth context
    v_user_id := auth.uid();
    
    -- Determine Tenant ID (priority: NEW > OLD > user's tenant)
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := null;
        v_description := 'Registro excluído em ' || TG_TABLE_NAME;
    ELSIF TG_OP = 'UPDATE' THEN
        v_tenant_id := NEW.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_description := 'Registro atualizado em ' || TG_TABLE_NAME;
    ELSIF TG_OP = 'INSERT' THEN
        v_tenant_id := NEW.tenant_id;
        v_old_data := null;
        v_new_data := to_jsonb(NEW);
        v_description := 'Novo registro em ' || TG_TABLE_NAME;
    END IF;

    -- If no user_id (system action?), keep separate handling if needed, but defaults to null or system user if configured.
    -- If no tenant_id found in record, it remains null (system-wide) or handled by app logic.

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        tenant_id,
        description
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        v_tenant_id,
        v_description
    );

    RETURN NULL; -- Return value for AFTER triggers is ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Triggers to Critical Tables

-- 1. Tasks
DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
CREATE TRIGGER audit_tasks
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 2. Calendar Events
DROP TRIGGER IF EXISTS audit_events ON public.calendar_events;
CREATE TRIGGER audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 3. Financial Transactions
DROP TRIGGER IF EXISTS audit_transactions ON public.financial_transactions;
CREATE TRIGGER audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. Quotes (Commercial)
DROP TRIGGER IF EXISTS audit_quotes ON public.quotes;
CREATE TRIGGER audit_quotes
AFTER INSERT OR UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 5. Projects
DROP TRIGGER IF EXISTS audit_projects ON public.projects;
CREATE TRIGGER audit_projects
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 6. Teams
DROP TRIGGER IF EXISTS audit_teams ON public.teams;
CREATE TRIGGER audit_teams
AFTER INSERT OR UPDATE OR DELETE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 7. Profiles (User Management)
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 8. Delegations (Access Control)
-- Check if table exists first (it should based on recent work)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'delegations') THEN
        DROP TRIGGER IF EXISTS audit_delegations ON public.delegations;
        CREATE TRIGGER audit_delegations
        AFTER INSERT OR UPDATE OR DELETE ON public.delegations
        FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
    END IF;
END $$;
