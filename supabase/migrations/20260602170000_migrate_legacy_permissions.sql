-- Migração das permissões antigas do campo JSONB para a nova tabela `user_permissions`

DO $$
DECLARE
    r_user RECORD;
    perm_key TEXT;
    perm_value JSONB;
    v_view BOOLEAN;
    v_create BOOLEAN;
    v_edit BOOLEAN;
    v_delete BOOLEAN;
BEGIN
    -- Percorre todos os usuários que não são super_admin e possuem algo no campo permissions e tem um company_id
    FOR r_user IN 
        SELECT id, company_id, permissions 
        FROM profiles 
        WHERE role != 'super_admin' 
          AND permissions IS NOT NULL 
          AND company_id IS NOT NULL
          AND jsonb_typeof(permissions) = 'object'
    LOOP
        -- Para cada chave dentro do JSON de permissões (ex: "routines", "finance")
        FOR perm_key, perm_value IN SELECT * FROM jsonb_each(r_user.permissions)
        LOOP
            -- Extrai os booleanos, lidando com nulos
            v_view := COALESCE((perm_value->>'view')::BOOLEAN, false);
            v_create := COALESCE((perm_value->>'create')::BOOLEAN, false);
            v_edit := COALESCE((perm_value->>'edit')::BOOLEAN, false);
            -- Legado geralmente não tinha delete, mas garantimos false
            v_delete := COALESCE((perm_value->>'delete')::BOOLEAN, false);

            -- Mapeia a chave do JSON legado para o ID de módulo atual
            DECLARE
                mapped_module_id TEXT;
            BEGIN
                mapped_module_id := CASE perm_key
                    WHEN 'routines' THEN 'mod_tasks'
                    WHEN 'finance' THEN 'mod_finance'
                    WHEN 'commercial' THEN 'mod_commercial'
                    WHEN 'reports' THEN 'mod_reports'
                    ELSE NULL
                END;

                -- Só insere na nova tabela se o usuário tiver pelo menos permissão de "view" e o módulo for válido
                IF v_view AND mapped_module_id IS NOT NULL THEN
                    -- Insere uma permissão para cada feature granular daquele módulo
                    INSERT INTO user_permissions (
                        user_id, 
                        company_id, 
                        feature_id, 
                        actions,
                        created_at
                    ) 
                    SELECT 
                        r_user.id,
                        r_user.company_id,
                        af.id,
                        jsonb_build_object(
                            'view', v_view,
                            'create', v_create,
                            'edit', v_edit,
                            'delete', v_delete
                        ),
                        NOW()
                    FROM app_features af
                    WHERE af.module_id = mapped_module_id
                      AND NOT EXISTS (
                          SELECT 1 FROM user_permissions up
                          WHERE up.user_id = r_user.id 
                            AND up.company_id = r_user.company_id 
                            AND up.feature_id = af.id
                      );
                END IF;
            END;
        END LOOP;
    END LOOP;
END $$;
