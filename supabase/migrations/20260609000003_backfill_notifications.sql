-- ==========================================================
-- SCRIPT DE SINCRONIZAÇÃO EM MASSA (RETROATIVO)
-- ==========================================================
-- Esse script vai ler TODAS as tarefas, eventos, orçamentos
-- e lançamentos financeiros que já existem no banco e vai
-- criar os lembretes na fila de notificações para eles.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Sincronizar Tarefas Existentes
    FOR r IN SELECT * FROM public.tasks WHERE status != 'done' LOOP
        IF r.due_date IS NOT NULL AND r.assignee_id IS NOT NULL THEN
            PERFORM public.fn_sync_scheduled_notification(
                r.company_id, r.assignee_id, r.id, 'task_deadline', 'tasks', r.due_date, true
            );
        END IF;
    END LOOP;

    -- 2. Sincronizar Eventos Existentes
    FOR r IN SELECT * FROM public.calendar_events WHERE status NOT IN ('completed', 'cancelled') LOOP
        IF r.start_date IS NOT NULL AND r.participants IS NOT NULL THEN
            -- Sincroniza para cada participante
            DECLARE attendee_id UUID;
            BEGIN
                -- Verifica se participants é array do tipo uuid[] (nativo do Postgres) ou jsonb
                -- Assumindo que no trigger estava usando "FOREACH participant_id IN ARRAY NEW.participants", é um ARRAY
                FOREACH attendee_id IN ARRAY (r.participants)::UUID[] LOOP
                    PERFORM public.fn_sync_scheduled_notification(
                        r.company_id, attendee_id, r.id, 'event_start', 'agenda', r.start_date, true
                    );
                END LOOP;
            END;
        END IF;
    END LOOP;

    -- 3. Sincronizar Financeiro Existente
    FOR r IN SELECT * FROM public.financial_transactions WHERE is_paid = false LOOP
        IF r.date IS NOT NULL THEN
            PERFORM public.fn_distribute_scheduled_notification(
                r.company_id, r.id, CASE WHEN r.type = 'expense' THEN 'payable_due' ELSE 'receivable_due' END, 'finance', r.date, true
            );
        END IF;
    END LOOP;

    -- 4. Sincronizar Orçamentos Existentes
    FOR r IN SELECT * FROM public.quotes WHERE status NOT IN ('approved', 'rejected') LOOP
        IF r.valid_until IS NOT NULL THEN
            PERFORM public.fn_distribute_scheduled_notification(
                r.company_id, r.id, 'quote_expiration', 'commercial', r.valid_until, true
            );
        END IF;
    END LOOP;
END;
$$;
