-- ==========================================
-- ADJUSTMENT FOR DATE-ONLY MODULES (FINANCE AND COMMERCIAL)
-- ==========================================

CREATE OR REPLACE FUNCTION public.fn_sync_scheduled_notification(
    p_company_id UUID,
    p_user_id UUID,
    p_reference_id UUID,
    p_notification_type TEXT,
    p_module_id TEXT,
    p_reference_date TIMESTAMPTZ,
    p_is_active BOOLEAN
)
RETURNS VOID AS $$
DECLARE
    v_minutes_before INTEGER;
    v_target_time TIMESTAMPTZ;
BEGIN
    -- Se o item não está mais ativo (foi concluído, cancelado, deletado)
    IF NOT p_is_active THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND user_id = p_user_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    -- Busca a preferência do usuário
    SELECT notify_before_minutes INTO v_minutes_before
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id 
      AND company_id = p_company_id 
      AND module_id = p_module_id 
      AND event_type = p_notification_type;

    IF v_minutes_before IS NULL THEN
        v_minutes_before := 0;
    END IF;

    IF v_minutes_before < 0 THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND user_id = p_user_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    -- Calcula a data alvo
    v_target_time := p_reference_date - (v_minutes_before || ' minutes')::interval;

    -- Se for um módulo que usa apenas DATA (Financeiro ou Comercial),
    -- forçamos a notificação para disparar às 12:00 UTC (09:00 BRT / 08:00 AMT)
    IF p_module_id IN ('finance', 'commercial') THEN
        v_target_time := date_trunc('day', v_target_time) + interval '12 hours';
    END IF;

    -- Faz Upsert na Fila
    INSERT INTO public.scheduled_notifications (
        company_id, user_id, reference_id, notification_type, target_time, status, attempts, last_error
    )
    VALUES (
        p_company_id, p_user_id, p_reference_id, p_notification_type, v_target_time, 'pending', 0, NULL
    )
    ON CONFLICT (reference_id, user_id, notification_type) 
    DO UPDATE SET
        target_time = EXCLUDED.target_time,
        status = 'pending',
        attempts = 0,
        last_error = NULL,
        updated_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
