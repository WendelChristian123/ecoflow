
const fs = require('fs');
const files = [
    { path: 'pages/SuperAdmin/Dashboard.tsx', lines: 502 },
    { path: 'pages/SuperAdmin/Tenants.tsx', lines: 467 }
];

files.forEach(f => {
    try {
        const content = fs.readFileSync(f.path, 'utf8');
        // Handle CRLF or LF
        const lines = content.split(/\r?\n/);
        const newContent = lines.slice(0, f.lines).join('\n');
        fs.writeFileSync(f.path, newContent);
        console.log(`Truncated ${f.path} to ${f.lines} lines.`);
    } catch (e) {
        console.error(`Error processing ${f.path}: ${e.message}`);
    }
});
