import { test, expect } from '@playwright/test';

test.describe('EXECUÇÃO REAL - CONFIGURAÇÕES', () => {
  test('Gestão de Usuários e Permissões', async ({ page }) => {
    await page.goto('/#/settings/users');
    await page.waitForTimeout(1000);
    
    const btnNovo = page.getByRole('button', { name: /Novo/i });
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });
});
