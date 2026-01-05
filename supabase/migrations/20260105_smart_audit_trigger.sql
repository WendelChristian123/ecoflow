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
    v_delegate_name text;
BEGIN
    -- 1. Identify User
    v_user_id := auth.uid();
    SELECT name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
    IF v_user_name IS NULL THEN v_user_name := 'Usuário Desconhecido'; END IF;

    -- 2. Identify Tenant & Data Snapshots
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := null;
        v_description := 'Registro excluído';
    ELSIF TG_OP = 'UPDATE' THEN
        v_tenant_id := NEW.tenant_id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_description := 'Registro atualizado';
    ELSIF TG_OP = 'INSERT' THEN
        v_tenant_id := NEW.tenant_id;
        v_old_data := null;
        v_new_data := to_jsonb(NEW);
        v_description := 'Novo registro criado';
    END IF;

    -- 3. Smart Descriptions (Business Logic)
    
    -- --- MODULE: FINANCEIRO ---
    IF TG_TABLE_NAME = 'financial_transactions' THEN
        v_record_name := COALESCE(NEW.description, OLD.description, 'Lançamento');
        
        IF TG_OP = 'INSERT' THEN
             v_description := 'Criou o lançamento "' || v_record_name || '" no valor de ' || NEW.amount;
        ELSIF TG_OP = 'UPDATE' THEN
             v_description := 'Atualizou o lançamento "' || v_record_name || '"';
             
             IF OLD.amount != NEW.amount THEN
                v_description := 'Alterou valor de ' || OLD.amount || ' para ' || NEW.amount || ' em "' || v_record_name || '"';
             END IF;
             
             IF OLD.is_paid = false AND NEW.is_paid = true THEN
                v_description := 'Marcou como pago: "' || v_record_name || '"';
             END IF;
        ELSIF TG_OP = 'DELETE' THEN
             v_description := 'Excluiu o lançamento "' || v_record_name || '"';
        END IF;

    -- --- MODULE: TAREFAS ---
    ELSIF TG_TABLE_NAME = 'tasks' THEN
        v_record_name := COALESCE(NEW.title, OLD.title, 'Tarefa');

        IF TG_OP = 'INSERT' THEN
             v_description := 'Criou a tarefa "' || v_record_name || '"';
        ELSIF TG_OP = 'UPDATE' THEN
             IF OLD.status != 'done' AND NEW.status = 'done' THEN
                 v_description := 'Concluiu a tarefa "' || v_record_name || '"';
             ELSIF OLD.status = 'done' AND NEW.status != 'done' THEN
                 v_description := 'Reabriu a tarefa "' || v_record_name || '"';
             ELSE
                 v_description := 'Editou a tarefa "' || v_record_name || '"';
             END IF;
             
             IF OLD.assignee_id IS DISTINCT FROM NEW.assignee_id THEN
                 v_description := 'Alterou o responsável da tarefa "' || v_record_name || '"';
             END IF;
        ELSIF TG_OP = 'DELETE' THEN
             v_description := 'Excluiu a tarefa "' || v_record_name || '"';
        END IF;

    -- --- MODULE: AGENDA ---
    ELSIF TG_TABLE_NAME = 'calendar_events' THEN
        v_record_name := COALESCE(NEW.title, OLD.title, 'Evento');

        IF TG_OP = 'INSERT' THEN
             v_description := 'Agendou "' || v_record_name || '"';
        ELSIF TG_OP = 'UPDATE' THEN
             IF OLD.start_date != NEW.start_date THEN
                 v_description := 'Reagendou "' || v_record_name || '"';
             ELSE
                 v_description := 'Editou detalhes de "' || v_record_name || '"';
             END IF;
        ELSIF TG_OP = 'DELETE' THEN
             v_description := 'Cancelou/Excluiu "' || v_record_name || '"';
        END IF;

    -- --- MODULE: EQUIPE/USUÁRIOS ---
    ELSIF TG_TABLE_NAME = 'profiles' THEN
        SELECT name INTO v_record_name FROM public.profiles WHERE id = COALESCE(NEW.id, OLD.id);
        
        IF TG_OP = 'UPDATE' THEN
            IF OLD.permissions IS DISTINCT FROM NEW.permissions THEN
                v_description := 'Alterou permissões do usuário ' || v_record_name;
            ELSE
                v_description := 'Atualizou perfil de ' || v_record_name;
            END IF;
        END IF;

    -- --- MODULE: DELEGAÇÕES ---
    ELSIF TG_TABLE_NAME = 'delegations' THEN
        SELECT name INTO v_delegate_name FROM public.profiles WHERE id = COALESCE(NEW.delegate_id, OLD.delegate_id);
        IF v_delegate_name IS NULL THEN v_delegate_name := 'Usuário'; END IF;

        IF TG_OP = 'INSERT' THEN
             v_description := 'Concedeu acesso ao módulo ' || NEW.module || ' para ' || v_delegate_name;
        ELSIF TG_OP = 'DELETE' THEN
             v_description := 'Revogou acesso do módulo ' || OLD.module || ' de ' || v_delegate_name;
        ELSIF TG_OP = 'UPDATE' THEN
             v_description := 'Alterou permissões de acesso do módulo ' || NEW.module || ' para ' || v_delegate_name;
        END IF;
    END IF;

    -- Append "por [User]" style if needed, but UI usually has a User Column.
    v_description := v_description || ' por ' || v_user_name;

    -- Insert Log
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

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
