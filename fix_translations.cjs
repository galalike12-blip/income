const fs = require('fs');
let s = fs.readFileSync('src/i18n/translations.ts', 'utf8');
s = s.replace('exportSuccess: "Successfully exported!",\n  },', 'exportSuccess: "Successfully exported!",\n    leavePlanning: "Leave Planning",\n  },');
s = s.replace('exportSuccess: "ส่งออกไฟล์สำเร็จ!",\n  }\n};', 'exportSuccess: "ส่งออกไฟล์สำเร็จ!",\n    leavePlanning: "วางแผนการลาหยุด",\n  }\n};');
fs.writeFileSync('src/i18n/translations.ts', s);
