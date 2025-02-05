import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  testEnvironment: "node",
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  moduleNameMapper: {
    "d3-array": "<rootDir>/node_modules/d3-array/dist/d3-array.js",
    "d3-color": "<rootDir>/node_modules/d3-color/dist/d3-color.js",
    "d3-ease": "<rootDir>/node_modules/d3-ease/dist/d3-ease.js",
    "d3-dispatch": "<rootDir>/node_modules/d3-dispatch/dist/d3-dispatch.js",
    "d3-interpolate": "<rootDir>/node_modules/d3-interpolate/dist/d3-interpolate.js",
    "d3-hierarchy": "<rootDir>/node_modules/d3-hierarchy/dist/d3-hierarchy.js",
    "d3-selection": "<rootDir>/node_modules/d3-selection/dist/d3-selection.js",
    "d3-timer": "<rootDir>/node_modules/d3-timer/dist/d3-timer.js",
    "d3-transition": "<rootDir>/node_modules/d3-transition/dist/d3-transition.js",
  },
};

export default config;
