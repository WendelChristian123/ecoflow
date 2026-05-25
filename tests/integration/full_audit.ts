

import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

async function runAudit() {
  console.log("==========================================");
  console.log(" ECOFLOW SYSTEM FULL INTEGRATION AUDIT ");
  console.log("==========================================");
  
  // 1. Authenticate with a known user or create a new session
  // Since we don't have the user's password, let's just query the database for a company and user,
  // and manually override the context if possible. 
  // Wait, api.ts uses Supabase Auth heavily. 
  // We need to sign in!
  
  const testEmail = `audit_${Date.now()}@ecoflow.com`;
  const testPassword = "AuditPassword123!";
  
  console.log(`\n[AUTH] Registering Company for User...`);
  try {
      await api.registerCompany({
          legal_name: 'Audit Company',
          admin_name: 'Audit Admin',
          cpf_cnpj: `00000000000${Math.floor(Math.random() * 999)}`.slice(-14),
          phone: '11999999999',
          email: testEmail,
          password: testPassword
      });
  } catch (e: any) {
      console.log(`❌ Failed to register company: ${e.message}`);
      return;
  }
  
  console.log(`[AUTH] Logging in with new user...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
  });
  
  if (authErr || !authData.user) {
      console.log(`❌ Auth failed: ${authErr?.message}. Cannot proceed.`);
      return;
  }
  
  console.log(`✅ Logged in successfully. User ID: ${authData.user.id}`);

  const { data: companies, error: compErr } = await supabase.from('companies').select('*').eq('owner_email', testEmail).limit(1);
  if (compErr || !companies || companies.length === 0) {
      console.log(`❌ No company found for user ${testEmail}!`, compErr);
      return;
  }
  const companyId = companies[0].id;
  console.log(`✅ Using Company: ${companies[0].name} (ID: ${companyId})`);
  
  // Override api.ts getCurrentCompanyId if it relies on localStorage (which Node doesn't have)
  // Actually, api.ts might use localStorage!
  // Let's mock localStorage
  (global as any).localStorage = {
      getItem: (key: string) => {
          if (key === 'ecoflow-company-id') return companyId;
          return null;
      },
      setItem: () => {},
      removeItem: () => {}
  };
  
  let errorsFound = 0;
  
  try {
      // ----------------------------------------------------------------------
      // COMMERCIAL & CRM FLOW
      // ----------------------------------------------------------------------
      console.log("\n--- [MODULO COMERCIAL & CRM] ---");
      const contactName = `Audit Contact ${Date.now()}`;
      
      console.log(`Criando Contato: ${contactName}`);
      let contact;
      try {
          const req = {
              name: contactName,
              scope: 'client' as any,
              companyId
          };
          await api.addContact(req);
          const contacts = await api.getContacts(companyId);
          contact = contacts.find(c => c.name === contactName);
          console.log(contact ? `✅ Contato criado. ID: ${contact.id}` : "❌ Falha ao criar contato.");
          if (!contact) errorsFound++;
      } catch(e: any) {
          console.error("❌ Erro criar contato:", e.message);
          errorsFound++;
      }
      
      if (contact) {
          console.log(`Criando Orçamento para o Contato...`);
          try {
              const quote = {
                  contactId: contact.id,
                  customerName: contact.name,
                  status: 'draft' as any,
                  date: new Date().toISOString().split('T')[0],
                  totalValue: 5000,
                  companyId
              };
              await api.addQuote(quote, []);
              const quotes = await api.getQuotes(companyId);
              const myQuote = quotes.find(q => q.contactId === contact.id);
              console.log(myQuote ? `✅ Orçamento criado. ID: ${myQuote.id}` : "❌ Falha ao criar orçamento.");
              
              if (myQuote) {
                  // Simulate Automation: Approve Quote -> Create Finance Receivable?
                  console.log("Testando 'Mudar Status Orçamento para Aprovado' (Verifica Automacao de Financeiro)...");
                  await api.updateQuote({ ...myQuote, status: 'approved' }, []);
                  console.log("✅ Orçamento alterado para aprovado.");
                  
                  // Verification: Did it create revenue?
                  // Ecoflow Automations would normally do this in a trigger.
                  const txs = await api.getFinancialTransactions(companyId);
                  const relatedTx = txs.find(t => t.contactId === contact.id);
                  if (relatedTx) {
                      console.log(`✅ AUTOMAÇÃO FUNCIONOU: Fatura gerada automaticamente! ID: ${relatedTx.id}`);
                  } else {
                      console.log(`❌ BUG DE AUTOMAÇÃO: Aprovar Orçamento NÃO gerou conta a receber!`);
                      errorsFound++;
                  }
              }
          } catch(e: any) {
              console.error("❌ Erro ao lidar com Orçamento:", e.message);
              errorsFound++;
          }
      }

      // ----------------------------------------------------------------------
      // ROTINAS & AGENDA FLOW
      // ----------------------------------------------------------------------
      console.log("\n--- [MODULO ROTINAS & AGENDA] ---");
      console.log("Criando Projeto e Tarefa...");
      
      let project, task;
      try {
          await api.addProject({
              name: `Projeto Audit ${Date.now()}`,
              status: 'active',
              companyId
          });
          const projects = await api.getProjects(companyId);
          project = projects[projects.length - 1];
          console.log(`✅ Projeto criado. ID: ${project.id}`);
          
          task = await api.addTask({
              title: `Tarefa Audit ${Date.now()}`,
              projectId: project.id,
              dueDate: new Date(Date.now() + 86400000).toISOString(),
              companyId,
              status: 'todo'
          });
          console.log(`✅ Tarefa criada. ID: ${task?.id}`);
          
          console.log("Validando Consolidação na Agenda...");
          // Em Agenda.tsx as promessas são chamadas juntas.
          const tasks = await api.getTasks(companyId);
          const events = await api.getEvents(companyId);
          const foundTaskInAgenda = tasks.find(t => t.id === task?.id);
          
          if (foundTaskInAgenda) {
              console.log("✅ AGENDA: Tarefa é retornada na consolidação para o calendário!");
          } else {
              console.log("❌ BUG DE INTEGRAÇÃO: Tarefa não aparece no escopo da Agenda.");
              errorsFound++;
          }
          
      } catch(e: any) {
          console.error("❌ Erro Rotinas:", e.message);
          errorsFound++;
      }
      
      // ----------------------------------------------------------------------
      // FINANCE FLOW
      // ----------------------------------------------------------------------
      console.log("\n--- [MODULO FINANCEIRO] ---");
      console.log("Testando Parcelamento de Dívida / Contas...");
      
      try {
          const req = {
              type: 'expense' as any,
              amount: 1500,
              companyId,
              description: `Audit Installment ${Date.now()}`,
              date: new Date().toISOString().split('T')[0]
          };
          
          const recurrence = {
              isRecurring: true,
              repeatCount: 3,
              frequency: 'monthly'
          };
          
          await api.addTransaction(req, recurrence);
          const txs = await api.getFinancialTransactions(companyId);
          
          // Should have 3 installments
          const createdInsts = txs.filter(t => t.description.includes(req.description));
          if (createdInsts.length === 3) {
              console.log("✅ Parcelamento funcionou perfeitamente. 3 transações geradas.");
          } else {
              console.log(`❌ BUG FINANCEIRO: Esperava 3 parcelas, encontrou ${createdInsts.length}.`);
              errorsFound++;
          }
      } catch(e: any) {
          console.error("❌ Erro Financeiro:", e.message);
          errorsFound++;
      }

  } catch(fatal: any) {
      console.error("\n❌ FATAL ERROR IN AUDIT SCRIPT:");
      console.error(fatal);
  } finally {
      console.log("\n==========================================");
      console.log(` AUDIT COMPLETE. BUGS FOUND: ${errorsFound}`);
      console.log("==========================================");
      process.exit(errorsFound > 0 ? 1 : 0);
  }
}

runAudit();
