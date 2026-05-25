import { test, expect } from '@playwright/test';

test.describe('EXECUÇÃO REAL - FINANCEIRO', () => {
  test('Fluxo Completo de Lançamentos', async ({ page }) => {
    await page.goto('/#/finance/transactions');
    await page.waitForTimeout(1000);
    
    // Novo Lancamento
    const btnPlus = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    if (await btnPlus.isVisible()) {
      await btnPlus.click();
      await page.waitForTimeout(500);
      const btnReceita = page.getByText('Nova Receita');
      if (await btnReceita.isVisible()) await btnReceita.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });

  test('Cadastro de Contas e Cartões', async ({ page }) => {
    await page.goto('/#/finance/accounts');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /Nova/i }).first();
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });
});
