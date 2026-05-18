import {jest} from '@jest/globals';

/**
 * Mocks the global sessionStorage object and returns the underlying dictionary object
 * that stores the items. This dictionary can be inspected or modified by tests.
 */
export function mockSessionStorage(): {[key: string]: string} {
  const sessionStorageMock: {[key: string]: string} = {};
  Object.defineProperty(global, 'sessionStorage', {
    value: {
      getItem: jest.fn((key: string) => sessionStorageMock[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        sessionStorageMock[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete sessionStorageMock[key];
      }),
      clear: jest.fn(() => {
        for (const key in sessionStorageMock) {
          delete sessionStorageMock[key];
        }
      }),
      get length() {
        return Object.keys(sessionStorageMock).length;
      },
      key: jest.fn((index: number) => {
        return Object.keys(sessionStorageMock)[index] || null;
      }),
    },
    writable: true,
    configurable: true,
  });
  return sessionStorageMock;
}
