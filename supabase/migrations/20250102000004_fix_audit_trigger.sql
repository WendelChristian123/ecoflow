CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_company_id uuid;
    v_old_data jsonb;
    v_new_data jsonb;
    v_description text;
    v_ip_address text;
BEGIN
    -- 1. Determine Company ID
    IF TG_TABLE_NAME = 'companies' THEN
        IF TG_OP = 'DELETE' THEN
            v_company_id := OLD.id;
        ELSE
            v_company_id := NEW.id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        -- Safely get company_id if column exists
        BEGIN
            v_company_id := OLD.company_id;
        EXCEPTION WHEN OTHERS THEN
            v_company_id := NULL;
        END;
    ELSE
        BEGIN
            v_company_id := NEW.company_id;
        EXCEPTION WHEN OTHERS THEN
            v_company_id := NULL;
        END;
    END IF;

    -- 2. Determine User ID (with safety check)
    v_user_id := auth.uid();

    -- Check if user exists in profiles to avoid FK violation
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

    -- 4. Get IP Address
    BEGIN
        v_ip_address := current_setting('request.headers', true)::json->>'x-user-ip';
        IF v_ip_address IS NULL THEN
            v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ip_address := NULL;
    END;

    -- 5. Construct Description
    v_description := TG_OP || ' on ' || TG_TABLE_NAME;

    -- 6. Insert Log
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        user_id,
        company_id,
        description,
        ip_address
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_data,
        v_new_data,
        v_user_id,
        v_company_id,
        v_description,
        v_ip_address
    );

    RETURN NULL;
END;
$$;
