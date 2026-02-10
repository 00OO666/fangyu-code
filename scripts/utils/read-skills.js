const fs = require('fs');
const path = require('path');

const skillsDir = 'C:/Users/666/.claude/skills';
const outputDir = 'F:/Fangyu-Code-Dev/temp-skills';

// Create output directory
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Copy all skills
const skills = fs.readdirSync(skillsDir);
skills.forEach(skill => {
    const skillPath = path.join(skillsDir, skill);
    const destPath = path.join(outputDir, skill);
    
    if (fs.statSync(skillPath).isDirectory()) {
        fs.cpSync(skillPath, destPath, { recursive: true });
        console.log(`Copied: ${skill}`);
    } else {
        fs.copyFileSync(skillPath, destPath);
        console.log(`Copied file: ${skill}`);
    }
});

console.log('\nDone! Skills copied to:', outputDir);
