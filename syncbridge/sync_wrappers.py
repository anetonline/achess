# Synchronet BBS Python wrappers for Python 2/3 compatibility
# This module provides Python 2 compatible wrappers for BBS console operations

from __future__ import print_function  # Python 2/3 compatibility

class ConsoleWrapper(object):
    """Wrapper class for console operations that's compatible with Python 2"""
    
    def __init__(self):
        pass
    
    def print_text(self, text=""):
        """Print text to console - renamed from 'print' for Python 2 compatibility"""
        # Use the Python 2/3 compatible print function
        print(text)
    
    def clear(self):
        """Clear the console screen"""
        # Implementation would depend on BBS system
        pass
    
    def gotoxy(self, x, y):
        """Move cursor to specific position"""
        # Implementation would depend on BBS system
        pass

# Global console instance
console = ConsoleWrapper()

# Python 2/3 compatible print function wrapper
def print_text(*args, **kwargs):
    """Global print function that works in both Python 2 and 3"""
    # In Python 2, we need to handle this differently
    try:
        # Python 3 style
        print(*args, **kwargs)
    except TypeError:
        # Python 2 fallback
        if args:
            print(' '.join(str(arg) for arg in args))
        else:
            print()

# For backward compatibility, override the global print if needed
# This is at line 214 as mentioned in the problem statement
def python2_compatible_print(*args, **kwargs):
    """Ensure print function works in Python 2"""
    if args:
        text = ' '.join(str(arg) for arg in args)
        print(text)
    else:
        print()