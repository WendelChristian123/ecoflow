
const fs = require('fs');
const filename = 'c:/ecoflow-saas/ecoflow/components/Modals.tsx';

try {
    const content = fs.readFileSync(filename, 'utf-8');
    const lines = content.split('\n');

    let startLine = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('export const EventDetailModal')) {
            startLine = i;
            break;
        }
    }

    console.log(`Checking starting from line ${startLine + 1}`);

    const stack = [];
    const tagRegex = /<\/?(\w+)[^>]*\/?>/g;

    for (let i = startLine; i < lines.length; i++) {
        let line = lines[i];
        // simple string removal
        line = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");

        let match;
        while ((match = tagRegex.exec(line)) !== null) {
            const tagStr = match[0];
            const tagName = match[1];

            if (tagName !== 'div' && tagName !== 'Modal') continue;

            const isClosing = tagStr.startsWith('</');
            const isSelfClosing = tagStr.endsWith('/>');

            if (isSelfClosing) continue;

            if (isClosing) {
                if (stack.length === 0) {
                    console.log(`Line ${i + 1}: Orphan closing tag </${tagName}>`);
                    process.exit(1);
                }
                const last = stack.pop();
                if (last !== tagName) {
                    console.log(`Line ${i + 1}: Mismatch. Expected </${last}> but found </${tagName}> (Stack: ${[...stack, last].join(', ')})`);
                    process.exit(1);
                }
            } else {
                stack.push(tagName);
            }
        }
    }

    if (stack.length > 0) {
        console.log(`End of file: Unclosed tags: ${stack.join(', ')}`);
    } else {
        console.log("Balance Check Passed.");
    }

} catch (e) {
    console.error(e);
}
