#!/usr/bin/env python
# Test script for Python 2/3 compatibility of syncbridge
from __future__ import print_function

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_syncbridge_import():
    """Test that syncbridge can be imported without syntax errors"""
    try:
        from syncbridge import console, print_text
        print("✓ Syncbridge import successful")
        return True
    except SyntaxError as e:
        print("✗ Syntax error importing syncbridge:", str(e))
        return False
    except Exception as e:
        print("✗ Error importing syncbridge:", str(e))
        return False

def test_console_print_text():
    """Test that console.print_text works"""
    try:
        from syncbridge import console
        console.print_text("✓ Console.print_text works")
        return True
    except Exception as e:
        print("✗ Error calling console.print_text:", str(e))
        return False

def test_global_print_text():
    """Test that global print_text function works"""
    try:
        from syncbridge import print_text
        print_text("✓ Global print_text works")
        return True
    except Exception as e:
        print("✗ Error calling global print_text:", str(e))
        return False

def test_no_print_method():
    """Test that there's no 'print' method that would cause Python 2 issues"""
    try:
        from syncbridge.sync_wrappers import ConsoleWrapper
        wrapper = ConsoleWrapper()
        if hasattr(wrapper, 'print'):
            print("✗ Found 'print' method - this would cause Python 2 SyntaxError")
            return False
        else:
            print("✓ No 'print' method found - Python 2 compatible")
            return True
    except Exception as e:
        print("✗ Error checking for print method:", str(e))
        return False

def test_javascript_changes():
    """Test that JavaScript files have been updated correctly"""
    try:
        with open('achess.js', 'r') as f:
            content = f.read()
        
        # Check that console.print has been replaced
        old_calls = content.count('console.print(')
        new_calls = content.count('console.print_text(')
        
        if old_calls > 0:
            print("✗ Found {} remaining console.print calls".format(old_calls))
            return False
        elif new_calls > 0:
            print("✓ Found {} console.print_text calls - JavaScript updated correctly".format(new_calls))
            return True
        else:
            print("? No console print calls found")
            return True
    except Exception as e:
        print("✗ Error checking JavaScript files:", str(e))
        return False

def main():
    """Run all tests"""
    print("Testing Python 2 compatibility fixes...")
    print("=" * 50)
    
    tests = [
        test_syncbridge_import,
        test_console_print_text,
        test_global_print_text,
        test_no_print_method,
        test_javascript_changes
    ]
    
    passed = 0
    for test in tests:
        if test():
            passed += 1
        print()
    
    print("=" * 50)
    print("Tests passed: {}/{}".format(passed, len(tests)))
    
    if passed == len(tests):
        print("✓ All tests passed! Python 2 compatibility fix successful.")
        return True
    else:
        print("✗ Some tests failed. Please review the issues above.")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)