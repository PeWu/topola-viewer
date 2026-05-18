const { TsJestTransformer } = require('ts-jest');
const defaultTransformer = new TsJestTransformer();

module.exports = {
  process(sourceText, sourcePath, options) {
    if (sourceText.includes('import.meta.env')) {
      sourceText = sourceText.replace(/import\.meta\.env/g, 'process.env');
    }
    return defaultTransformer.process(sourceText, sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    return defaultTransformer.getCacheKey(sourceText, sourcePath, options);
  }
};
