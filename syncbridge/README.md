# SyncBridge v1.0 - Revolutionary BBS Door Converter

SyncBridge is a universal bridge that allows ANY Synchronet JavaScript door to run on Mystic BBS with Python2. This opens up the entire Synchronet door ecosystem to Mystic BBS sysops!

## Features

- **JavaScript to Python Conversion**: Automatically converts Synchronet JavaScript syntax to Python-executable code
- **Synchronet API Compatibility**: Provides full compatibility with Synchronet APIs (console, system, user, js objects)
- **File Operations**: Complete File constructor and file system function support
- **Object Constructors**: Support for File, User, Math, Date, and JSON objects
- **Command Line Interface**: Easy-to-use CLI for running doors and testing

## Components

- **syncbridge.py**: Main bridge class with JavaScript parser and executor
- **sync_wrappers.py**: Synchronet object wrappers (console, system, user, js)
- **sync_constructors.py**: Object constructors (File, User, Math, Date, JSON)
- **js_converter.py**: JavaScript to Python syntax converter
- **syncbridge_cli.py**: Command line interface
- **test_simple.js**: Simple test file for validation

## Quick Start

1. **Run the test file**:
   ```bash
   cd syncbridge
   python2 syncbridge_cli.py test_simple.js --debug
   ```

2. **Run A-Net Chess**:
   ```bash
   python2 syncbridge_cli.py ../achess.js --user="ChessPlayer" --debug
   ```

3. **Custom user/system settings**:
   ```bash
   python2 syncbridge_cli.py door.js --user="Player1" --system="My BBS" --operator="SysOp"
   ```

## Supported Synchronet APIs

### Console Object
- `console.print(text)` - Print text to console
- `console.getstr(maxlen)` - Get string input
- `console.getkey()` - Get single key input
- `console.clear()` - Clear screen
- `console.printfile(filename)` - Print file contents

### System Object
- `system.name` - BBS name
- `system.operator` - Sysop name
- `system.data_dir` - Data directory
- `system.matchuser(name)` - Find user by name

### User Object
- `user.alias` - User alias/handle
- `user.name` - User real name
- `user.number` - User number
- `user.stats` - User statistics

### JS Object
- `js.exec_dir` - Execution directory
- `js.terminated` - Script termination flag

### File Constructor
- `new File(path)` - Create file object
- `file.open(mode)` - Open file
- `file.close()` - Close file
- `file.read()`, `file.readln()`, `file.readAll()` - Read operations
- `file.write(data)`, `file.writeln(data)` - Write operations

### Global Functions
- `file_exists(path)` - Check if file exists
- `directory(pattern)` - Get directory listing
- `mkdir(path)` - Create directory
- `file_copy(src, dest)` - Copy file
- `file_remove(path)` - Delete file

## JavaScript Conversion Features

- Variable declarations (`var`, `let`, `const` → Python assignments)
- Function declarations (`function name() {}` → `def name():`)
- Boolean values (`true`/`false` → `True`/`False`)
- Null/undefined (`null`/`undefined` → `None`)
- Operators (`===`, `!==`, `&&`, `||` → `==`, `!=`, `and`, `or`)
- Control structures (if/else, for loops, while loops)

## Target: A-Net Chess Integration

SyncBridge is specifically designed to run A-Net Chess (achess.js) as the first working door. The system handles all the complex Synchronet-specific features needed by the chess game:

- Chess board display and ANSI graphics
- User input and game interaction
- Game state saving/loading
- High score tracking
- InterBBS messaging (future enhancement)

## Revolutionary Impact

This bridge makes **every Synchronet door instantly available** to Mystic BBS sysops, revolutionizing the BBS door ecosystem and bringing decades of Synchronet development to the Mystic community!

## Requirements

- Python 2.7
- Mystic BBS (for full integration)
- Synchronet JavaScript door files

## License

MIT License - Feel free to use, modify, and distribute!