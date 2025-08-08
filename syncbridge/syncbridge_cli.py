#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge v1.0 - Command Line Interface
CLI interface for running Synchronet JavaScript doors on Mystic BBS
"""

import os
import sys
import argparse
from syncbridge import SyncBridge

def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(
        description='SyncBridge v1.0 - Run Synchronet JavaScript doors on Mystic BBS',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  syncbridge_cli.py test_simple.js
  syncbridge_cli.py ../achess.js --user="Player1" --debug
  syncbridge_cli.py door.js --system="My BBS" --operator="SysOp"
        """
    )
    
    parser.add_argument('jsfile', 
                       help='JavaScript file to execute')
    
    parser.add_argument('--debug', '-d', 
                       action='store_true',
                       help='Enable debug mode')
    
    parser.add_argument('--user', '-u',
                       default='TestUser',
                       help='Set user alias (default: TestUser)')
    
    parser.add_argument('--username', '-n',
                       default='Test User',
                       help='Set user real name (default: Test User)')
    
    parser.add_argument('--usernum',
                       type=int,
                       default=1,
                       help='Set user number (default: 1)')
    
    parser.add_argument('--system', '-s',
                       default='SyncBridge BBS',
                       help='Set system name (default: SyncBridge BBS)')
    
    parser.add_argument('--operator', '-o',
                       default='SysOp',
                       help='Set system operator (default: SysOp)')
    
    parser.add_argument('--args',
                       nargs='*',
                       default=[],
                       help='Additional arguments to pass to the JavaScript')
    
    args = parser.parse_args()
    
    # Check if JavaScript file exists
    if not os.path.exists(args.jsfile):
        print("Error: JavaScript file not found: {}".format(args.jsfile))
        sys.exit(1)
    
    # Create bridge instance
    bridge = SyncBridge(debug=args.debug)
    
    # Set user information
    bridge.set_user(args.user, args.username, args.usernum)
    
    # Set system information
    bridge.set_system(args.system, args.operator)
    
    # Set command line arguments
    bridge.global_scope['argc'] = len(args.args) + 1
    bridge.global_scope['argv'] = [args.jsfile] + args.args
    
    if args.debug:
        print("SyncBridge v1.0 - Starting execution")
        print("JavaScript file: {}".format(args.jsfile))
        print("User: {} ({})".format(args.user, args.usernum))
        print("System: {}".format(args.system))
        print("Arguments: {}".format(args.args))
        print("-" * 50)
    
    try:
        # Run the JavaScript file
        bridge.run_js_file(args.jsfile)
        
    except KeyboardInterrupt:
        print("\nExecution interrupted by user")
        sys.exit(1)
        
    except Exception as e:
        print("Error running JavaScript file: {}".format(str(e)))
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()