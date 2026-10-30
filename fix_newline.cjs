const fs = require('fs');
const p = 'mobile/app/(app)/client/[clientId].tsx';
let s = fs.readFileSync(p, 'utf8');

// The literal bytes in the file are:  ${calLine ? '\\n\\n' + calLine : ''}
// i.e. a single-quoted string containing the two characters backslash-n twice.
// We replace that single-quoted '\\n\\n' with a real two-character newline by
// changing it to a template-free approach: use String.fromCharCode(10).
const OLD = "${calLine ? '\\\\n\\\\n' + calLine : ''}";
const NEW = "${calLine ? String.fromCharCode(10) + String.fromCharCode(10) + calLine : ''}";

if (!s.includes(OLD)) {
  console.log('OLD NOT FOUND');
  process.exit(1);
}
s = s.replace(OLD, NEW);
fs.writeFileSync(p, s);
console.log('REPLACED OK');
