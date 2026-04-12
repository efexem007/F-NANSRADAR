const fs = require('fs');

const files = [
  'src/routes/ai.js', 'src/routes/analysis.js', 'src/routes/prediction.js', 'src/routes/admin/cache.js',
  'src/services/aiLearningService.js', 'src/services/predictionService.js', 'src/services/technicalAnalysis.js',
  'src/workers/index.js'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Replace module.exports = ...
  code = code.replace(/module\.exports\s*=\s*(.*?);/g, 'export default $1;');

  // Replace const { x, y } = require(...)
  code = code.replace(/const\s+\{([^}]+)\}\s*=\s*require\((['"])(.*?)\2\);/g, (match, vars, quote, pth) => {
    if (pth.startsWith('.')) pth += '.js';
    // special override for our prisma
    if (pth.includes('lib/prisma.js')) {
      return `import prisma from '${pth}';`;
    }
    return `import {${vars}} from '${pth}';`;
  });

  // Replace const x = require(...)
  code = code.replace(/const\s+([a-zA-Z0-9_]+)\s*=\s*require\((['"])(.*?)\2\);/g, (match, varName, quote, pth) => {
    if (pth.startsWith('.')) pth += '.js';
    return `import ${varName} from '${pth}';`;
  });

  fs.writeFileSync(file, code);
  console.log('Fixed ESM in', file);
}
