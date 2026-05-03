import {ToolDefinition} from './webmcp_types';

export const WEBMCP_TOOLS: ToolDefinition[] = [
  {
    name: 'get_selected_person',
    description:
      'Returns the full details (name, events, immediate relatives) of the individual currently selected in the browser viewport.',
    inputSchema: {type: 'object', properties: {}},
  },
  {
    name: 'search_indi',
    description:
      'Searches the genealogy index for individuals by name. Returns up to 10 results starting with the ones that match the best.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {type: 'string', description: 'The name to search for.'},
      },
      required: ['query'],
    },
  },
  {
    name: 'inspect_indi',
    description:
      'Fetches detailed information for a specific individual by ID, including their immediate relatives and life events.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string', description: 'The ID of the individual.'},
      },
      required: ['id'],
    },
  },
  {
    name: 'focus_indi',
    description:
      'Instructs the Topola viewer camera view to center on and focus a specific person. Restructures the tree view to show ancestors and descendants of the selected person.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string', description: 'The ID to focus.'},
      },
      required: ['id'],
    },
  },
  {
    name: 'find_relationship_path',
    description:
      'Finds the shortest path connecting two individuals (e.g., through parents or marriages). Returns an ordered list of connecting individuals.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {type: 'string', description: 'Start individual ID'},
        target: {type: 'string', description: 'End individual ID'},
      },
      required: ['source', 'target'],
    },
  },
  {
    name: 'get_ancestors',
    description:
      'Returns ancestors of a specific individual up to a maximum depth of 5 generations.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string', description: 'Target individual ID'},
        generations: {
          type: 'number',
          description: 'Depth bound limit (1-5). Defaults to 3.',
          minimum: 1,
          maximum: 5,
          default: 3,
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_descendants',
    description:
      'Returns descendants of a specific individual up to a maximum depth of 5 generations.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {type: 'string', description: 'Target individual ID'},
        generations: {
          type: 'number',
          description: 'Depth bound limit (1-5). Defaults to 3.',
          minimum: 1,
          maximum: 5,
          default: 3,
        },
      },
      required: ['id'],
    },
  },
];
