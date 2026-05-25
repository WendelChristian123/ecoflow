import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('./.env.local') });

(global as any).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY
    }
  }
};

import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

async function testCheckout() {
    console.log("==========================================");
    console.log(" CHECKOUT & ASAAS INTEGRATION TEST ");
    console.log("==========================================");

    const testEmail = `buyer_${Date.now()}@ecoflow.com`;
    const testPassword = "BuyerPassword123!";
    
    console.log(`\n[AUTH] Criando conta de usuário...`);
    try {
        await supabase.auth.signUp({
            email: testEmail,
            password: testPassword
        });
        
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: testEmail,
            password: testPassword
        });

        if (authErr || !authData.user) {
            throw new Error(`Auth failed: ${authErr?.message}`);
        }
        console.log(`✅ Logado com sucesso. User ID: ${authData.user.id}`);
    } catch (e: any) {
        console.log(`❌ Falha no login/cadastro: ${e.message}`);
        return;
    }

    console.log(`\n[PLAN] Buscando Planos Públicos (saas_plans)...`);
    const plans = await api.getPublicPlans();
    if (plans.length === 0) {
        console.log(`❌ Nenhum plano público encontrado. Você precisa criar um plano no Super Admin primeiro.`);
        return;
    }

    const planToBuy = plans[0];
    console.log(`✅ Plano selecionado: ${planToBuy.name} (ID: ${planToBuy.id}, Mensal: R$ ${planToBuy.priceMonthly})`);

    console.log(`\n[CHECKOUT] Iniciando assinatura via PIX...`);
    const payload = {
        company: {
            name: 'Empresa Teste Checkout',
            cnpj: '00000000000191',
            phone: '11999999999',
            email: testEmail
        },
        address: {
            postal_code: '01001000',
            address: 'Praça da Sé',
            address_number: '1',
            complement: '',
            province: 'Sé',
            city: 'São Paulo',
            state: 'SP'
        },
        plan_id: planToBuy.id,
        cycle: 'monthly',
        billing_type: 'pix' as 'pix'
    };

    try {
        const response = await api.subscribe(payload);
        console.log(`✅ Sucesso! Resposta do Asaas Checkout:`);
        console.log(response);

        if (response.pix) {
            console.log(`✅ QR Code do PIX retornado com sucesso!`);
        } else {
            console.log(`⚠️ PIX QR Code não retornado.`);
        }
    } catch (e: any) {
        console.error("❌ Erro no Checkout:");
        console.error(e);
        console.log("\n⚠️ NOTA: Se você recebeu um erro de 'Edge Function', certifique-se de que fez o deploy das functions para a nuvem rodando: npx supabase functions deploy");
    }

    process.exit(0);
}

testCheckout();
