import { test, expect } from '@playwright/test';

test.describe('Financeiro Operacional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/finance/transactions');
    await page.waitForTimeout(2000); 
  });

  test('Menu de novos lançamentos', async ({ page }) => {
    // Clica no botão flutuante de adicionar (+)
    const addBtn = page.locator('button').filter({ has: page.locator('svg.lucide-plus') });
    await addBtn.click();
    
    await page.getByRole('button', { name: 'Nova Despesa' }).click();
    await expect(page.getByText('Novo Lançamento')).toBeVisible();
    
    // Tenta fechar o modal
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Novo Lançamento')).toBeHidden();
  });
});
