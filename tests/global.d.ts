import {ModelContext, WebMcpTool} from '../src/webmcp_types';

declare global {
  interface Window {
    __registeredTools?: WebMcpTool[];
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}
