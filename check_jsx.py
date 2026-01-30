
import re

def check_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    # Simplified regex for tags
    # Matches <Tag ...> or </Tag> or <Tag ... />
    # We care about div and Modal
    tag_re = re.compile(r'<\/?(\w+)[^>]*\/?>')
    
    # We only care about the last component: EventDetailModal
    # Find start line
    start_line = 0
    for i, line in enumerate(lines):
        if 'export const EventDetailModal' in line:
            start_line = i
            break
            
    print(f"Checking starting from line {start_line + 1}")

    for i in range(start_line, len(lines)):
        line = lines[i]
        # remove strings to avoid false positives (simple approach)
        line_clean = re.sub(r'"[^"]*"', '""', line)
        line_clean = re.sub(r"'[^']*'", "''", line_clean)
        
        # Find all tags
        for match in tag_re.finditer(line_clean):
            tag_str = match.group(0)
            tag_name = match.group(1)
            
            # Focus on Modal and div structure
            if tag_name not in ['div', 'Modal']:
                continue 
                
            is_closing = tag_str.startswith('</')
            is_self_closing = tag_str.endswith('/>')
            
            if is_self_closing:
                continue

            if is_closing:
                if not stack:
                    print(f"Line {i+1}: Orphan closing tag </{tag_name}>")
                    return
                
                last = stack.pop()
                if last != tag_name:
                    print(f"Line {i+1}: Mismatch. Expected </{last}> but found </{tag_name}> (Stack: {stack + [last]})")
                    return
            else:
                stack.append(tag_name)
    
    if stack:
        print(f"End of file: Unclosed tags: {stack}")

check_balance('c:/ecoflow-saas/ecoflow/components/Modals.tsx')
