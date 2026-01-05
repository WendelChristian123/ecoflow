-- RPC to securely log auth events from client
CREATE OR REPLACE FUNCTION public.log_auth_event(
    p_action text,
    p_description text
)
RETURNS void AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = auth.uid();

    INSERT INTO public.audit_logs (
        table_name,
        action,
        user_id,
        tenant_id,
        description,
        created_at
    ) VALUES (
        'auth',
        p_action,
        auth.uid(),
        v_tenant_id,
        p_description,
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
