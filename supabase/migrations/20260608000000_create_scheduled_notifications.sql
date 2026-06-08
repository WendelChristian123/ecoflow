-- Migration: Scheduled Notifications Queue
-- Implementa uma fila de notificações resiliente com PL/pgSQL

-- 1. Criação da tabela de Fila (Queue)
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL,
    notification_type TEXT NOT NULL, -- 'task_deadline', 'event_start', 'payable_due', 'receivable_due'
    target_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed', 'cancelled'
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Restrição de Unicidade: Garante que só há 1 notificação do mesmo tipo para o mesmo usuário sobre a mesma referência
    UNIQUE (reference_id, user_id, notification_type)
);

-- Habilitar RLS
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- 2. Índices para performance
-- Usado pelo worker (target_time <= now() AND status = 'pending')
CREATE INDEX IF NOT EXISTS idx_sched_notif_worker ON public.scheduled_notifications (status, target_time);
CREATE INDEX IF NOT EXISTS idx_sched_notif_company ON public.scheduled_notifications (company_id);
CREATE INDEX IF NOT EXISTS idx_sched_notif_user ON public.scheduled_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_sched_notif_reference ON public.scheduled_notifications (reference_id);

-- 3. Função PL/pgSQL Core para gerenciar o agendamento
-- Esta função é responsável por Inserir, Atualizar ou Cancelar a notificação na fila.
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
          AND status IN ('pending', 'failed'); -- Não mexe nos que já foram 'sent'
        RETURN;
    END IF;

    -- Busca a preferência do usuário (ex: quantos minutos antes)
    SELECT notify_before_minutes INTO v_minutes_before
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id 
      AND company_id = p_company_id 
      AND module_id = p_module_id 
      AND event_type = p_notification_type;

    -- Se não encontrou preferência, assume o padrão de "momento exato" = 0.
    -- Opcional: Se v_minutes_before for nulo e você não quiser notificar, pode usar RETURN. 
    -- Assumiremos 0 como padrão de "No momento exato".
    IF v_minutes_before IS NULL THEN
        v_minutes_before := 0;
    END IF;

    -- Se o usuário configurou para -1, ele não quer ser avisado.
    IF v_minutes_before < 0 THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND user_id = p_user_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    -- Calcula a hora exata baseada no fuso UTC do banco e na data referência
    v_target_time := p_reference_date - (v_minutes_before || ' minutes')::interval;

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
        status = 'pending', -- Volta para pending caso a data mude e estava cancelada ou em erro
        attempts = 0,
        last_error = NULL,
        updated_at = NOW()
    WHERE public.scheduled_notifications.status IN ('pending', 'failed', 'cancelled');
    
    -- IMPORTANTE: Se a notificação já for 'sent', a lógica acima ignora a atualização
    -- pois já foi entregue. Caso mude a data para o futuro, o ideal seria reativar,
    -- mas a condição WHERE limitou a status in ('pending', 'failed', 'cancelled').
    -- Vamos alterar a DO UPDATE para que, se a data_referencia mudar, e já estava 'sent', ele envie de novo.
    -- (Ex: Adiamento de Tarefa)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ajuste final da função Core (recriando para garantir a lógica de recálculo se a data mudou)
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
    IF NOT p_is_active THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND user_id = p_user_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    SELECT notify_before_minutes INTO v_minutes_before
    FROM public.user_notification_preferences
    WHERE user_id = p_user_id 
      AND company_id = p_company_id 
      AND module_id = p_module_id 
      AND event_type = p_notification_type;

    IF v_minutes_before IS NULL THEN v_minutes_before := 0; END IF;

    IF v_minutes_before < 0 THEN
        UPDATE public.scheduled_notifications
        SET status = 'cancelled', updated_at = NOW()
        WHERE reference_id = p_reference_id 
          AND user_id = p_user_id 
          AND notification_type = p_notification_type
          AND status IN ('pending', 'failed');
        RETURN;
    END IF;

    v_target_time := p_reference_date - (v_minutes_before || ' minutes')::interval;

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
        updated_at = NOW()
    WHERE public.scheduled_notifications.target_time != EXCLUDED.target_time 
       OR public.scheduled_notifications.status IN ('failed', 'cancelled');
       -- Só recria se a hora mudou ou se estava cancelada/falhada
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Triggers nas Tabelas Principais

-- 4.1 TASKS
CREATE OR REPLACE FUNCTION public.trg_tasks_sync_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        PERFORM public.fn_sync_scheduled_notification(OLD.company_id, OLD.assignee_id, OLD.id, 'task_deadline', 'routines', OLD.due_date, FALSE);
        RETURN OLD;
    END IF;

    IF NEW.assignee_id IS NOT NULL AND NEW.due_date IS NOT NULL THEN
        -- active se não estiver 'done'
        PERFORM public.fn_sync_scheduled_notification(
            NEW.company_id, 
            NEW.assignee_id, 
            NEW.id, 
            'task_deadline', 
            'routines', 
            NEW.due_date, 
            NEW.status != 'done'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_sync_notification_trigger ON public.tasks;
CREATE TRIGGER tasks_sync_notification_trigger
AFTER INSERT OR UPDATE OF status, due_date, assignee_id ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_sync_notification();
CREATE TRIGGER tasks_sync_notification_delete_trigger
BEFORE DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_tasks_sync_notification();

-- 4.2 CALENDAR EVENTS
CREATE OR REPLACE FUNCTION public.trg_events_sync_notification()
RETURNS TRIGGER AS $$
DECLARE
    participant_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        IF OLD.participants IS NOT NULL THEN
            FOREACH participant_id IN ARRAY OLD.participants LOOP
                PERFORM public.fn_sync_scheduled_notification(OLD.company_id, participant_id, OLD.id, 'event_start', 'routines', OLD.start_date, FALSE);
            END LOOP;
        END IF;
        RETURN OLD;
    END IF;

    IF NEW.participants IS NOT NULL AND NEW.start_date IS NOT NULL THEN
        FOREACH participant_id IN ARRAY NEW.participants LOOP
            PERFORM public.fn_sync_scheduled_notification(
                NEW.company_id, 
                participant_id, 
                NEW.id, 
                'event_start', 
                'routines', 
                NEW.start_date, 
                NEW.status NOT IN ('completed', 'cancelled')
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_sync_notification_trigger ON public.calendar_events;
CREATE TRIGGER events_sync_notification_trigger
AFTER INSERT OR UPDATE OF status, start_date, participants ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.trg_events_sync_notification();
CREATE TRIGGER events_sync_notification_delete_trigger
BEFORE DELETE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.trg_events_sync_notification();

-- 4.3 FINANCIAL TRANSACTIONS
CREATE OR REPLACE FUNCTION public.trg_finance_sync_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type TEXT;
    v_user_record RECORD;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_event_type := CASE WHEN OLD.type = 'expense' THEN 'payable_due' ELSE 'receivable_due' END;
        FOR v_user_record IN SELECT id FROM public.profiles WHERE company_id = OLD.company_id LOOP
            PERFORM public.fn_sync_scheduled_notification(OLD.company_id, v_user_record.id, OLD.id, v_event_type, 'finance', OLD.date, FALSE);
        END LOOP;
        RETURN OLD;
    END IF;

    IF NEW.date IS NOT NULL THEN
        v_event_type := CASE WHEN NEW.type = 'expense' THEN 'payable_due' ELSE 'receivable_due' END;
        FOR v_user_record IN SELECT id FROM public.profiles WHERE company_id = NEW.company_id LOOP
            PERFORM public.fn_sync_scheduled_notification(
                NEW.company_id, 
                v_user_record.id, 
                NEW.id, 
                v_event_type, 
                'finance', 
                NEW.date, 
                NEW.is_paid = FALSE
            );
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_sync_notification_trigger ON public.financial_transactions;
CREATE TRIGGER finance_sync_notification_trigger
AFTER INSERT OR UPDATE OF is_paid, date ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_finance_sync_notification();
CREATE TRIGGER finance_sync_notification_delete_trigger
BEFORE DELETE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_finance_sync_notification();


-- 4.4 USER PREFERENCES (Quando a preferência muda, precisamos recalcular os agendamentos pendentes daquele módulo)
CREATE OR REPLACE FUNCTION public.trg_preferences_sync_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizamos o target_time de todas as notificações pendentes afetadas
    -- O cálculo se baseia na tabela principal, o que exige joins dinâmicos.
    -- Como são tabelas separadas, faremos 3 updates específicos baseados no event_type
    
    IF NEW.event_type = 'task_deadline' THEN
        UPDATE public.scheduled_notifications sn
        SET target_time = t.due_date - (NEW.notify_before_minutes || ' minutes')::interval,
            updated_at = NOW(),
            status = CASE WHEN NEW.notify_before_minutes < 0 THEN 'cancelled' ELSE 'pending' END
        FROM public.tasks t
        WHERE sn.reference_id = t.id 
          AND sn.user_id = NEW.user_id 
          AND sn.notification_type = 'task_deadline'
          AND sn.status IN ('pending', 'failed', 'cancelled');
          
    ELSIF NEW.event_type = 'event_start' THEN
        UPDATE public.scheduled_notifications sn
        SET target_time = c.start_date - (NEW.notify_before_minutes || ' minutes')::interval,
            updated_at = NOW(),
            status = CASE WHEN NEW.notify_before_minutes < 0 THEN 'cancelled' ELSE 'pending' END
        FROM public.calendar_events c
        WHERE sn.reference_id = c.id 
          AND sn.user_id = NEW.user_id 
          AND sn.notification_type = 'event_start'
          AND sn.status IN ('pending', 'failed', 'cancelled');
          
    ELSIF NEW.event_type IN ('payable_due', 'receivable_due') THEN
        UPDATE public.scheduled_notifications sn
        SET target_time = f.date - (NEW.notify_before_minutes || ' minutes')::interval,
            updated_at = NOW(),
            status = CASE WHEN NEW.notify_before_minutes < 0 THEN 'cancelled' ELSE 'pending' END
        FROM public.financial_transactions f
        WHERE sn.reference_id = f.id 
          AND sn.user_id = NEW.user_id 
          AND sn.notification_type = NEW.event_type
          AND sn.status IN ('pending', 'failed', 'cancelled');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prefs_sync_notification_trigger ON public.user_notification_preferences;
CREATE TRIGGER prefs_sync_notification_trigger
AFTER INSERT OR UPDATE OF notify_before_minutes ON public.user_notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.trg_preferences_sync_notification();

-- 5. RPC para o Worker (Dequeue Seguro com SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.dequeue_scheduled_notifications(p_batch_size INT DEFAULT 50)
RETURNS SETOF public.scheduled_notifications AS $$
BEGIN
    -- Primeiro, limpa os travados (processing a mais de 5 minutos)
    UPDATE public.scheduled_notifications
    SET status = 'pending', updated_at = NOW()
    WHERE status = 'processing' 
      AND updated_at < NOW() - INTERVAL '5 minutes';

    -- Agora, pega o próximo lote, marca como processing e retorna
    RETURN QUERY
    WITH batch AS (
        SELECT id 
        FROM public.scheduled_notifications
        WHERE status = 'pending' 
          AND target_time <= NOW()
        ORDER BY target_time ASC
        FOR UPDATE SKIP LOCKED
        LIMIT p_batch_size
    )
    UPDATE public.scheduled_notifications sn
    SET status = 'processing', updated_at = NOW()
    FROM batch
    WHERE sn.id = batch.id
    RETURNING sn.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
