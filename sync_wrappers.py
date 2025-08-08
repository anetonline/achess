import sys

class ConsoleWrapper(object):
    """
    Python 2 compatible console wrapper for JavaScript-to-Python conversion.
    Provides console.print() functionality similar to JavaScript console API.
    """
    
    def print_text(self, *args):
        """
        Print text to stdout with space separation, compatible with Python 2.
        Equivalent to JavaScript console.print() method.
        """
        if args:
            message = ' '.join(str(arg) for arg in args)
            sys.stdout.write(message)
        sys.stdout.flush()
    
    def print(self, *args):
        """
        Alternative print method for compatibility with different conversion patterns.
        """
        self.print_text(*args)

# Create global console instance for JavaScript-to-Python conversions
console = ConsoleWrapper()

# Backward compatibility function for direct print_text calls
def print_text(*args):
    """Backward compatible print_text function for Python 2."""
    if args:
        message = ' '.join(str(arg) for arg in args)
        sys.stdout.write(message)
    sys.stdout.flush()