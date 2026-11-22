const ts = require('typescript');
const { TsJestTransformer } = require('ts-jest');
const defaultTransformer = new TsJestTransformer();

const NODE_MODULES_JS_RE = /[/\\]node_modules[/\\].+\.js$/;

module.exports = {
  process(sourceText, sourcePath, options) {
    if (NODE_MODULES_JS_RE.test(sourcePath)) {
      const { outputText, sourceMapText } = ts.transpileModule(sourceText, {
        fileName: sourcePath,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          allowJs: true,
          esModuleInterop: true,
          sourceMap: true,
        },
      });
      return { code: outputText, map: sourceMapText };
    }
    if (sourceText.includes('import.meta.env')) {
      sourceText = sourceText.replace(/import\.meta\.env/g, 'process.env');
    }
    return defaultTransformer.process(sourceText, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return defaultTransformer.getCacheKey(sourceText, sourcePath, options) + ':cjs-nm';
  }
};
