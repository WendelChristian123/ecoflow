
import sys

def check_file(filename):
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filename}: {e}")
        return

    stack = []
    lines = content.splitlines()
    
    for i, line in enumerate(lines):
        for j, char in enumerate(line):
            if char in '{[(':
                stack.append((char, i + 1, j + 1))
            elif char in '}])':
                if not stack:
                    print(f"{filename}:{i+1}:{j+1}: Error: Unexpected closing '{char}'")
                    return
                last_char, last_line, last_col = stack.pop()
                expected = '{' if char == '}' else '[' if char == ']' else '('
                if last_char != expected:
                    print(f"{filename}:{i+1}:{j+1}: Error: Mismatched '{char}', expected closing for '{last_char}' from line {last_line}")
                    return

    if stack:
        last_char, last_line, last_col = stack[-1]
        print(f"{filename}:{last_line}:{last_col}: Error: Unclosed '{last_char}'")
    else:
        print(f"{filename}: OK (Braces balanced)")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python check_braces.py <file1> <file2> ...")
        sys.exit(1)
    
    for filename in sys.argv[1:]:
        check_file(filename)
