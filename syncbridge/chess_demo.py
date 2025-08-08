#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge Demo - Chess Game Demonstration
Shows SyncBridge capabilities with A-Net Chess concepts
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simplified_bridge import SimplifiedBridge

def main():
    """Main demo function"""
    print("SyncBridge v1.0 - Chess Demo")
    print("Revolutionary BBS Door Converter")
    print("=" * 50)
    
    # Create bridge
    bridge = SimplifiedBridge(debug=True)
    
    # Set user and system info
    bridge.set_user("ChessPlayer", "Chess Player", 1)
    bridge.set_system("Demo BBS", "SysOp")
    
    # Run chess demonstration
    bridge.run_chess_demo()

if __name__ == '__main__':
    main()