import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import {getPeople, getRelatives as getRelativesApi, Person} from 'wikitree-js';
import {mockSessionStorage} from './test_helpers';
import {loadData} from './wikitree_api';

// 1. Service Mocking (Recommended): Mock the 'wikitree-js' module
jest.mock('wikitree-js', () => ({
  clientLogin: jest.fn(),
  getLoggedInUserName: jest.fn(),
  getPeople: jest.fn(),
  getRelatives: jest.fn(),
}));

describe('WikiTree API DataSource', () => {
  let sessionStorageMock: {[key: string]: string};

  const mockSmith = {
    Id: 123,
    Name: 'Smith-123',
    FirstName: 'John',
    LastNameAtBirth: 'Smith',
    Gender: 'Male',
    Father: 0,
    Mother: 0,
    Spouses: {},
    Children: {},
  } as unknown as Person;

  beforeEach(() => {
    sessionStorageMock = mockSessionStorage();
    jest.clearAllMocks();

    global.window = {
      location: {
        hostname: 'localhost',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('loadData caching', () => {
    it('caches data and avoids redundant API calls for the same ID', async () => {
      // Mock wikitree-js getRelatives (which is imported as getRelativesApi in wikitree_api.ts)
      const mockGetRelatives = jest.mocked(getRelativesApi);
      mockGetRelatives.mockResolvedValue([mockSmith]);

      // Mock wikitree-js getPeople (for getAncestors call)
      const mockGetPeople = jest.mocked(getPeople);
      mockGetPeople.mockResolvedValue([mockSmith]);

      // 1. Initial load
      const result1 = await loadData('Smith-123');

      expect(result1.length).toBe(1);
      expect(result1[0].Name).toBe('Smith-123');

      // The API should be called once for first person and once for ancestors
      expect(mockGetRelatives).toHaveBeenCalledTimes(1);
      expect(mockGetRelatives).toHaveBeenCalledWith(
        ['Smith-123'],
        expect.any(Object),
        expect.any(Object),
      );
      expect(mockGetPeople).toHaveBeenCalledTimes(1);
      expect(mockGetPeople).toHaveBeenCalledWith(
        ['Smith-123'],
        expect.any(Object),
        expect.any(Object),
      );

      // Verify the sessionStorage has the keys cached
      expect(sessionStorageMock['wikitree:relatives:Smith-123']).toBeDefined();
      expect(sessionStorageMock['wikitree:ancestors:Smith-123']).toBeDefined();

      // Reset mock call counts to verify cache hits
      mockGetRelatives.mockClear();
      mockGetPeople.mockClear();

      // 2. Second load with exact same key
      const result2 = await loadData('Smith-123');

      expect(result2.length).toBe(1);
      expect(result2[0].Name).toBe('Smith-123');

      // It should load entirely from cache and make ZERO API calls!
      expect(mockGetRelatives).not.toHaveBeenCalled();
      expect(mockGetPeople).not.toHaveBeenCalled();
    });
  });

  // 2. HTTP Fetch Mocking (Alternative approach shown for demonstration)
  describe('HTTP Fetch Mocking Demo', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('demonstrates mocking window.fetch directly', async () => {
      // Restore wikitree-js getRelatives mock to actual implementation
      // so it calls fetch (if it runs in node, we mock fetch globally)
      const mockGetRelatives = jest.mocked(getRelativesApi);
      mockGetRelatives.mockImplementation(async (keys, fields, options) => {
        // Simple mock implementation of what wikitree-js wikitree API wrapper does:
        // It performs a fetch to options.apiUrl or default API url.
        const url = options?.apiUrl || 'https://api.wikitree.com/api.php';
        const res = await fetch(url);
        return (await res.json()) as Person[];
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockFetch = jest.fn<() => Promise<any>>().mockResolvedValue({
        status: 200,
        json: async () => [mockSmith],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.fetch = mockFetch as any;

      const mockGetPeople = jest.mocked(getPeople);
      mockGetPeople.mockResolvedValue([mockSmith]);

      // Call loadData which will execute our mock implementation calling fetch
      await loadData('smith-123');

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});
