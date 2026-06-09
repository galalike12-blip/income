const fs = require('fs');
let code = fs.readFileSync('src/i18n/translations.ts', 'utf8');

const duplicates = [
  /^\s*filter: ".*?",\n/gm,
  /^\s*search: ".*?",\n/gm,
  /^\s*manageCategories: ".*?",\n/gm,
  /^\s*allCategories: ".*?",\n/gm,
  /^\s*clearFilters: ".*?",\n/gm,
  /^\s*transferIncomeToExpenses: ".*?",\n/gm,
  /^\s*bonus: ".*?",\n/gm,
  /^\s*average: ".*?",\n/gm,
  /^\s*comparison: ".*?",\n/gm,
  /^\s*equal: ".*?",\n/gm,
  /^\s*yesterday: ".*?",\n/gm,
  /^\s*transfer: ".*?",\n/gm,
];

let finalCode = code;
// To fix duplicates, maybe we can just do a proper AST parsing? Or simpler: 
// Just remove the block that I inserted right after `dailyIncentive: "...",`

finalCode = code.replace(/(dailyIncentive: "[^"]*",\n)(\s*filter: "[^"]*",\n\s*search: "[^"]*",\n\s*manageCategories: "[^"]*",\n\s*allCategories: "[^"]*",\n\s*clearFilters: "[^"]*",\n\s*transferIncomeToExpenses: "[^"]*",\n)/g, '$1');

finalCode = finalCode.replace(/(dailyIncentive: "[^"]*",\n)(\s*bonus: "[^"]*",\n\s*average: "[^"]*",\n\s*comparison: "[^"]*",\n\s*equal: "[^"]*",\n\s*yesterday: "[^"]*",\n\s*transfer: "[^"]*",\n)/g, '$1');

fs.writeFileSync('src/i18n/translations.ts', finalCode);
