#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge v1.0 - Synchronet Object Constructors
Provides constructors for File, User, Math, Date, JSON objects
"""

import os
import json
import time
import random
import math as python_math

class FileConstructor(object):
    """Synchronet File object constructor"""
    
    def __init__(self, path, mode="r"):
        self.path = path
        self.mode = mode
        self.file_handle = None
        self.position = 0
        self.is_open = False
        
    def open(self, mode="r"):
        """Open file with specified mode"""
        try:
            self.mode = mode
            if mode == "r":
                self.file_handle = open(self.path, "r")
            elif mode == "w":
                self.file_handle = open(self.path, "w")
            elif mode == "a":
                self.file_handle = open(self.path, "a")
            elif mode == "r+":
                self.file_handle = open(self.path, "r+")
            elif mode == "w+":
                self.file_handle = open(self.path, "w+")
            else:
                self.file_handle = open(self.path, mode)
            
            self.is_open = True
            return True
        except Exception as e:
            print("Error opening file {}: {}".format(self.path, str(e)))
            return False
    
    def close(self):
        """Close the file"""
        if self.file_handle:
            try:
                self.file_handle.close()
                self.is_open = False
                return True
            except:
                return False
        return False
    
    def read(self, length=None):
        """Read from file"""
        if not self.is_open or not self.file_handle:
            return None
        try:
            if length is None:
                return self.file_handle.read()
            else:
                return self.file_handle.read(length)
        except:
            return None
    
    def readln(self):
        """Read a line from file"""
        if not self.is_open or not self.file_handle:
            return None
        try:
            line = self.file_handle.readline()
            return line.rstrip('\n\r') if line else None
        except:
            return None
    
    def readAll(self):
        """Read all lines from file"""
        if not self.is_open or not self.file_handle:
            return []
        try:
            lines = []
            for line in self.file_handle:
                lines.append(line.rstrip('\n\r'))
            return lines
        except:
            return []
    
    def write(self, data):
        """Write data to file"""
        if not self.is_open or not self.file_handle:
            return False
        try:
            self.file_handle.write(str(data))
            return True
        except:
            return False
    
    def writeln(self, data=""):
        """Write line to file"""
        if not self.is_open or not self.file_handle:
            return False
        try:
            self.file_handle.write(str(data) + "\n")
            return True
        except:
            return False
    
    def flush(self):
        """Flush file buffer"""
        if self.file_handle:
            try:
                self.file_handle.flush()
                return True
            except:
                return False
        return False

class UserConstructor(object):
    """Synchronet User object constructor"""
    
    def __init__(self, number=1, alias="TestUser", name="Test User"):
        self.number = number
        self.alias = alias
        self.name = name
        self.stats = {
            'logons_today': 1,
            'total_logons': 100,
            'time_on': 30,
            'last_on': time.time()
        }
        self.security = 50
        self.level = 10

class MathWrapper(object):
    """JavaScript Math object wrapper"""
    
    @staticmethod
    def random():
        """JavaScript Math.random() equivalent"""
        return random.random()
    
    @staticmethod
    def floor(x):
        """JavaScript Math.floor() equivalent"""
        return python_math.floor(x)
    
    @staticmethod
    def ceil(x):
        """JavaScript Math.ceil() equivalent"""
        return python_math.ceil(x)
    
    @staticmethod
    def round(x):
        """JavaScript Math.round() equivalent"""
        return round(x)
    
    @staticmethod
    def abs(x):
        """JavaScript Math.abs() equivalent"""
        return abs(x)
    
    @staticmethod
    def max(*args):
        """JavaScript Math.max() equivalent"""
        return max(args)
    
    @staticmethod
    def min(*args):
        """JavaScript Math.min() equivalent"""
        return min(args)
    
    # Math constants
    PI = python_math.pi
    E = python_math.e

class DateWrapper(object):
    """JavaScript Date object wrapper"""
    
    def __init__(self, *args):
        if len(args) == 0:
            self.timestamp = time.time()
        elif len(args) == 1:
            if isinstance(args[0], (int, float)):
                self.timestamp = args[0] / 1000.0  # JS uses milliseconds
            else:
                # Parse date string (simplified)
                self.timestamp = time.time()
        else:
            # Year, month, day, etc. (simplified)
            self.timestamp = time.time()
    
    def toString(self):
        """JavaScript Date.toString() equivalent"""
        return time.ctime(self.timestamp)
    
    def getTime(self):
        """JavaScript Date.getTime() equivalent (milliseconds)"""
        return int(self.timestamp * 1000)
    
    def getFullYear(self):
        """JavaScript Date.getFullYear() equivalent"""
        return time.localtime(self.timestamp).tm_year
    
    def getMonth(self):
        """JavaScript Date.getMonth() equivalent (0-based)"""
        return time.localtime(self.timestamp).tm_mon - 1
    
    def getDate(self):
        """JavaScript Date.getDate() equivalent"""
        return time.localtime(self.timestamp).tm_mday

class JSONWrapper(object):
    """JavaScript JSON object wrapper"""
    
    @staticmethod
    def parse(text):
        """JavaScript JSON.parse() equivalent"""
        try:
            return json.loads(text)
        except:
            return None
    
    @staticmethod
    def stringify(obj, replacer=None, space=None):
        """JavaScript JSON.stringify() equivalent"""
        try:
            if space is not None:
                return json.dumps(obj, indent=space)
            else:
                return json.dumps(obj)
        except:
            return None

# Global constructors that JavaScript code can use
File = FileConstructor
User = UserConstructor
Math = MathWrapper
Date = DateWrapper
JSON = JSONWrapper