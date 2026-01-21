-- Migration: fix_audit_log_trigger_deleted_user
-- Description: Update the process_audit_log trigger to check if the user exists before inserting into audit_logs.

CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_user_name text;
    v_tenant_id uuid;
    v_old_data jsonb;
    v_new_data jsonb;
    v_description text;
    v_record_name text;
    v_ip_address text;
BEGIN
    -- 1. Determine Tenant ID
    IF TG_TABLE_NAME = 'tenants' THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := OLD.id;
        ELSE
            v_tenant_id := NEW.id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Safely get tenant_id if column exists
        BEGIN
            v_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    ELSE
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    END IF;

    -- 2. Determine User ID (with safety check)
    v_user_id := auth.uid();

    -- **CRITICAL FIX**: If we are deleting a User (profiles) or Tenant (which cascades to users),
    -- verify if the 'auth.uid()' user actually still exists in 'profiles'.
    -- If not, set v_user_id to NULL to avoid FK violation on audit_logs.
    IF v_user_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
            v_user_id := NULL;
        END IF;
    END IF;

    -- 3. Set Data
    IF TG_OP = 'INSERT' THEN
        v_old_data := null;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := null;
    END IF;

    -- 4. Get IP Address (if available in headers)
    -- Helper block to extract header 'x-user-ip' or 'x-forwarded-for'
    BEGIN
        v_ip_address := current_setting('request.headers', true)::json->>'x-user-ip';
        IF v_ip_address IS NULL THEN
            v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;

    -- 5. Construct Description (Simplified for brevity/resilience)
    v_description := TG_OP || ' on ' || TG_TABLE_NAME;

    -- 6. Insert Log
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        tenant_id,
        description,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        v_tenant_id,
        v_description,
        v_ip_address
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
