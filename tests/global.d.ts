import {ModelContext, ToolDefinition} from '../src/webmcp_types';

declare global {
  interface Window {
    __registeredTools?: ToolDefinition[];
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}
