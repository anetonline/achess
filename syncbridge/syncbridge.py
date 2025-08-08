#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge v1.0 - Main Bridge Class
JavaScript file parser and executor with Synchronet object compatibility
"""

import os
import sys
import re
import traceback

# Import our bridge components
from js_converter import JSConverter
from sync_wrappers import (
    ConsoleWrapper, SystemWrapper, UserWrapper, JSWrapper,
    file_exists, directory, mkdir, file_copy, file_remove, 
    file_rename, mkpath, print_sync, exit_sync
)
from sync_constructors import (
    FileConstructor, UserConstructor, MathWrapper, 
    DateWrapper, JSONWrapper
)

class SyncBridge(object):
    """Main bridge class for running Synchronet JavaScript on Mystic BBS"""
    
    def __init__(self, debug=False):
        self.debug = debug
        self.js_converter = JSConverter()
        self.js_converter.debug = debug
        self.global_scope = {}
        self.setup_global_scope()
    
    def setup_global_scope(self):
        """Setup global scope with Synchronet objects and functions"""
        
        # Create Synchronet objects
        console = ConsoleWrapper()
        system = SystemWrapper()
        user = UserWrapper()
        js = JSWrapper()
        
        # Setup global scope
        self.global_scope = {
            # Synchronet objects
            'console': console,
            'system': system,
            'user': user,
            'js': js,
            
            # Constructors
            'File': FileConstructor,
            'User': UserConstructor,
            'Math': MathWrapper,
            'Date': DateWrapper,
            'JSON': JSONWrapper,
            
            # Global functions
            'print': print_sync,
            'exit': exit_sync,
            'file_exists': file_exists,
            'directory': directory,
            'mkdir': mkdir,
            'file_copy': file_copy,
            'file_remove': file_remove,
            'file_rename': file_rename,
            'mkpath': mkpath,
            
            # JavaScript built-ins
            'parseInt': int,
            'parseFloat': float,
            'isNaN': lambda x: str(x).lower() == 'nan',
            'Number': float,
            'String': str,
            'Boolean': bool,
            'Array': list,
            'Object': dict,
            
            # Synchronet require/load functions (simplified)
            'require': self._mock_require,
            'load': self._mock_load,
            
            # Common variables
            'argc': 0,
            'argv': [],
            
            # Python built-ins we want available
            'len': len,
            'range': range,
            'str': str,
            'int': int,
            'float': float,
            'bool': bool,
            'list': list,
            'dict': dict,
            
            # Module imports
            'os': os,
            'sys': sys,
            're': re,
            'time': __import__('time'),
            'random': __import__('random'),
            'json': __import__('json'),
        }
        
        if self.debug:
            print("Global scope initialized with {} objects".format(len(self.global_scope)))
    
    def _mock_require(self, module_path, class_name=None):
        """Mock require function - simplified implementation"""
        if self.debug:
            print("Mock require: {} (class: {})".format(module_path, class_name))
        
        # For now, return a mock object
        if class_name:
            return type(class_name, (), {})
        return {}
    
    def _mock_load(self, module_path):
        """Mock load function - simplified implementation"""
        if self.debug:
            print("Mock load: {}".format(module_path))
        
        # For now, just log the load attempt
        return True
    
    def load_js_file(self, js_file_path):
        """Load and parse JavaScript file"""
        if not os.path.exists(js_file_path):
            raise IOError("JavaScript file not found: {}".format(js_file_path))
        
        if self.debug:
            print("Loading JavaScript file: {}".format(js_file_path))
        
        with open(js_file_path, 'r') as f:
            js_content = f.read()
        
        return js_content
    
    def preprocess_js(self, js_code):
        """Preprocess JavaScript code before conversion"""
        if self.debug:
            print("Preprocessing JavaScript code...")
        
        # Remove single-line comments (but preserve URLs and strings)
        lines = js_code.split('\n')
        processed_lines = []
        
        for line in lines:
            # Skip empty lines and pure comment lines
            stripped = line.strip()
            if not stripped or stripped.startswith('//'):
                processed_lines.append('# ' + stripped[2:] if stripped.startswith('//') else '')
                continue
            
            # Handle inline comments (simple approach)
            if '//' in line:
                # Find comment position (not in strings)
                in_string = False
                quote_char = None
                for i, char in enumerate(line):
                    if char in ['"', "'"]:
                        if not in_string:
                            in_string = True
                            quote_char = char
                        elif char == quote_char:
                            in_string = False
                    elif char == '/' and i + 1 < len(line) and line[i + 1] == '/' and not in_string:
                        line = line[:i] + '  # ' + line[i + 2:]
                        break
            
            processed_lines.append(line)
        
        return '\n'.join(processed_lines)
    
    def execute_js(self, js_code, js_file_path=None):
        """Execute JavaScript code in Python environment"""
        try:
            if self.debug:
                print("Starting JavaScript execution...")
            
            # Set up js.exec_dir if we have a file path
            if js_file_path:
                exec_dir = os.path.dirname(os.path.abspath(js_file_path)) + '/'
                self.global_scope['js'].exec_dir = exec_dir
                self.global_scope['js'].startup_dir = exec_dir
            
            # Preprocess the JavaScript
            preprocessed_js = self.preprocess_js(js_code)
            
            # Convert require/load statements
            converted_imports = self.js_converter.convert_require_load(preprocessed_js)
            
            # Convert JavaScript syntax to Python
            python_code = self.js_converter.convert_js_to_python(converted_imports)
            
            if self.debug:
                print("Converted Python code (first 500 chars):")
                print(python_code[:500])
                print("..." if len(python_code) > 500 else "")
            
            # Execute the converted code
            exec(python_code, self.global_scope)
            
            if self.debug:
                print("JavaScript execution completed successfully")
            
        except SystemExit:
            # Normal exit
            if self.debug:
                print("Script exited normally")
            
        except Exception as e:
            print("Error executing JavaScript code:")
            print("Exception: {}".format(str(e)))
            if self.debug:
                print("Traceback:")
                traceback.print_exc()
            raise
    
    def run_js_file(self, js_file_path):
        """Load and execute a JavaScript file"""
        if self.debug:
            print("Running JavaScript file: {}".format(js_file_path))
        
        js_code = self.load_js_file(js_file_path)
        self.execute_js(js_code, js_file_path)
    
    def set_user(self, alias="TestUser", name="Test User", number=1):
        """Set the current user"""
        self.global_scope['user'] = UserWrapper(number, alias, name)
        if self.debug:
            print("User set: {} ({})".format(alias, number))
    
    def set_system(self, name="SyncBridge BBS", operator="SysOp"):
        """Set system information"""
        self.global_scope['system'].name = name
        self.global_scope['system'].operator = operator
        if self.debug:
            print("System set: {} (operator: {})".format(name, operator))