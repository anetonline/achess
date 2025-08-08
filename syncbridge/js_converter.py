#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge v1.0 - JavaScript to Python Converter
Converts Synchronet JavaScript syntax to Python-executable code
"""

import re

class JSConverter(object):
    """Converts JavaScript syntax to Python syntax"""
    
    def __init__(self):
        self.debug = False
    
    def convert_js_to_python(self, js_code):
        """Convert JavaScript code to Python-compatible code"""
        if self.debug:
            print("Converting JavaScript to Python...")
        
        # Start with the original code
        py_code = js_code
        
        # Remove semicolons at end of lines
        py_code = self._remove_semicolons(py_code)
        
        # Convert new keyword
        py_code = self._convert_new_keyword(py_code)
        
        # Convert variable declarations
        py_code = self._convert_variables(py_code)
        
        # Convert functions
        py_code = self._convert_functions(py_code)
        
        # Convert boolean values
        py_code = self._convert_booleans(py_code)
        
        # Convert null/undefined
        py_code = self._convert_null_undefined(py_code)
        
        # Convert operators
        py_code = self._convert_operators(py_code)
        
        # Convert control structures
        py_code = self._convert_control_structures(py_code)
        
        # Convert array/object literals
        py_code = self._convert_literals(py_code)
        
        # Convert typeof operator
        py_code = self._convert_typeof(py_code)
        
        # Convert string concatenation
        py_code = self._convert_string_concat(py_code)
        
        if self.debug:
            print("Conversion completed")
        
        return py_code
    
    def _remove_semicolons(self, code):
        """Remove semicolons at end of lines"""
        lines = code.split('\n')
        processed_lines = []
        for line in lines:
            # Remove trailing semicolon if it exists
            stripped = line.rstrip()
            if stripped.endswith(';'):
                stripped = stripped[:-1]
            processed_lines.append(stripped)
        return '\n'.join(processed_lines)
    
    def _convert_new_keyword(self, code):
        """Convert new keyword to Python constructor calls"""
        # Convert new Constructor() to Constructor()
        code = re.sub(r'\bnew\s+(\w+)\s*\(', r'\1(', code)
        return code
    
    def _convert_string_concat(self, code):
        """Convert JavaScript string concatenation to Python"""
        # This is a simplified approach - handle basic + concatenation
        # More complex cases would need a proper parser
        return code
    
    def _convert_variables(self, code):
        """Convert var/let/const declarations to Python assignments"""
        lines = code.split('\n')
        processed_lines = []
        
        for line in lines:
            # Handle multiple variable declarations in one line
            if re.match(r'\s*(?:var|let|const)\s+\w+\s*=', line):
                # Check for multiple declarations separated by commas
                if ',' in line and '=' in line:
                    # Split on commas but be careful about commas inside strings/function calls
                    # This is a simplified approach
                    var_match = re.match(r'\s*(?:var|let|const)\s+(.*)', line)
                    if var_match:
                        declarations = var_match.group(1)
                        # Simple split on comma (doesn't handle complex cases)
                        parts = []
                        current_part = ""
                        paren_count = 0
                        in_string = False
                        quote_char = None
                        
                        for char in declarations:
                            if char in ['"', "'"] and not in_string:
                                in_string = True
                                quote_char = char
                            elif char == quote_char and in_string:
                                in_string = False
                                quote_char = None
                            elif char == '(' and not in_string:
                                paren_count += 1
                            elif char == ')' and not in_string:
                                paren_count -= 1
                            elif char == ',' and not in_string and paren_count == 0:
                                parts.append(current_part.strip())
                                current_part = ""
                                continue
                            
                            current_part += char
                        
                        if current_part.strip():
                            parts.append(current_part.strip())
                        
                        # Convert each part to a separate Python assignment
                        for part in parts:
                            if '=' in part:
                                processed_lines.append(part)
                            else:
                                processed_lines.append(part + ' = None')
                        continue
                else:
                    # Single variable declaration
                    line = re.sub(r'\b(?:var|let|const)\s+(\w+)\s*=', r'\1 =', line)
                    line = re.sub(r'\b(?:var|let|const)\s+(\w+)(?:\s*$)', r'\1 = None', line)
            
            processed_lines.append(line)
        
        return '\n'.join(processed_lines)
    
    def _convert_functions(self, code):
        """Convert JavaScript function syntax to Python"""
        # Convert function declarations: function name() { ... }
        code = re.sub(r'function\s+(\w+)\s*\((.*?)\)\s*{', r'def \1(\2):', code)
        
        # Convert anonymous functions: function() { ... }
        code = re.sub(r'function\s*\((.*?)\)\s*{', r'lambda \1:', code)
        
        # Convert arrow functions: () => { ... }
        code = re.sub(r'\((.*?)\)\s*=>\s*{', r'lambda \1:', code)
        
        return code
    
    def _convert_booleans(self, code):
        """Convert JavaScript boolean values to Python"""
        code = re.sub(r'\btrue\b', 'True', code)
        code = re.sub(r'\bfalse\b', 'False', code)
        return code
    
    def _convert_null_undefined(self, code):
        """Convert null and undefined to None"""
        code = re.sub(r'\bnull\b', 'None', code)
        code = re.sub(r'\bundefined\b', 'None', code)
        return code
    
    def _convert_operators(self, code):
        """Convert JavaScript operators to Python equivalents"""
        # Convert === and !== to == and !=
        code = re.sub(r'===', '==', code)
        code = re.sub(r'!==', '!=', code)
        
        # Convert && and || to and and or
        code = re.sub(r'\s&&\s', ' and ', code)
        code = re.sub(r'\s\|\|\s', ' or ', code)
        
        # Convert ++ and -- operators (basic cases)
        code = re.sub(r'(\w+)\+\+', r'\1 += 1', code)
        code = re.sub(r'(\w+)--', r'\1 -= 1', code)
        code = re.sub(r'\+\+(\w+)', r'\1 += 1', code)
        code = re.sub(r'--(\w+)', r'\1 -= 1', code)
        
        return code
    
    def _convert_control_structures(self, code):
        """Convert JavaScript control structures to Python"""
        lines = code.split('\n')
        processed_lines = []
        indent_level = 0
        
        for line in lines:
            original_line = line
            stripped = line.strip()
            
            # Convert for loops with proper handling
            for_match = re.match(r'(\s*)for\s*\(\s*var\s+(\w+)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)\s*{?', stripped)
            if for_match:
                indent, var_name, start, condition, increment = for_match.groups()
                
                # Extract the limit from condition (simple case: var < limit)
                condition_match = re.match(r'(\w+)\s*<\s*(.+)', condition.strip())
                if condition_match:
                    limit = condition_match.group(2)
                    processed_lines.append('{}for {} in range({}, {}):'.format(indent, var_name, start, limit))
                    indent_level += 4
                    continue
            
            # Convert for loops without var declaration
            for_match2 = re.match(r'(\s*)for\s*\(\s*(\w+)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)\s*{?', stripped)
            if for_match2:
                indent, var_name, start, condition, increment = for_match2.groups()
                
                # Extract the limit from condition
                condition_match = re.match(r'(\w+)\s*<\s*(.+)', condition.strip())
                if condition_match:
                    limit = condition_match.group(2)
                    processed_lines.append('{}for {} in range({}, {}):'.format(indent, var_name, start, limit))
                    indent_level += 4
                    continue
            
            # Convert while loops
            while_match = re.match(r'(\s*)while\s*\(([^)]+)\)\s*{?', stripped)
            if while_match:
                indent, condition = while_match.groups()
                processed_lines.append('{}while {}:'.format(indent, condition))
                indent_level += 4
                continue
            
            # Convert if statements
            if_match = re.match(r'(\s*)if\s*\(([^)]+)\)\s*{?', stripped)
            if if_match:
                indent, condition = if_match.groups()
                processed_lines.append('{}if {}:'.format(indent, condition))
                indent_level += 4
                continue
            
            # Convert else if
            elif_match = re.match(r'(\s*)}\s*else\s*if\s*\(([^)]+)\)\s*{?', stripped)
            if elif_match:
                indent, condition = elif_match.groups()
                if indent_level > 0:
                    indent_level -= 4
                processed_lines.append('{}elif {}:'.format(indent, condition))
                indent_level += 4
                continue
            
            # Convert else
            else_match = re.match(r'(\s*)}\s*else\s*{?', stripped)
            if else_match:
                indent = else_match.group(1)
                if indent_level > 0:
                    indent_level -= 4
                processed_lines.append('{}else:'.format(indent))
                indent_level += 4
                continue
            
            # Skip standalone closing braces
            if stripped == '}':
                if indent_level > 0:
                    indent_level -= 4
                continue
            
            # Handle regular lines with proper indentation
            if stripped and not stripped.startswith('#'):
                # If we're in an indented block and line doesn't start with whitespace
                if indent_level > 0 and not line.startswith(' '):
                    line = ' ' * indent_level + line.lstrip()
            
            processed_lines.append(line)
        
        return '\n'.join(processed_lines)
    
    def _convert_literals(self, code):
        """Convert JavaScript array/object literals to Python"""
        # Convert object literals {} to dictionaries
        # This is a simplified conversion for basic cases
        
        # Convert simple object literals like { key: value, key2: value2 }
        # This regex handles simple cases only
        code = re.sub(r'\{\s*(\w+):\s*([^,}]+)\s*\}', r'{\1: \2}', code)
        
        # Fix object property access
        code = re.sub(r'Object\.keys\(([^)]+)\)', r'list(\1.keys())', code)
        
        return code
    
    def _convert_typeof(self, code):
        """Convert typeof operator to Python type checking"""
        code = re.sub(r'typeof\s+(\w+)', r'type(\1).__name__', code)
        return code
    
    def convert_require_load(self, js_code):
        """Convert require() and load() statements to Python imports"""
        lines = js_code.split('\n')
        converted_lines = []
        
        for line in lines:
            # Convert require statements
            if 'require(' in line:
                # Extract the module name and convert to Python import
                match = re.search(r'require\(["\']([^"\']+)["\'](?:,\s*["\']([^"\']+)["\'])?\)', line)
                if match:
                    module_path = match.group(1)
                    class_name = match.group(2) if match.group(2) else None
                    # Convert to Python import (simplified)
                    if class_name:
                        converted_lines.append('# Imported: {} from {}'.format(class_name, module_path))
                    else:
                        converted_lines.append('# Imported: {}'.format(module_path))
                    continue
            
            # Convert load statements
            if 'load(' in line:
                match = re.search(r'load\(["\']([^"\']+)["\']', line)
                if match:
                    module_path = match.group(1)
                    converted_lines.append('# Loaded: {}'.format(module_path))
                    continue
            
            converted_lines.append(line)
        
        return '\n'.join(converted_lines)