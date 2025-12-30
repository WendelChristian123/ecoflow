
-- ==============================================================================
-- MIGRATION: DASHBOARD METRICS RPC
-- DESCRIPTION: Aggregates dashboard stats on the server side for performance.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER -- Respects RLS of the caller
AS $$
DECLARE
    v_tenant_id uuid;
    
    -- Tasks
    v_tasks_total int;
    v_tasks_pending int;
    v_tasks_completed int;
    v_tasks_urgent int;
    
    -- Quotes
    v_quotes_total int;
    v_quotes_pending int;
    v_quotes_approved int;
    v_quotes_value numeric;
    
    -- Finance
    v_balance numeric;
    v_overdue_bills numeric;
    v_due_7_days numeric;
    v_receivables numeric;
    v_receivables_7_days numeric;
    v_receivables_overdue numeric;
    
    -- Agenda
    v_agenda_today int;
    v_agenda_7_days int;
    v_agenda_overdue int;
    
    v_now timestamptz := now();
    v_today date := CURRENT_DATE;
    v_next_7_date date := CURRENT_DATE + 7;
BEGIN
    -- Get current tenant context (handled by RLS automatically if using SECURITY INVOKER, 
    -- but for explicit queries we trust the policies)
    
    -- 1. Tasks Counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'todo'),
        COUNT(*) FILTER (WHERE status = 'done'),
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status != 'done')
    INTO 
        v_tasks_total,
        v_tasks_pending,
        v_tasks_completed,
        v_tasks_urgent
    FROM public.tasks;

    -- 2. Commercial / Quotes
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'sent' OR status = 'draft'),
        COUNT(*) FILTER (WHERE status = 'approved'),
        COALESCE(SUM(total_value) FILTER (WHERE status = 'approved'), 0)
    INTO
        v_quotes_total,
        v_quotes_pending,
        v_quotes_approved,
        v_quotes_value
    FROM public.quotes;

    -- 3. Finance
    -- Balance: Income - Expense
    -- Overdue Bills: Type=expense, IsPaid=false, Date < Today
    SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND is_paid = false AND date < v_now), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense' AND is_paid = false AND date >= v_now AND date <= v_now + interval '7 days'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND is_paid = false), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND is_paid = false AND date >= v_now AND date <= v_now + interval '7 days'), 0),
        COALESCE(SUM(amount) FILTER (WHERE type = 'income' AND is_paid = false AND date < v_now), 0)
    INTO
        v_balance,
        v_overdue_bills,
        v_due_7_days,
        v_receivables,
        v_receivables_7_days,
        v_receivables_overdue
    FROM public.financial_transactions;

    -- 4. Agenda (Simplification: using basic date comparison)
    SELECT
        COUNT(*) FILTER (WHERE start_date::date = v_today),
        COUNT(*) FILTER (WHERE start_date::date > v_today AND start_date::date <= v_next_7_date),
        COUNT(*) FILTER (WHERE end_date < v_now AND status != 'completed')
    INTO
        v_agenda_today,
        v_agenda_7_days,
        v_agenda_overdue
    FROM public.calendar_events;

    -- Return JSON matching frontend structure
    RETURN json_build_object(
        'tasks', json_build_object(
            'total', COALESCE(v_tasks_total, 0),
            'pending', COALESCE(v_tasks_pending, 0),
            'completed', COALESCE(v_tasks_completed, 0),
            'urgent', COALESCE(v_tasks_urgent, 0)
        ),
        'agenda', json_build_object(
            'today', COALESCE(v_agenda_today, 0),
            'next7Days', COALESCE(v_agenda_7_days, 0),
            'overdue', COALESCE(v_agenda_overdue, 0)
        ),
        'commercial', json_build_object(
            'totalQuotes', COALESCE(v_quotes_total, 0),
            'pendingQuotes', COALESCE(v_quotes_pending, 0),
            'approvedQuotes', COALESCE(v_quotes_approved, 0),
            'convertedValue', COALESCE(v_quotes_value, 0)
        ),
        'financial', json_build_object(
            'balance', COALESCE(v_balance, 0),
            'overdueBills', COALESCE(v_overdue_bills, 0),
            'dueIn7Days', COALESCE(v_due_7_days, 0),
            'receivables', COALESCE(v_receivables, 0),
            'receivablesIn7Days', COALESCE(v_receivables_7_days, 0),
            'overdueReceivables', COALESCE(v_receivables_overdue, 0)
        )
    );
END;
$$;
