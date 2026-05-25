import { processTransactions } from '../../services/financeLogic';
import { FinancialTransaction, CreditCard } from '../../types';
import { parseISO, addDays, format } from 'date-fns';

const runTest = () => {
    console.log("==========================================");
    console.log(" TESTE DE REGIMES DO CARTÃO DE CRÉDITO ");
    console.log("==========================================");

    // Mocks
    const myCard: CreditCard = {
        id: 'card-1',
        name: 'Cartão Black',
        limitAmount: 5000,
        closingDay: 10,
        dueDay: 15,
        companyId: 'company-1'
    };

    const txs: FinancialTransaction[] = [
        // Compra ANTES do fechamento (Dia 05). Deve cair na fatura do mês atual (Vencimento dia 15 do mesmo mês)
        {
            id: 'tx-1',
            description: 'Compra Mercado',
            amount: 150,
            type: 'expense',
            date: '2025-05-05T12:00:00Z', // Maio 05
            isPaid: true, // Já descontado do limite
            creditCardId: 'card-1',
            accountId: 'acc-1',
            categoryId: 'cat-1',
            companyId: 'company-1',
            links: []
        },
        // Compra DEPOIS do fechamento (Dia 11). Deve cair na fatura do mês seguinte (Vencimento Junho 15)
        {
            id: 'tx-2',
            description: 'Assinatura Software',
            amount: 300,
            type: 'expense',
            date: '2025-05-11T12:00:00Z', // Maio 11
            isPaid: true,
            creditCardId: 'card-1',
            accountId: 'acc-1',
            categoryId: 'cat-1',
            companyId: 'company-1',
            links: []
        },
        // Pagamento da fatura (Entrada no cartão). Digamos que pagamos 150 no dia 14 de Maio.
        {
            id: 'tx-payment',
            description: 'Pagamento Fatura',
            amount: 150,
            type: 'income',
            date: '2025-05-14T12:00:00Z',
            isPaid: true,
            creditCardId: 'card-1',
            accountId: 'acc-1',
            categoryId: 'cat-1',
            companyId: 'company-1',
            links: []
        }
    ];

    console.log("\n--- TESTE 1: MODO COMPETÊNCIA (COMPRA) ---");
    const competenceResult = processTransactions(txs, [myCard], 'competence');
    console.log(`Lançamentos Retornados: ${competenceResult.length} (Esperado: 3)`);
    competenceResult.forEach(t => {
        console.log(`- [${t.date.split('T')[0]}] ${t.description}: R$ ${t.amount} (Virtual: ${t.isVirtual})`);
    });
    
    let passed1 = competenceResult.length === 3 && competenceResult.every(t => !t.isVirtual);
    console.log(passed1 ? "✅ SUCESSO: Modo competência retorna os lançamentos originais intactos." : "❌ FALHA no Modo Competência");

    console.log("\n--- TESTE 2: MODO CAIXA (PAGAMENTO) ---");
    const cashResult = processTransactions(txs, [myCard], 'cash');
    console.log(`Lançamentos Retornados: ${cashResult.length}`);
    cashResult.forEach(t => {
        console.log(`- [${t.date.split('T')[0]}] ${t.description}: R$ ${t.amount} (Virtual: ${t.isVirtual})`);
        if (t.isVirtual && t.virtualChildren) {
             console.log(`    -> Itens da fatura: ${t.virtualChildren.map(c => c.description).join(', ')}`);
        }
    });

    // Verificações do Modo Caixa:
    // 1. Deve haver uma Fatura Virtual para a compra de Maio (vencimento Maio 15) -> Valor restante deve ser 0 pois pagamos 150.
    // 2. Deve haver uma Fatura Virtual para a compra de Junho (vencimento Junho 15) -> Valor restante 300.
    // MAS ESPERA: a fatura que zerou (restante < 0.01) não deve ser retornada no array!
    const faturaMaio = cashResult.find(t => t.date.startsWith('2025-05-15'));
    const faturaJunho = cashResult.find(t => t.date.startsWith('2025-06-15'));

    let passed2 = true;
    if (faturaMaio) {
        console.log("❌ FALHA: Fatura de Maio deveria ter sido abatida pelo Pagamento e não aparecer como virtual invoice a pagar.");
        passed2 = false;
    } else {
        console.log("✅ SUCESSO: Fatura de Maio abatida corretamente pelo pagamento.");
    }

    if (faturaJunho && faturaJunho.amount === 300) {
        console.log("✅ SUCESSO: Fatura de Junho gerada com valor correto de R$ 300,00.");
    } else {
        console.log("❌ FALHA: Fatura de Junho ausente ou com valor incorreto.");
        passed2 = false;
    }

    if (passed1 && passed2) {
        console.log("\n🚀 TODOS OS TESTES DOS REGIMES PASSARAM COM SUCESSO!");
    } else {
        console.log("\n⚠️ ALGUNS TESTES FALHARAM.");
    }
};

runTest();
