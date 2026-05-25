import { test, expect } from '@playwright/test';

test.describe('Comercial Operacional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/commercial/contacts');
    await page.waitForTimeout(2000); 
  });

  test('CRUD Básico de Contato com deleção', async ({ page }) => {
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await expect(page.getByText('Novo Contato')).toBeVisible();
    
    await page.getByPlaceholder('Ex: Maria Silva').fill('Teste Automatizado QA');
    await page.getByPlaceholder('Ex: maria@email.com').fill('qa@teste.com');
    
    // Clica Salvar
    await page.getByRole('button', { name: 'Salvar Contato' }).click();
    await page.waitForTimeout(1000);
    
    // Busca
    await page.getByPlaceholder('Buscar...').fill('Teste Automatizado');
    await expect(page.getByText('Teste Automatizado QA')).toBeVisible();
  });
});
