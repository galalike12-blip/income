const fs = require('fs');
let s = fs.readFileSync('src/components/Summary.tsx', 'utf8');

// Fix double closing braces from the regex mistake
s = s.replace(/        \)\}\n                \)\}/g, '                )');

// For secondaryStats:
s = s.replace(/      \)\}\n<\/div>/g, '      </div>');

// For comparison:
s = s.replace(/      \)\}\n<\/div>/g, '      </div>');
// Wait, my secondaryStats had:
// if (key === 'secondaryStats') return <div key={key}>{( <div...</div> ) }</div>
// So it ended with `) }</div>` or something.
s = s.replace(/\)\n<\/div>;/g, '\n</div>;');
s = s.replace(/\)\n\n<\/div>;/g, '\n</div>;');
s = s.replace(/        \)\}\n<\/div>;/g, '\n</div>;');
s = s.replace(/      \)\}\n<\/div>;/g, '\n</div>;');

fs.writeFileSync('src/components/Summary.tsx', s);
