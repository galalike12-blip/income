const fs = require('fs');

const path = 'src/components/Summary.tsx';
let content = fs.readFileSync(path, 'utf8');

const mainStatCardsStart = "{/* Main Stat Cards Layout */}";

const startIndex = content.indexOf(mainStatCardsStart);
if (startIndex === -1) {
  console.log("Could not find start");
  process.exit(1);
}

const beforeBlock = content.substring(0, startIndex);
const afterBlock = "    </div>\n  );\n}\n";

const middleHtml = content.substring(startIndex, content.lastIndexOf("</div>\n  );\n}"));

const rxTips = /{cardVisibility\.tips && \([\s\S]*?<\/motion\.div>\s*\)}/
const rxOff = /{cardVisibility\.offDays && \([\s\S]*?<\/motion\.div>\s*\)}/
const rxWork = /{cardVisibility\.workDays && \([\s\S]*?<\/motion\.div>\s*\)}/
const rxSec = /{cardVisibility\.secondaryStats && \([\s\S]*?<\/div>\s*\)}/
const rxComp = /{cardVisibility\.comparison && \(activeTab === 'monthly' \|\| activeTab === 'yearly'\) && \([\s\S]*?<\/motion\.div>\s*\)}/
const rxDaily = /{activeTab !== 'daily' && cardVisibility\.dailyChart && \([\s\S]*?<\/motion\.div>\s*\)}/
const rxCat = /{cardVisibility\.categoryChart && \([\s\S]*?<\/motion\.div>\s*\)}/

const mTips = middleHtml.match(rxTips);
const mOff = middleHtml.match(rxOff);
const mWork = middleHtml.match(rxWork);
const mSec = middleHtml.match(rxSec);
const mComp = middleHtml.match(rxComp);
const mDaily = middleHtml.match(rxDaily);
const mCat = middleHtml.match(rxCat);

let newRender = `
      {/* Main Stat Cards Layout */}
      <div className="flex flex-col gap-4">
        {cardOrder.map(key => {
          if (!cardVisibility[key as keyof typeof cardVisibility]) return null;
          
          if (key === 'tips' || key === 'offDays' || key === 'workDays') {
            return (
              <div key={key}>
                {key === 'tips' && 
${mTips ? mTips[0].replace(/{cardVisibility\.tips && \(/, '(').replace(/\)}$/, ')') : ''}
                }
                {key === 'offDays' && 
${mOff ? mOff[0].replace(/{cardVisibility\.offDays && \(/, '(').replace(/\)}$/, ')') : ''}
                }
                {key === 'workDays' && 
${mWork ? mWork[0].replace(/{cardVisibility\.workDays && \(/, '(').replace(/\)}$/, ')') : ''}
                }
              </div>
            );
          }

          if (key === 'secondaryStats') return <div key={key}>${mSec ? mSec[0].replace(/{cardVisibility\.secondaryStats && \(/, '(').replace(/\)}$/, ')') : ''}</div>;
          
          if (key === 'comparison') return <div key={key}>${mComp ? mComp[0].replace(/{cardVisibility\.comparison && \(activeTab === 'monthly' \|\| activeTab === 'yearly'\) && \(/, '(').replace(/\)}$/, ')') : ''}</div>;

          if (key === 'dailyChart') return <div key={key}>${mDaily ? mDaily[0].replace(/{activeTab !== 'daily' && cardVisibility\.dailyChart && \(/, "(").replace(/\)}$/, ')') : ''}</div>;

          if (key === 'categoryChart') return <div key={key}>${mCat ? mCat[0].replace(/{cardVisibility\.categoryChart && \(/, '(').replace(/\)}$/, ')') : ''}</div>;

          return null;
        })}
      </div>
      
      {/* Historical Overlap Line Chart */}
`;

// Extract overlapping history chart string
const rxOverlap = /{\(activeTab === 'monthly' \|\| activeTab === 'yearly'\) && rangeData\.overlappingData\?\.length > 0 && \([\s\S]*?<\/motion\.div>\s*\)}/
const matchOverlap = middleHtml.match(rxOverlap);

fs.writeFileSync(path, beforeBlock + newRender + (matchOverlap ? matchOverlap[0] : '') + "\n" + afterBlock);
console.log("Rewrite successful.");
