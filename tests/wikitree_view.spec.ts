import {expect, test} from '@playwright/test';

// Mock data
// Mock data - Individual basic properties (returned by getPeople)
const MOCK_PERSON_SMITH = {
  Id: 123,
  Name: 'Smith-123',
  FirstName: 'John',
  LastNameAtBirth: 'Smith',
  LastNameCurrent: 'Smith',
  LastNameOther: 'Unknown',
  Gender: 'Male',
  Father: 100,
  Mother: 0,
};

const MOCK_PERSON_FATHER = {
  Id: 100,
  Name: 'Smith-100',
  FirstName: 'Bonifacy',
  LastNameAtBirth: 'Smith',
  LastNameCurrent: 'Smith',
  LastNameOther: 'Unknown',
  Gender: 'Male',
  Father: 0,
  Mother: 0,
};

const MOCK_PERSON_SPOUSE = {
  Id: 10,
  Name: 'Doe-10',
  FirstName: 'Jane',
  LastNameAtBirth: 'Doe',
  LastNameCurrent: 'Smith',
  LastNameOther: 'Unknown',
  Gender: 'Female',
  Father: 0,
  Mother: 0,
};

const MOCK_PERSON_CHILD = {
  Id: 124,
  Name: 'Smith-124',
  FirstName: 'Radobod',
  LastNameAtBirth: 'Smith',
  LastNameCurrent: 'Smith',
  LastNameOther: 'Unknown',
  Gender: 'Male',
  Father: 123,
  Mother: 10,
};

// Full objects returned by getRelatives (with Spouses/Children lists)
const MOCK_SMITH = {
  ...MOCK_PERSON_SMITH,
  Spouses: {
    '10': MOCK_PERSON_SPOUSE,
  },
  Children: {
    '124': MOCK_PERSON_CHILD,
  },
};

const MOCK_FATHER = {
  ...MOCK_PERSON_FATHER,
  Spouses: {},
  Children: {},
};

const MOCK_SPOUSE = {
  ...MOCK_PERSON_SPOUSE,
  Spouses: {},
  Children: {},
};

const MOCK_CHILD = {
  ...MOCK_PERSON_CHILD,
  Spouses: {},
  Children: {},
};

test.describe('WikiTree View', () => {
  test.beforeEach(async ({context, page}) => {
    // Block external trackers
    await context.route('**/*google-analytics.com/**', (route) =>
      route.abort(),
    );
    await context.route('**/*googletagmanager.com/**', (route) =>
      route.abort(),
    );

    // Intercept WikiTree API requests
    await context.route('**/api.php*', async (route) => {
      const request = route.request();
      const postData = request.postData() || '';

      const actionMatch = postData.match(/name="action"\r?\n\r?\n([^\r\n]+)/);
      const action = actionMatch ? actionMatch[1] : '';

      const keysMatch = postData.match(/name="keys"\r?\n\r?\n([^\r\n]+)/);
      const keys = keysMatch ? keysMatch[1].split(',') : [];

      if (action === 'getRelatives') {
        const items = keys
          .map((k) => {
            if (k === 'Smith-123') return {person: MOCK_SMITH};
            if (k === 'Smith-100') return {person: MOCK_FATHER};
            if (k === 'Doe-10') return {person: MOCK_SPOUSE};
            if (k === 'Smith-124') return {person: MOCK_CHILD};
            return null;
          })
          .filter(Boolean);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {'Access-Control-Allow-Origin': '*'},
          body: JSON.stringify([{items}]),
        });
      } else if (action === 'getPeople') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let people: Record<string, any> = {};
        if (keys.includes('Smith-123')) {
          people = {
            'Smith-123': MOCK_PERSON_SMITH,
            'Smith-100': MOCK_PERSON_FATHER,
          };
        } else if (keys.includes('Doe-10')) {
          people = {
            'Doe-10': MOCK_PERSON_SPOUSE,
          };
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {'Access-Control-Allow-Origin': '*'},
          body: JSON.stringify([{people}]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/#/view?indi=Smith-123&source=wikitree&standalone=true');
  });

  test('loads data from WikiTree API', async ({page}) => {
    // Verify initial load displays John Smith
    await expect(page.locator('#content')).toContainText('John');
    await expect(page.locator('#content')).toContainText('Smith');
  });

  test('shows ancestors (Bonifacy)', async ({page}) => {
    await expect(page.locator('#content')).toContainText('Bonifacy');
  });

  test('shows spouses (Jane)', async ({page}) => {
    await expect(page.locator('#content')).toContainText('Jane');
    await expect(page.locator('#content')).toContainText('Doe');
  });

  test('shows descendants (Radobod) on selection click', async ({page}) => {
    // Children are loaded when clicking the node, or directly if loaded by default.
    // In WikiTree wrapper logic, loadData calls:
    // const allDescendants = getAllDescendants(key, handleCors);
    // So Radobod should be loaded initially and displayed.
    await expect(page.locator('#content')).toContainText('Radobod');
  });
});
