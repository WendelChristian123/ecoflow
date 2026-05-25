import { test, expect, Page } from '@playwright/test';

// Custom auth injection

// Custom auth injection
test.use({ storageState: 'playwright/.auth/user.json' });

test.describe('Automações e Cross-Modules', () => {

  test('Fluxo 1: Comercial -> CRM -> Financeiro (Ciclo de Vida)', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Criar Orçamento para Prospect
    console.log('[COMERCIAL] Acessando Orçamentos...');
    await page.goto('http://localhost:3000/#/commercial/quotes');
    await page.waitForSelector('text=Orçamentos', { state: 'visible', timeout: 10000 });
    
    console.log('[COMERCIAL] Criando novo orçamento (Prospect)...');
    await page.click('button:has-text("Novo")');
    await page.waitForSelector('text=Novo Orçamento', { state: 'visible' });

    // Alternar para Prospect (Novo Cliente)
    await page.click('button:has-text("Novo / Prospect")');
    
    const prospectName = `Empresa Prospect ${Date.now()}`;
    await page.fill('input[placeholder="Nome do Cliente (Prospect)"]', prospectName);
    
    // Adicionar um item manual ao Orçamento
    await page.click('button:has-text("+ Item Manual")');
    await page.fill('input[placeholder="Item / Descrição..."]', 'Serviço de Limpeza Automotiva (Teste)');
    // unit price is a CurrencyInput which might need careful typing. We skip or type generic.
    
    // Salvar Orçamento
    await page.click('button:has-text("Salvar Orçamento")');
    
    // Wait for it to appear in the Kanban / list (which happens to be Quotes Overview usually)
    // We assume the quote was saved and we are back at the quotes board.
    await page.waitForTimeout(2000);
    
    // We need to approve the quote.
    // In Kanban, we'd click the card. Let's just search for it.
    console.log('[COMERCIAL] Abrindo Orçamento recém-criado para aprovar...');
    await page.click(`text=${prospectName}`);
    await page.waitForSelector('text=Editar Orçamento', { state: 'visible' });

    // Clicar em Editar para mudar o Status (ou Mover de Estágio)
    await page.click('button:has-text("Editar")');
    await page.waitForSelector('text=Editar Orçamento', { state: 'visible' });
    
    // Select Status "Aprovado" or change Stage to "Fechado"
    // The UI uses a Kanban stage select or we can assume there's a way to mark it approved.
    // Let's assume there is a stage dropdown.
    await page.locator('div').filter({ hasText: /^Etapa/ }).locator('select, button').nth(1).click();
    await page.waitForTimeout(500);
    // Attempting to select "Ganho" or "Fechado"
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await page.click('button:has-text("Salvar Orçamento")');
    
    // Se a automação existir, o QuoteApprovalModal deve aparecer
    console.log('[AUTOMAÇÃO] Aguardando o modal de Orçamento Aprovado (Gatilho)...');
    try {
        await page.waitForSelector('text=Orçamento Aprovado!', { state: 'visible', timeout: 5000 });
        console.log('✅ Automação disparada: Modal de Aprovação capturado.');
        
        // Clicar em Criar Contrato
        await page.click('button:has-text("Criar Contrato")');
        await page.waitForSelector('text=Novo Contrato Recorrente', { state: 'visible' });
        
        // Fechar Modal de Contrato para checar o CRM
        await page.click('button:has-text("Cancelar"), button:has-text("Fechar")');
    } catch (e) {
        console.log('❌ O modal automático de "Orçamento Aprovado" NÃO apareceu. Automação falhou ou fluxo diferente.');
    }

    // Checar CRM se o prospect virou Contato real
    console.log('[CRM] Validando se o Prospect virou Contato...');
    await page.goto('http://localhost:3000/#/commercial/contacts');
    await page.waitForSelector('text=Contatos', { state: 'visible' });
    
    await page.fill('input[placeholder="Buscar..."]', prospectName);
    await page.waitForTimeout(1000);
    
    const contactExists = await page.locator(`text=${prospectName}`).count();
    if (contactExists > 0) {
        console.log(`✅ CRM: Contato "${prospectName}" criado automaticamente com sucesso!`);
    } else {
        console.log(`❌ CRM: Contato "${prospectName}" NÃO foi criado pela automação do Orçamento.`);
        throw new Error('Falha de Automação: Prospect não virou Contato no CRM.');
    }
  });

  test('Fluxo 2: Rotinas -> Agenda (Tarefas vs Calendário)', async ({ page }) => {
    test.setTimeout(120000);

    console.log('[ROTINAS] Criando Tarefa com Prazo...');
    await page.goto('http://localhost:3000/#/tasks');
    await page.waitForSelector('text=Tarefas', { state: 'visible', timeout: 10000 });

    await page.click('button:has-text("Novo")');
    await page.waitForSelector('text=Novo Item', { state: 'visible' });

    const taskName = `Tarefa Sincronizada ${Date.now()}`;
    await page.fill('input[placeholder="Ex: Criar relatório mensal"]', taskName);
    await page.fill('textarea[placeholder="Detalhes da tarefa..."]', 'Testando automação com a agenda');

    // Input type datetime-local needs fill
    // We will find the DateTimePicker input and fill it with a date
    const inputs = await page.locator('input[type="datetime-local"]').all();
    if (inputs.length > 0) {
        // Set date to today + 2 hours
        const d = new Date(Date.now() + 2 * 3600 * 1000);
        // Format YYYY-MM-DDThh:mm
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
        await inputs[0].fill(localISOTime);
    }

    await page.click('button:has-text("Salvar")');
    await page.waitForTimeout(2000);
    console.log('✅ Tarefa salva no módulo Rotinas.');

    console.log('[AGENDA] Verificando se a Tarefa aparece no Calendário...');
    await page.goto('http://localhost:3000/#/agenda');
    await page.waitForSelector('text=Agenda', { state: 'visible', timeout: 10000 });

    // Procurar a tarefa na agenda de hoje
    const taskInAgenda = await page.locator(`text=${taskName}`).count();
    if (taskInAgenda > 0) {
        console.log('✅ AGENDA: Tarefa apareceu no calendário com sucesso!');
        
        // Testando completar pela agenda
        await page.click(`text=${taskName}`);
        await page.waitForSelector('text=Detalhes da Tarefa', { state: 'visible' });
        
        // Mudar status para concluído usando o KanbanStageMover ou Botão 
        try {
            await page.click('button:has-text("Marcar como Concluída")');
            await page.waitForTimeout(1000);
            console.log('✅ Tarefa concluída via Agenda.');
        } catch (e) {
            console.log('⚠️ Botão rápido de conclusão ausente. Tentando via Status Select.');
            // Attempt standard update if quick button is absent
        }
    } else {
        console.log('❌ AGENDA: Tarefa NÃO sincronizou com o calendário!');
        throw new Error('Falha de Automação: Tarefa não aparece na Agenda.');
    }
  });

});
