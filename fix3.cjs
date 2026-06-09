const fs = require('fs');
let s = fs.readFileSync('src/components/Summary.tsx', 'utf8');

// Tips
s = s.replace(/        \)\}\n                \)\}/g, '        )');

// secondaryStats
s = s.replace(/if \(key === 'secondaryStats'\) return <div key=\{key\}>\(\n/g, 'if (key === \'secondaryStats\') return <div key={key}>\n');
s = s.replace(/      \)\}<\/div>;\n          \n          if \(key === 'comparison'\)/g, '      </div>;\n          \n          if (key === \'comparison\')');

// comparison
s = s.replace(/if \(key === 'comparison'\) return <div key=\{key\}>\{ \(activeTab === 'monthly' \|\| activeTab === 'yearly'\) && \(\n/g, 'if (key === \'comparison\') return <div key={key}>\n{ (activeTab === \'monthly\' || activeTab === \'yearly\') && (\n');
s = s.replace(/        <\/motion\.div>\n      \)\}<\/div>;\n\n          if \(key === 'dailyChart'\)/g, '        </motion.div>\n      )}\n</div>;\n\n          if (key === \'dailyChart\')');

// dailyChart
s = s.replace(/if \(key === 'dailyChart'\) return <div key=\{key\}>\{activeTab !== 'daily' && \(\n/g, 'if (key === \'dailyChart\') return <div key={key}>\n{activeTab !== \'daily\' && (\n');
s = s.replace(/        <\/motion\.div>\n      \)\}<\/div>;\n\n          if \(key === 'categoryChart'\)/g, '        </motion.div>\n      )}\n</div>;\n\n          if (key === \'categoryChart\')');

// categoryChart
s = s.replace(/if \(key === 'categoryChart'\) return <div key=\{key\}>\(\n/g, 'if (key === \'categoryChart\') return <div key={key}>\n');
s = s.replace(/          \)\}\n        <\/motion\.div>\n      \)\}<\/div>;\n\n          return null;/g, '          )}\n        </motion.div>\n      \n</div>;\n\n          return null;');

// Historical Overlap Line Chart (1037)
s = s.replace(/\{\(activeTab === 'monthly' \|\| activeTab === 'yearly'\) && rangeData\.overlappingData\?\.length > 0 && \(\n/g, '{ (activeTab === \'monthly\' || activeTab === \'yearly\') && rangeData.overlappingData?.length > 0 && (\n');

fs.writeFileSync('src/components/Summary.tsx', s);
