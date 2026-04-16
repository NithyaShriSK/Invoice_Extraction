#!/usr/bin/env python3
"""Patch deep.py to handle nested BUYER/SELLER GSTIN structure."""

import re

with open('deep.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the final_cleanup function and inject nested GSTIN handling
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # When we find the final_cleanup function
    if 'def final_cleanup(data):' in line:
        new_lines.append(line)
        i += 1
        
        # Skip until we find the "# 1. Fix Seller & Buyer GSTIN" comment
        while i < len(lines) and '# 1. Fix Seller & Buyer GSTIN' not in lines[i]:
            new_lines.append(lines[i])
            i += 1
        
        # Add the comment
        new_lines.append(lines[i])  # "# 1. Fix Seller & Buyer GSTIN"
        i += 1
        
        # Insert nested GSTIN handling BEFORE the for loop
        nested_handler = '''    # Handle nested structure: Buyer/Seller.GSTIN
    if isinstance(data.get('Buyer'), dict) and 'GSTIN' in data['Buyer']:
        val = str(data['Buyer']['GSTIN']).strip()
        if val:
            repaired = universal_gstin_repair(val)
            corrected = correct_gstin(repaired if repaired else val, force_state_code="33")
            data['Buyer']['GSTIN'] = corrected if corrected else re.sub(r'[^A-Za-z0-9]', '', val.upper())
            print(f"  [BUYER GSTIN FIXED] '{val}' → '{data['Buyer']['GSTIN']}'")
    
    if isinstance(data.get('Seller'), dict) and 'GSTIN' in data['Seller']:
        val = str(data['Seller']['GSTIN']).strip()
        if val:
            repaired = universal_gstin_repair(val)
            corrected = correct_gstin(repaired if repaired else val, force_state_code="33")
            data['Seller']['GSTIN'] = corrected if corrected else re.sub(r'[^A-Za-z0-9]', '', val.upper())
            print(f"  [SELLER GSTIN FIXED] '{val}' → '{data['Seller']['GSTIN']}'")

'''
        new_lines.append(nested_handler)
        
        # Continue with rest of function
    else:
        new_lines.append(line)
        i += 1

with open('deep.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✓ deep.py patched: final_cleanup now handles nested BUYER/SELLER GSTIN")
