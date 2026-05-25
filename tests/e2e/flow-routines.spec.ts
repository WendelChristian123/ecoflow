import { test, expect } from '@playwright/test';

test.describe('EXECUÇÃO REAL - ROTINAS', () => {
  test('Fluxo Completo de Tarefas', async ({ page }) => {
    await page.goto('/#/tasks');
    await page.waitForTimeout(1000);
    const btnNova = page.getByRole('button', { name: 'Nova', exact: true });
    if (await btnNova.isVisible()) {
      await btnNova.click();
      await page.waitForTimeout(500);
      await page.getByRole('textbox').first().fill('Tarefa Flow Real');
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });

  test('Fluxo de Projetos', async ({ page }) => {
    await page.goto('/#/projects');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /Novo/i });
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });

  test('Fluxo de Agenda', async ({ page }) => {
    await page.goto('/#/agenda');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /Novo/i });
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });
});
