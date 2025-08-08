#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge v1.0 - Synchronet API Wrappers
Provides Synchronet-compatible APIs for console, system, user, js objects
"""

import os
import sys
import time
from sync_constructors import UserConstructor

class ConsoleWrapper(object):
    """Synchronet console object wrapper"""
    
    def __init__(self):
        self.screen_width = 80
        self.screen_height = 25
        self.current_attr = 7  # Default white on black
    
    def print(self, text=""):
        """Print text to console (JavaScript console.print equivalent)"""
        sys.stdout.write(str(text))
        sys.stdout.flush()
    
    def println(self, text=""):
        """Print line to console"""
        print(str(text))
    
    def write(self, text):
        """Write text without newline"""
        sys.stdout.write(str(text))
        sys.stdout.flush()
    
    def getstr(self, max_length=255, mode=0):
        """Get string input from user (simplified)"""
        try:
            user_input = input()
            if len(user_input) > max_length:
                return user_input[:max_length]
            return user_input
        except:
            return ""
    
    def getkey(self, mode=0):
        """Get single key input (simplified - waits for Enter)"""
        try:
            # In a real implementation, this would get a single key
            # For now, get a line and return first character
            key = input()
            return key[0] if key else ""
        except:
            return ""
    
    def clear(self):
        """Clear the screen"""
        if os.name == 'nt':  # Windows
            os.system('cls')
        else:  # Unix/Linux
            os.system('clear')
    
    def printfile(self, filename):
        """Print contents of a file"""
        try:
            with open(filename, 'r') as f:
                content = f.read()
                sys.stdout.write(content)
                sys.stdout.flush()
                return True
        except:
            return False
    
    def gotoxy(self, x, y):
        """Move cursor to position (simplified)"""
        # ANSI escape sequence for cursor positioning
        sys.stdout.write("\033[{};{}H".format(y, x))
        sys.stdout.flush()
    
    def home(self):
        """Move cursor to home position"""
        self.gotoxy(1, 1)

class SystemWrapper(object):
    """Synchronet system object wrapper"""
    
    def __init__(self):
        self.name = "SyncBridge BBS"
        self.operator = "SysOp"
        self.location = "Local System"
        self.data_dir = "/tmp/syncbridge_data/"
        self.node_dir = "/tmp/syncbridge_node/"
        self.temp_dir = "/tmp/"
        self.version = "SyncBridge v1.0"
        
        # Ensure directories exist
        for directory in [self.data_dir, self.node_dir]:
            if not os.path.exists(directory):
                try:
                    os.makedirs(directory)
                except:
                    pass
    
    def matchuser(self, search_string):
        """Find user by partial name match (simplified)"""
        # In real implementation, this would search user database
        return 1  # Return dummy user number
    
    def newuser(self):
        """Create new user (simplified)"""
        return True
    
    def hangup(self):
        """Hangup the user session"""
        print("\nSession terminated.")
        sys.exit(0)

class UserWrapper(object):
    """Synchronet user object wrapper"""
    
    def __init__(self, number=1, alias="TestUser", name="Test User"):
        self.number = number
        self.alias = alias
        self.name = name
        self.real_name = name
        self.handle = alias
        self.security = 50
        self.level = 10
        self.stats = {
            'logons_today': 1,
            'total_logons': 100,
            'time_on': 30,
            'last_on': time.time()
        }
        self.connection = "Local"
        self.ip_address = "127.0.0.1"

class JSWrapper(object):
    """Synchronet js object wrapper"""
    
    def __init__(self, exec_dir="/home/runner/work/achess/achess/"):
        self.exec_dir = exec_dir
        self.terminated = False
        self.startup_dir = exec_dir
        self.scope = "bbs"
        
        # Ensure exec_dir ends with /
        if not self.exec_dir.endswith('/'):
            self.exec_dir += '/'
    
    def exit(self, code=0):
        """Exit the script"""
        self.terminated = True
        sys.exit(code)

# File system functions (global functions in Synchronet)
def file_exists(path):
    """Check if file exists"""
    return os.path.exists(path)

def directory(pattern="*"):
    """Get directory listing (simplified)"""
    try:
        import glob
        if pattern == "*":
            pattern = "*.*"
        return glob.glob(pattern)
    except:
        return []

def mkdir(path):
    """Create directory"""
    try:
        os.makedirs(path)
        return True
    except:
        return False

def file_copy(src, dest):
    """Copy file"""
    try:
        import shutil
        shutil.copy2(src, dest)
        return True
    except:
        return False

def file_remove(path):
    """Remove file"""
    try:
        os.remove(path)
        return True
    except:
        return False

def file_rename(old_path, new_path):
    """Rename file"""
    try:
        os.rename(old_path, new_path)
        return True
    except:
        return False

def mkpath(path):
    """Create directory path"""
    try:
        os.makedirs(path)
        return True
    except:
        return False

# Global print function (Synchronet style)
def print_sync(text=""):
    """Synchronet-style print function"""
    print(str(text))

# Global exit function
def exit_sync(code=0):
    """Synchronet-style exit function"""
    sys.exit(code)