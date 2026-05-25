import { test, expect } from '@playwright/test';

test.describe('EXECUÇÃO REAL - COMERCIAL', () => {
  test('Fluxo Completo de Contatos', async ({ page }) => {
    await page.goto('/#/commercial/contacts');
    await page.waitForTimeout(1000);
    // Novo Contato
    await page.getByRole('button', { name: 'Novo', exact: true }).click();
    await page.waitForTimeout(500);
    await page.getByRole('textbox').first().fill('Contato Real Teste');
    await page.getByRole('button', { name: 'Salvar' }).click();
    
    // Editar
    await page.waitForTimeout(1000);
    const editBtn = page.getByRole('button', { name: 'Editar' }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }

    // Excluir
    await page.waitForTimeout(1000);
    const deleteBtn = page.getByRole('button', { name: 'Excluir' }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      // O sistema pode usar confirm() ou modal customizado.
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      // Se for modal HTML:
      const btnExcluirConf = page.getByRole('button', { name: 'Excluir' }).nth(1);
      if (await btnExcluirConf.isVisible()) await btnExcluirConf.click();
    }
  });

  test('Fluxo Completo de Orçamentos', async ({ page }) => {
    await page.goto('/#/commercial/quotes');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /Novo/i });
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      const btnAdd = page.getByRole('button', { name: /Adicionar Item/i });
      if (await btnAdd.isVisible()) await btnAdd.click();
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });
  
  test('Fluxo Completo de Contratos', async ({ page }) => {
    await page.goto('/#/commercial/recurring');
    await page.waitForTimeout(1000);
    const btnNovo = page.getByRole('button', { name: /Novo/i });
    if (await btnNovo.isVisible()) {
      await btnNovo.click();
      await page.waitForTimeout(500);
      await page.getByRole('button', { name: 'Salvar' }).click();
    }
  });
});
