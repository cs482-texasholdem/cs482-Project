// app.test.js
const fs = require('fs');
const path = require('path');

describe('Architectural Design Enforcement', () => {
  it('should delegate all route handlers to external controllers (no inline logic)', () => {
    // 1. Read your raw app.js file directly from disk
    const appFilePath = path.join(__dirname, './app.js'); 
    const appCode = fs.readFileSync(appFilePath, 'utf8');

    // 2. Regular Expression to find Express route patterns with inline functions
    // Matches patterns like: app.get(..., function(...) { ... }) or app.post(..., () => { ... })
    const inlineFunctionPattern = /app\.(get|post|put|delete|patch)\s*\(\s*['"][^'"]+['"]\s*,\s*(function\s*\(|\([^)]*\)\s*=>|\w+\s*=>)/g;

    const violations = [];
    let match;

    // 3. Scan the code text for inline handlers
    while ((match = inlineFunctionPattern.exec(appCode)) !== null) {
      // Extract a clean preview snippet of the offending line
      const matchedText = match[0].trim();
      violations.push(`Found bad design: "${matchedText}..."`);
    }

    // 4. Fail the build if any violations are caught
    if (violations.length > 0) {
      throw new Error(
        `\n ** DESIGN VIOLATION DETECTED IN APP.JS:\n` +
        `You are writing route handling logic directly in app.js to hide untested functions.\n` +
        `All actions must be delegated to Controller functions and have tests.\n\n` +
        violations.join('\n') + `\n`
      );
    }
  });
});