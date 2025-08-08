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
        # Convert var, let, const declarations
        code = re.sub(r'\b(?:var|let|const)\s+(\w+)\s*=', r'\1 =', code)
        code = re.sub(r'\b(?:var|let|const)\s+(\w+)(?:\s*;|\s*$)', r'\1 = None', code, flags=re.MULTILINE)
        return code
    
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
        # Convert for loops
        code = re.sub(r'for\s*\(\s*var\s+(\w+)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)\s*{',
                     r'for \1 in range(\2, \3):  # Original: \4', code)
        
        # Convert while loops
        code = re.sub(r'while\s*\(([^)]+)\)\s*{', r'while \1:', code)
        
        # Convert if statements with opening brace
        code = re.sub(r'if\s*\(([^)]+)\)\s*{', r'if \1:', code)
        code = re.sub(r'}\s*else\s*if\s*\(([^)]+)\)\s*{', r'elif \1:', code)
        code = re.sub(r'}\s*else\s*{', r'else:', code)
        
        # Handle parentheses in if statements without braces
        code = re.sub(r'if\s*\(([^)]+)\)', r'if \1:', code)
        
        # Remove standalone closing braces and replace with pass if needed
        lines = code.split('\n')
        processed_lines = []
        indent_level = 0
        
        for line in lines:
            stripped = line.strip()
            
            # Track indentation for control structures
            if stripped.endswith(':'):
                indent_level += 4
                processed_lines.append(line)
            elif stripped == '}' or stripped == '':
                # End of block - reduce indent and add pass if needed
                if indent_level > 0:
                    indent_level -= 4
                # Skip empty braces
                if stripped == '}':
                    continue
                processed_lines.append(line)
            else:
                # Regular line - add proper indentation if needed
                if indent_level > 0 and not line.startswith(' '):
                    line = ' ' * indent_level + line
                processed_lines.append(line)
        
        return '\n'.join(processed_lines)
    
    def _convert_literals(self, code):
        """Convert JavaScript array/object literals to Python"""
        # Note: This is a simplified conversion
        # Arrays [...] can stay mostly the same
        # Objects {...} need more complex conversion to dictionaries
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