import { test, expect } from '@playwright/test';

test.describe('Dashboard Internal Operacional', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.waitForTimeout(2000); 
  });

  test('Deve carregar o dashboard corretamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Contazze', level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Módulos' })).toBeVisible();
    await expect(page.getByText('VENCIDOS')).toBeVisible();
  });

  test('Deve navegar pelas Rotinas sem crashar', async ({ page }) => {
    const routinesBtn = page.getByRole('button', { name: 'Rotinas & Execução' });
    if (await routinesBtn.isVisible()) {
      await routinesBtn.click();
    }
    
    await page.getByRole('link', { name: 'Tarefas' }).click();
    await expect(page.getByRole('heading', { name: 'Tarefas', level: 1 })).toBeVisible();
    
    // Corrigido 'Novo' para 'Nova'
    await page.getByRole('button', { name: 'Nova', exact: true }).click();
    await expect(page.getByText('Nova Tarefa')).toBeVisible();
  });
});
