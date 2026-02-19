
const fs = require('fs');
const path = require('path');

function checkFile(filename) {
    try {
        const content = fs.readFileSync(filename, 'utf8');
        const stack = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if ('{[('.includes(char)) {
                    stack.push({ char, line: i + 1, col: j + 1 });
                } else if ('}])'.includes(char)) {
                    if (stack.length === 0) {
                        console.log(`${filename}:${i + 1}:${j + 1}: Error: Unexpected closing '${char}'`);
                        return;
                    }
                    const last = stack.pop();
                    const expected = char === '}' ? '{' : char === ']' ? '[' : '(';
                    if (last.char !== expected) {
                        console.log(`${filename}:${i + 1}:${j + 1}: Error: Mismatched '${char}', expected closing for '${last.char}' from line ${last.line}`);
                        return;
                    }
                }
            }
        }

        if (stack.length > 0) {
            const last = stack[stack.length - 1];
            console.log(`${filename}:${last.line}:${last.col}: Error: Unclosed '${last.char}'`);
        } else {
            console.log(`${filename}: OK (Braces balanced)`);
        }

    } catch (e) {
        console.error(`Error reading ${filename}: ${e.message}`);
    }
}

const files = process.argv.slice(2);
if (files.length === 0) {
    console.log("Usage: node check_braces.js <file1> <file2> ...");
    process.exit(1);
}

files.forEach(checkFile);
