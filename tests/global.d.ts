import {ModelContext} from '../src/webmcp_types';

declare global {
  interface Window {
    __registeredTools?: any[];
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}
