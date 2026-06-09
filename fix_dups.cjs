const fs = require('fs');
let code = fs.readFileSync('src/i18n/translations.ts', 'utf8');

const toRemove = [
  // en duplicates
  /^\s*search: "Search...",\n/gm,
  /^\s*filter: "Filter",\n/gm,
  /^\s*allCategories: "All Categories",\n/gm,
  /^\s*clearFilters: "Clear Filters",\n/gm,

  // th duplicates
  /^\s*search: "ค้นหา...",\n/gm,
  /^\s*filter: "ตัวกรอง",\n/gm,
  /^\s*allCategories: "ทุกหมวดหมู่",\n/gm,
  /^\s*clearFilters: "ล้างตัวกรอง",\n/gm,

  // zh duplicates
  /^\s*search: "搜索...",\n/gm,
  /^\s*filter: "筛选",\n/gm,
  /^\s*allCategories: "所有类别",\n/gm,
  /^\s*clearFilters: "清除筛选",\n/gm,
];

toRemove.forEach(r => {
  let count = 0;
  code = code.replace(r, (match) => {
    count++;
    // Keep the first one, delete the rest
    if (count === 1) return match;
    return '';
  });
});

// For manageCategories and transferIncomeToExpenses those were not duplicates originally
fs.writeFileSync('src/i18n/translations.ts', code);
