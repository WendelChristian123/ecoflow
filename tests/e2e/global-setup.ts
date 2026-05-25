import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  const authDir = path.join(process.cwd(), 'playwright/.auth');
  const authFile = path.join(authDir, 'user.json');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  if (fs.existsSync(authFile)) {
    console.log('Auth state already exists. Skipping bypass.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const testEmail = `qa_auto_${Date.now()}@example.com`;
  const password = 'Password123!';

  console.log('Bypassing onboarding to generate Auth State...');
  await page.goto('http://localhost:3000/#/register');
  
  await page.getByRole('textbox', { name: 'Razão Social ou Nome Completo' }).fill('QA Auto Tester');
  const randomCnpj = Math.floor(10000000000 + Math.random() * 89999000000).toString();
  await page.getByRole('textbox', { name: 'CPF ou CNPJ' }).fill(randomCnpj);
  const randomWhatsapp = `119${Math.floor(10000000 + Math.random() * 89999999)}`;
  await page.getByRole('textbox', { name: 'WhatsApp' }).fill(randomWhatsapp);
  await page.getByRole('textbox', { name: 'E-mail de Login' }).fill(testEmail);
  await page.getByRole('textbox', { name: 'Senha' }).first().fill(password);
  await page.getByRole('textbox', { name: 'Confirmar' }).fill(password);
  
  await page.getByRole('button', { name: 'Começar Avaliação Gratuita' }).click();
  
  // Wait for success screen or error
  try {
    await page.waitForSelector('text=Conta Criada!', { timeout: 10000 });
    await page.getByRole('button', { name: 'Ir para Login' }).click();
  } catch(e) {
    console.log('Success screen not seen, proceeding...');
  }
  
  try {
    // Wait for login or dashboard
    await page.waitForURL(/.*#\/(dashboard|login)/, { timeout: 30000 });
  } catch(e) {
    await page.screenshot({ path: 'test-results/global-setup-error.png' });
    throw e;
  }
  if (page.url().includes('#/login')) {
    await page.getByPlaceholder('seu@email.com').fill(testEmail);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
  }

  // Wait for dashboard and tokens
  await page.waitForURL(/.*#\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(3000); // Give time for any background setup and localStorage population
  
  // Save storage state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
  await browser.close();
  console.log('Auth state saved successfully.');
}

export default globalSetup;
