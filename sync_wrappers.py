def print_text(*args, **kwargs):
    print(' '.join(map(str, args)), **kwargs)

# Override the global print function
print = print_text

# Example usage:
# print('Hello, World!')  # This will now use print_text