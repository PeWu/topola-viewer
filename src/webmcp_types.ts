export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface WebMcpTool extends ToolDefinition {
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface ModelContext {
  registerTool(tool: WebMcpTool): void;
  unregisterTool?(name: string): void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}
