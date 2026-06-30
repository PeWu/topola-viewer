import {expect, test} from '@playwright/test';
import {setupGedcomRoute} from './helpers';

test.describe('Search functionality and global shortcut', () => {
  test.beforeEach(async ({context}) => {
    await setupGedcomRoute(context);
  });

  test('Search works and shortcut "/" focuses and selects all text', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');
    await expect(page.locator('#content')).not.toContainText('Chike');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).toBeVisible();

    // Fill some text, blur, and press '/'
    await searchInput.fill('Test Query');
    await searchInput.blur();
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();

    // Assert that all text is selected
    const isTextSelected = await searchInput.evaluate(
      (el: HTMLInputElement) => {
        return el.selectionStart === 0 && el.selectionEnd === el.value.length;
      },
    );
    expect(isTextSelected).toBe(true);

    // Perform search
    await searchInput.fill('chik');
    await expect(page.locator('.results')).toContainText('Chike');
    await searchInput.press('Enter');
    await expect(page.locator('#content')).toContainText('Chike');
  });

  test('Viewport switching: Search query is preserved when resizing between desktop and mobile', async ({
    page,
  }) => {
    await page.setViewportSize({width: 1200, height: 800});
    await page.goto('/#/view?url=https://example.org/family.ged');

    const desktopInput = page.getByPlaceholder("Search for people (press '/')");
    await desktopInput.fill('chik');
    await expect(page.locator('.results')).toContainText('Chike');

    // Resize to mobile viewport
    await page.setViewportSize({width: 500, height: 800});
    const mobileInput = page.getByPlaceholder('Search for people', {
      exact: true,
    });
    await expect(mobileInput).toBeVisible();
    await expect(mobileInput).toHaveValue('chik');
    await expect(page.locator('.results')).toContainText('Chike');
  });

  test('Collision safety: Typing "/" inside an active modal input types "/" and does not trigger shortcut', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    await page.getByText('Open', {exact: true}).click();
    await page.getByText('Load from URL').click();

    const modalInput = page.getByPlaceholder('https://');
    await expect(modalInput).toBeVisible();
    await expect(modalInput).toBeFocused();

    await page.keyboard.type('http://test/data');
    await expect(modalInput).toHaveValue('http://test/data');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).not.toBeFocused();
  });

  test('Modal safety: Pressing "/" while a modal is open does not steal focus even if modal input is blurred', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    await page.getByText('Open', {exact: true}).click();
    await page.getByText('Load from URL').click();

    const modalInput = page.getByPlaceholder('https://');
    await expect(modalInput).toBeVisible();
    await modalInput.blur();

    await page.keyboard.press('/');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).not.toBeFocused();
  });

  test('Form control protection: Pressing "/" while focused on a button does not steal focus', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    await page.getByText('Open', {exact: true}).click();
    await page.getByText('Load from URL').click();

    const cancelButton = page.getByRole('button', {name: 'Cancel'});
    await cancelButton.focus();
    await expect(cancelButton).toBeFocused();

    await page.keyboard.press('/');

    await expect(cancelButton).toBeFocused();
    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).not.toBeFocused();
  });

  test('Modifier exclusion: Modifier combinations do not trigger the shortcut', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('Control+/');
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('Alt+/');
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('Meta+/');
    await expect(searchInput).not.toBeFocused();
  });

  test('Landing page safety: Pressing "/" on landing page has no effect and doesn\'t throw errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      errors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('Warning:')) {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.keyboard.press('/');

    expect(errors).toEqual([]);
  });

  test('Question mark safety: Pressing "?" (Shift+/) does not trigger search shortcut', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');
    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).not.toBeFocused();

    await page.keyboard.press('?');
    await expect(searchInput).not.toBeFocused();
  });

  test('Dropdown menu interaction: Pressing "/" while dropdown is open focuses search bar', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    await page.getByText('View', {exact: true}).click();
    await expect(page.getByText('Hourglass chart')).toBeVisible();

    await page.keyboard.press('/');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).toBeFocused();
  });

  test('Combobox wrapper interaction: Clicking inside search bar wrapper and pressing "/" focuses input', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');

    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await page.locator('.ui.search').first().click();
    await searchInput.blur();

    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();
  });

  test('AltGr compatibility: Control+Alt+/ triggers the shortcut', async ({
    page,
  }) => {
    await page.goto('/#/view?url=https://example.org/family.ged');
    const searchInput = page.getByPlaceholder('Search for people', {
      exact: false,
    });
    await expect(searchInput).toBeVisible();

    await page.keyboard.press('Control+Alt+/');
    await expect(searchInput).toBeFocused();
  });
});
