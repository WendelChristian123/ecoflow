-- ==========================================
-- TRIGGER DE NOTIFICAÇÕES PARA ORÇAMENTOS
-- ==========================================

-- 1. Função Gatilho para Orçamentos (Quotes)
CREATE OR REPLACE FUNCTION public.trg_quotes_sync_notification()
RETURNS trigger AS $$
BEGIN
    -- Se deletou, cancela o agendamento
    IF TG_OP = 'DELETE' THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = OLD.id AND notification_type = 'quote_expiration';
        RETURN OLD;
    END IF;

    -- Se inseriu ou atualizou
    IF NEW.user_id IS NOT NULL AND NEW.valid_until IS NOT NULL THEN
        -- Apenas ativo se não estiver aprovado ou rejeitado
        PERFORM public.fn_sync_scheduled_notification(
            NEW.company_id, 
            NEW.user_id, 
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

-- 2. Vincular o gatilho à tabela 'quotes'
DROP TRIGGER IF EXISTS quotes_sync_notification_trigger ON public.quotes;
CREATE TRIGGER quotes_sync_notification_trigger
    AFTER INSERT OR UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_quotes_sync_notification();

DROP TRIGGER IF EXISTS quotes_sync_notification_delete_trigger ON public.quotes;
CREATE TRIGGER quotes_sync_notification_delete_trigger
    AFTER DELETE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_quotes_sync_notification();
