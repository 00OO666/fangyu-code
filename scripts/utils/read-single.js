const fs = require('fs');
const content = fs.readFileSync('C:/Users/666/.claude/skills/fangyu-code-dev/skill.md', 'utf8');
fs.writeFileSync('F:/Fangyu-Code-Dev/fangyu-code-dev-skill.md', content);
console.log('Done');
