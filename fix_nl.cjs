const fs = require('fs');
const p = 'mobile/app/(app)/client/[clientId].tsx';
let s = fs.readFileSync(p, 'utf8');

// The file currently has, inside single quotes: \\n\\n  (i.e. backslash backslash n, twice)
// which JS evaluates to the literal two characters "\n". We want \n\n (single backslash
// + n, twice) so JS evaluates to actual newlines.
// Current raw chars between the quotes: 92,92,110,92,92,110  ("\\n\\n")
// Wanted raw chars:                    92,110,92,110        ("\n\n")
const cur = "'" + String.fromCharCode(92,92,110,92,92,110) + "' + calLine";
const want = "'" + String.fromCharCode(92,110,92,110) + "' + calLine";

if (!s.includes(cur)) {
  console.log('CUR NOT FOUND');
  process.exit(1);
}
s = s.split(cur).join(want);
fs.writeFileSync(p, s);
console.log('FIXED');
