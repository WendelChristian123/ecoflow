-- ==========================================
-- DISTRIBUTION OF NOTIFICATIONS FOR NO-OWNER MODULES
-- ==========================================

-- Function to distribute a notification to all eligible users in a module
CREATE OR REPLACE FUNCTION public.fn_distribute_scheduled_notification(
    p_company_id UUID,
    p_reference_id UUID,
    p_notification_type TEXT,
    p_module_id TEXT,
    p_reference_date TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- If it's not active anymore (e.g. paid, approved), just cancel for everyone unconditionally to be safe
    IF NOT p_is_active THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    -- Loop over all eligible users
    FOR v_user_id IN 
        SELECT DISTINCT cu.user_id
        FROM public.company_users cu
        LEFT JOIN public.user_permissions up 
          ON up.user_id = cu.user_id 
          AND up.company_id = cu.company_id 
          AND up.feature_id LIKE p_module_id || '.%'
          AND (up.actions->>'view')::boolean = true
        WHERE cu.company_id = p_company_id
          AND (cu.role = 'admin' OR up.user_id IS NOT NULL)
    LOOP
        PERFORM public.fn_sync_scheduled_notification(
            p_company_id, v_user_id, p_reference_id, p_notification_type, p_module_id, p_reference_date, p_is_active
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the Finance trigger to use the new distribution function
CREATE OR REPLACE FUNCTION public.trg_finance_sync_notification()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = OLD.id AND notification_type IN ('payable_due', 'receivable_due');
        RETURN OLD;
    END IF;

    IF NEW.due_date IS NOT NULL THEN
        PERFORM public.fn_distribute_scheduled_notification(
            NEW.company_id, 
            NEW.id, 
            CASE WHEN NEW.type = 'expense' THEN 'payable_due' ELSE 'receivable_due' END, 
            'finance', 
            NEW.due_date, 
            NOT NEW.is_paid
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the Quotes trigger to use the new distribution function
CREATE OR REPLACE FUNCTION public.trg_quotes_sync_notification()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = OLD.id AND notification_type = 'quote_expiration';
        RETURN OLD;
    END IF;

    IF NEW.valid_until IS NOT NULL THEN
        PERFORM public.fn_distribute_scheduled_notification(
            NEW.company_id, 
            NEW.id, 
            'quote_expiration', 
            'commercial', 
            NEW.valid_until, 
            NEW.status NOT IN ('approved', 'rejected')
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
