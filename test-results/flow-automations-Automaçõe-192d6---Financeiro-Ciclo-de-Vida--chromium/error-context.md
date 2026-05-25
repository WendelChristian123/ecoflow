# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flow-automations.spec.ts >> Automações e Cross-Modules >> Fluxo 1: Comercial -> CRM -> Financeiro (Ciclo de Vida)
- Location: tests\e2e\flow-automations.spec.ts:10:3

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('text=Detalhes do Orçamento') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]:
          - img [ref=e9]
          - generic [ref=e14]: Contazze
        - button [ref=e15] [cursor=pointer]:
          - img [ref=e16]
      - generic [ref=e19]:
        - link "Painel Principal" [ref=e20] [cursor=pointer]:
          - /url: "#/dashboard"
          - img [ref=e22]
          - generic [ref=e27]: Painel Principal
        - generic [ref=e29]:
          - button "Comercial" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]:
              - img [ref=e33]
              - generic [ref=e36]: Comercial
            - img [ref=e38]
          - generic:
            - link "Visão Geral" [ref=e40] [cursor=pointer]:
              - /url: "#/commercial/overview"
              - img [ref=e42]
              - generic [ref=e45]: Visão Geral
            - link "Contatos" [ref=e46] [cursor=pointer]:
              - /url: "#/commercial/contacts"
              - img [ref=e48]
              - generic [ref=e53]: Contatos
            - link "Orçamentos" [ref=e54] [cursor=pointer]:
              - /url: "#/commercial/quotes"
              - img [ref=e56]
              - generic [ref=e59]: Orçamentos
            - link "Contratos" [ref=e60] [cursor=pointer]:
              - /url: "#/commercial/recurring"
              - img [ref=e62]
              - generic [ref=e67]: Contratos
            - link "Catálogo" [ref=e68] [cursor=pointer]:
              - /url: "#/commercial/catalog"
              - img [ref=e70]
              - generic [ref=e73]: Catálogo
        - generic [ref=e74]:
          - button "Rotinas & Execução" [ref=e75] [cursor=pointer]:
            - generic [ref=e76]:
              - img [ref=e78]
              - generic [ref=e81]: Rotinas & Execução
            - img [ref=e83]
          - generic:
            - link "Visão Geral" [ref=e85] [cursor=pointer]:
              - /url: "#/routines/overview"
              - img [ref=e87]
              - generic [ref=e88]: Visão Geral
            - link "Tarefas" [ref=e89] [cursor=pointer]:
              - /url: "#/tasks"
              - img [ref=e91]
              - generic [ref=e94]: Tarefas
            - link "Projetos" [ref=e95] [cursor=pointer]:
              - /url: "#/projects"
              - img [ref=e97]
              - generic [ref=e100]: Projetos
            - link "Equipes" [ref=e101] [cursor=pointer]:
              - /url: "#/teams"
              - img [ref=e103]
              - generic [ref=e108]: Equipes
            - link "Agenda" [ref=e109] [cursor=pointer]:
              - /url: "#/agenda"
              - img [ref=e111]
              - generic [ref=e113]: Agenda
        - generic [ref=e114]:
          - button "Financeiro" [ref=e115] [cursor=pointer]:
            - generic [ref=e116]:
              - img [ref=e118]
              - generic [ref=e120]: Financeiro
            - img [ref=e122]
          - generic:
            - link "Visão Geral" [ref=e124] [cursor=pointer]:
              - /url: "#/finance/overview"
              - img [ref=e126]
              - generic [ref=e129]: Visão Geral
            - link "Lançamentos" [ref=e130] [cursor=pointer]:
              - /url: "#/finance/transactions"
              - img [ref=e132]
              - generic [ref=e135]: Lançamentos
            - link "Contas & Bancos" [ref=e136] [cursor=pointer]:
              - /url: "#/finance/accounts"
              - img [ref=e138]
              - generic [ref=e141]: Contas & Bancos
            - link "Categorias" [ref=e142] [cursor=pointer]:
              - /url: "#/finance/categories"
              - img [ref=e144]
              - generic [ref=e148]: Categorias
            - link "Cartões" [ref=e149] [cursor=pointer]:
              - /url: "#/finance/cards"
              - img [ref=e151]
              - generic [ref=e153]: Cartões
            - link "Dívidas e Empréstimos" [ref=e154] [cursor=pointer]:
              - /url: "#/finance/loans"
              - img [ref=e156]
              - generic [ref=e158]: Dívidas e Empréstimos
      - link "Configurações" [ref=e160] [cursor=pointer]:
        - /url: "#/settings"
        - img [ref=e162]
        - generic [ref=e165]: Configurações
  - main [ref=e166]:
    - generic [ref=e167]:
      - generic [ref=e168]:
        - img [ref=e170]
        - generic [ref=e173]:
          - heading "Você está no período de teste do plano Plano Personalizado" [level=3] [ref=e174]:
            - text: Você está no período de teste do plano
            - strong [ref=e175]: Plano Personalizado
          - paragraph [ref=e176]:
            - text: Restam
            - strong [ref=e177]: 7 dias
            - text: para você aproveitar todas as funcionalidades.
      - button "Assinar Agora" [ref=e178] [cursor=pointer]
    - generic [ref=e179]:
      - generic [ref=e181]:
        - heading "Gestão Comercial" [level=1] [ref=e182]
        - generic [ref=e183]: QA Auto Tester
      - generic [ref=e184]:
        - button "Notificações" [ref=e186] [cursor=pointer]:
          - img [ref=e187]
        - generic [ref=e190]:
          - button "Tema Claro" [ref=e191] [cursor=pointer]:
            - img [ref=e192]
            - generic: Tema Claro
          - button "Tema Escuro" [ref=e198] [cursor=pointer]:
            - img [ref=e199]
            - generic: Tema Escuro
          - button "Tema Sistema" [ref=e201] [cursor=pointer]:
            - img [ref=e202]
            - generic: Tema Sistema
        - button "QA Auto Tester qa_auto_1779723670270@example.com QA" [ref=e206] [cursor=pointer]:
          - generic [ref=e207]:
            - paragraph [ref=e208]: QA Auto Tester
            - paragraph [ref=e209]: qa_auto_1779723670270@example.com
          - generic "QA Auto Tester" [ref=e211]: QA
          - img [ref=e212]
    - generic [ref=e215]:
      - generic [ref=e216]:
        - generic [ref=e217]:
          - img [ref=e219]
          - textbox "Buscar..." [ref=e221]
        - button "Novo" [ref=e222] [cursor=pointer]:
          - img [ref=e223]
          - text: Novo
        - generic [ref=e224]:
          - button [ref=e225] [cursor=pointer]:
            - img [ref=e226]
          - generic [ref=e228]: mai/2026
          - button [ref=e229] [cursor=pointer]:
            - img [ref=e230]
        - button "Todos Status" [ref=e233] [cursor=pointer]:
          - generic [ref=e236]: Todos Status
          - img [ref=e237]
        - generic [ref=e239]:
          - button [ref=e240] [cursor=pointer]:
            - img [ref=e241]
          - button [ref=e242] [cursor=pointer]:
            - img [ref=e243]
      - generic [ref=e249] [cursor=pointer]:
        - generic [ref=e250]:
          - generic [ref=e251]:
            - generic [ref=e252]: CÓD
            - generic [ref=e253]: "#cafd"
          - generic [ref=e254]:
            - generic [ref=e255]:
              - generic [ref=e256]: Cliente
              - generic [ref=e257]: Convidado
            - heading "Empresa Prospect 1779723977689" [level=3] [ref=e258]
        - generic [ref=e259]:
          - generic [ref=e260]:
            - generic [ref=e261]:
              - generic [ref=e262]: Emissão
              - generic [ref=e263]:
                - img [ref=e264]
                - text: 25/05/2026
            - generic [ref=e267]:
              - generic [ref=e268]: Vencimento
              - generic [ref=e269]:
                - img [ref=e270]
                - text: "-"
          - generic [ref=e272]:
            - generic [ref=e273]:
              - generic [ref=e274]: 1 itens
              - generic [ref=e275]: R$ 0,00
            - combobox [ref=e277]:
              - option "Rascunho" [selected]
              - option "Enviado"
              - option "Aprovado"
              - option "Rejeitado"
              - option "Expirado"
        - button [ref=e279]:
          - img [ref=e280]
      - generic [ref=e285]:
        - generic [ref=e286]:
          - heading "Editar Orçamento" [level=3] [ref=e287]
          - button [ref=e288] [cursor=pointer]:
            - img [ref=e289]
        - generic [ref=e293]:
          - generic [ref=e294]:
            - generic [ref=e295]:
              - generic [ref=e296]:
                - generic [ref=e297]: Cliente
                - button "Selecionar Cadastrado" [ref=e298] [cursor=pointer]:
                  - img [ref=e299]
                  - text: Selecionar Cadastrado
              - generic [ref=e302]:
                - textbox "Nome do Cliente (Prospect)" [ref=e305]: Empresa Prospect 1779723977689
                - textbox "Telefone / Contato" [ref=e308]
            - generic [ref=e309]:
              - generic [ref=e310]:
                - generic [ref=e311]:
                  - generic [ref=e312]: Data Emissão
                  - textbox [ref=e314]: 2026-05-25
                - generic [ref=e315]:
                  - generic [ref=e316]: Validade
                  - textbox [ref=e318]
              - generic [ref=e319]:
                - generic [ref=e320]:
                  - generic [ref=e321]: Funil (Kanban)
                  - button "Selecione" [ref=e323] [cursor=pointer]:
                    - generic [ref=e325]: Selecione
                    - img [ref=e326]
                - generic [ref=e328]:
                  - generic [ref=e329]: Etapa
                  - button "Selecione..." [ref=e331] [cursor=pointer]:
                    - generic [ref=e333]: Selecione...
                    - img [ref=e334]
          - generic [ref=e336]:
            - generic [ref=e337]:
              - heading "Itens do Orçamento" [level=3] [ref=e338]
              - generic [ref=e339]:
                - button "+ Adicionar do Catálogo" [ref=e341] [cursor=pointer]:
                  - generic [ref=e344]: + Adicionar do Catálogo
                  - img [ref=e345]
                - button "+ Item Manual" [ref=e347] [cursor=pointer]
            - table [ref=e349]:
              - rowgroup [ref=e350]:
                - row "Descrição Qtd Unitário Total" [ref=e351]:
                  - columnheader "Descrição" [ref=e352]
                  - columnheader "Qtd" [ref=e353]
                  - columnheader "Unitário" [ref=e354]
                  - columnheader "Total" [ref=e355]
                  - columnheader [ref=e356]
              - rowgroup [ref=e357]:
                - row "Serviço de Limpeza Automotiva (Teste) 1 R$ 0 R$ 0,00" [ref=e358]:
                  - cell "Serviço de Limpeza Automotiva (Teste)" [ref=e359]:
                    - textbox "Item / Descrição..." [ref=e360]: Serviço de Limpeza Automotiva (Teste)
                  - cell "1" [ref=e361]:
                    - spinbutton [ref=e362]: "1"
                  - cell "R$ 0" [ref=e363]:
                    - generic [ref=e365]:
                      - generic:
                        - generic: R$
                      - textbox "0,00" [ref=e366]: "0"
                  - cell "R$ 0,00" [ref=e367]
                  - cell [ref=e368]:
                    - button [ref=e369] [cursor=pointer]:
                      - img [ref=e370]
              - rowgroup [ref=e373]:
                - row "Total Final R$ 0,00" [ref=e374]:
                  - cell "Total Final" [ref=e375]
                  - cell "R$ 0,00" [ref=e376]
                  - cell [ref=e377]
          - textbox "Termos, condições ou notas internas..." [ref=e378]
          - generic [ref=e379]:
            - button "Imprimir / PDF" [ref=e380] [cursor=pointer]:
              - img [ref=e381]
              - text: Imprimir / PDF
            - generic [ref=e385]:
              - button "Cancelar" [ref=e386] [cursor=pointer]
              - button "Salvar Orçamento" [ref=e387] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | // Custom auth injection
  4   | 
  5   | // Custom auth injection
  6   | test.use({ storageState: 'playwright/.auth/user.json' });
  7   | 
  8   | test.describe('Automações e Cross-Modules', () => {
  9   | 
  10  |   test('Fluxo 1: Comercial -> CRM -> Financeiro (Ciclo de Vida)', async ({ page }) => {
  11  |     test.setTimeout(120000);
  12  | 
  13  |     // 1. Criar Orçamento para Prospect
  14  |     console.log('[COMERCIAL] Acessando Orçamentos...');
  15  |     await page.goto('http://localhost:3000/#/commercial/quotes');
  16  |     await page.waitForSelector('text=Orçamentos', { state: 'visible', timeout: 10000 });
  17  |     
  18  |     console.log('[COMERCIAL] Criando novo orçamento (Prospect)...');
  19  |     await page.click('button:has-text("Novo")');
  20  |     await page.waitForSelector('text=Novo Orçamento', { state: 'visible' });
  21  | 
  22  |     // Alternar para Prospect (Novo Cliente)
  23  |     await page.click('button:has-text("Novo / Prospect")');
  24  |     
  25  |     const prospectName = `Empresa Prospect ${Date.now()}`;
  26  |     await page.fill('input[placeholder="Nome do Cliente (Prospect)"]', prospectName);
  27  |     
  28  |     // Adicionar um item manual ao Orçamento
  29  |     await page.click('button:has-text("+ Item Manual")');
  30  |     await page.fill('input[placeholder="Item / Descrição..."]', 'Serviço de Limpeza Automotiva (Teste)');
  31  |     // unit price is a CurrencyInput which might need careful typing. We skip or type generic.
  32  |     
  33  |     // Salvar Orçamento
  34  |     await page.click('button:has-text("Salvar Orçamento")');
  35  |     
  36  |     // Wait for it to appear in the Kanban / list (which happens to be Quotes Overview usually)
  37  |     // We assume the quote was saved and we are back at the quotes board.
  38  |     await page.waitForTimeout(2000);
  39  |     
  40  |     // We need to approve the quote.
  41  |     // In Kanban, we'd click the card. Let's just search for it.
  42  |     console.log('[COMERCIAL] Abrindo Orçamento recém-criado para aprovar...');
  43  |     await page.click(`text=${prospectName}`);
> 44  |     await page.waitForSelector('text=Detalhes do Orçamento', { state: 'visible' });
      |                ^ Error: page.waitForSelector: Test timeout of 120000ms exceeded.
  45  | 
  46  |     // Clicar em Editar para mudar o Status (ou Mover de Estágio)
  47  |     await page.click('button:has-text("Editar")');
  48  |     await page.waitForSelector('text=Editar Orçamento', { state: 'visible' });
  49  |     
  50  |     // Select Status "Aprovado" or change Stage to "Fechado"
  51  |     // The UI uses a Kanban stage select or we can assume there's a way to mark it approved.
  52  |     // Let's assume there is a stage dropdown.
  53  |     await page.locator('div').filter({ hasText: /^Etapa/ }).locator('select, button').nth(1).click();
  54  |     await page.waitForTimeout(500);
  55  |     // Attempting to select "Ganho" or "Fechado"
  56  |     await page.keyboard.press('ArrowDown');
  57  |     await page.keyboard.press('ArrowDown');
  58  |     await page.keyboard.press('ArrowDown');
  59  |     await page.keyboard.press('Enter');
  60  | 
  61  |     await page.click('button:has-text("Salvar Orçamento")');
  62  |     
  63  |     // Se a automação existir, o QuoteApprovalModal deve aparecer
  64  |     console.log('[AUTOMAÇÃO] Aguardando o modal de Orçamento Aprovado (Gatilho)...');
  65  |     try {
  66  |         await page.waitForSelector('text=Orçamento Aprovado!', { state: 'visible', timeout: 5000 });
  67  |         console.log('✅ Automação disparada: Modal de Aprovação capturado.');
  68  |         
  69  |         // Clicar em Criar Contrato
  70  |         await page.click('button:has-text("Criar Contrato")');
  71  |         await page.waitForSelector('text=Novo Contrato Recorrente', { state: 'visible' });
  72  |         
  73  |         // Fechar Modal de Contrato para checar o CRM
  74  |         await page.click('button:has-text("Cancelar"), button:has-text("Fechar")');
  75  |     } catch (e) {
  76  |         console.log('❌ O modal automático de "Orçamento Aprovado" NÃO apareceu. Automação falhou ou fluxo diferente.');
  77  |     }
  78  | 
  79  |     // Checar CRM se o prospect virou Contato real
  80  |     console.log('[CRM] Validando se o Prospect virou Contato...');
  81  |     await page.goto('http://localhost:3000/#/commercial/contacts');
  82  |     await page.waitForSelector('text=Contatos', { state: 'visible' });
  83  |     
  84  |     await page.fill('input[placeholder="Buscar..."]', prospectName);
  85  |     await page.waitForTimeout(1000);
  86  |     
  87  |     const contactExists = await page.locator(`text=${prospectName}`).count();
  88  |     if (contactExists > 0) {
  89  |         console.log(`✅ CRM: Contato "${prospectName}" criado automaticamente com sucesso!`);
  90  |     } else {
  91  |         console.log(`❌ CRM: Contato "${prospectName}" NÃO foi criado pela automação do Orçamento.`);
  92  |         throw new Error('Falha de Automação: Prospect não virou Contato no CRM.');
  93  |     }
  94  |   });
  95  | 
  96  |   test('Fluxo 2: Rotinas -> Agenda (Tarefas vs Calendário)', async ({ page }) => {
  97  |     test.setTimeout(120000);
  98  | 
  99  |     console.log('[ROTINAS] Criando Tarefa com Prazo...');
  100 |     await page.goto('http://localhost:3000/#/tasks');
  101 |     await page.waitForSelector('text=Tarefas', { state: 'visible', timeout: 10000 });
  102 | 
  103 |     await page.click('button:has-text("Nova Tarefa")');
  104 |     await page.waitForSelector('text=Nova Tarefa', { state: 'visible' });
  105 | 
  106 |     const taskName = `Tarefa Sincronizada ${Date.now()}`;
  107 |     await page.fill('input[placeholder="Ex: Criar relatório mensal"]', taskName);
  108 |     await page.fill('textarea[placeholder="Detalhes da tarefa..."]', 'Testando automação com a agenda');
  109 | 
  110 |     // Input type datetime-local needs fill
  111 |     // We will find the DateTimePicker input and fill it with a date
  112 |     const inputs = await page.locator('input[type="datetime-local"]').all();
  113 |     if (inputs.length > 0) {
  114 |         // Set date to today + 2 hours
  115 |         const d = new Date(Date.now() + 2 * 3600 * 1000);
  116 |         // Format YYYY-MM-DDThh:mm
  117 |         const tzOffset = d.getTimezoneOffset() * 60000;
  118 |         const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString().slice(0, 16);
  119 |         await inputs[0].fill(localISOTime);
  120 |     }
  121 | 
  122 |     await page.click('button:has-text("Salvar")');
  123 |     await page.waitForTimeout(2000);
  124 |     console.log('✅ Tarefa salva no módulo Rotinas.');
  125 | 
  126 |     console.log('[AGENDA] Verificando se a Tarefa aparece no Calendário...');
  127 |     await page.goto('http://localhost:3000/#/agenda');
  128 |     await page.waitForSelector('text=Agenda', { state: 'visible', timeout: 10000 });
  129 | 
  130 |     // Procurar a tarefa na agenda de hoje
  131 |     const taskInAgenda = await page.locator(`text=${taskName}`).count();
  132 |     if (taskInAgenda > 0) {
  133 |         console.log('✅ AGENDA: Tarefa apareceu no calendário com sucesso!');
  134 |         
  135 |         // Testando completar pela agenda
  136 |         await page.click(`text=${taskName}`);
  137 |         await page.waitForSelector('text=Detalhes da Tarefa', { state: 'visible' });
  138 |         
  139 |         // Mudar status para concluído usando o KanbanStageMover ou Botão 
  140 |         try {
  141 |             await page.click('button:has-text("Marcar como Concluída")');
  142 |             await page.waitForTimeout(1000);
  143 |             console.log('✅ Tarefa concluída via Agenda.');
  144 |         } catch (e) {
```