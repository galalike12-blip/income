const fs = require('fs');
let s = fs.readFileSync('src/components/Summary.tsx', 'utf8');

// Tips
s = s.replace(/                \{key === 'tips' && \(\n\(\n/g, '                {key === \'tips\' && (\n');

s = s.replace(/\n\(\n          <motion.div /g, '\n          <motion.div ');

s = s.replace(/          \}\n        <\/motion.div>\n      \n<\/div>;/g, '        </motion.div>\n      )}\n</div>;');

// For the last one:
// s = s.replace(/if \(key === 'categoryChart'\) return <div key=\{key\}>\n\n          <motion.div/g, 'if (key === \'categoryChart\') return <div key={key}>\n          <motion.div')
fs.writeFileSync('src/components/Summary.tsx', s);
