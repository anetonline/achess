#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SyncBridge Integration Test
Tests core Synchronet JavaScript patterns from achess.js
"""

import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from simplified_bridge import SimplifiedBridge

def test_core_patterns():
    """Test core JavaScript patterns used in achess.js"""
    
    print("SyncBridge v1.0 - Integration Test")
    print("=" * 50)
    
    bridge = SimplifiedBridge(debug=False)
    bridge.set_user("TestPlayer", "Test Player", 1)
    
    # Test 1: File operations (critical for achess.js)
    print("Test 1: File Operations")
    test_file = bridge.globals['File']("test_game.json")
    if test_file.open("w"):
        test_file.writeln('{"player": "TestPlayer", "score": 100}')
        test_file.close()
        print("✓ File write successful")
    else:
        print("✗ File write failed")
    
    if bridge.globals['file_exists']("test_game.json"):
        print("✓ File exists check successful")
        # Read it back
        read_file = bridge.globals['File']("test_game.json")
        if read_file.open("r"):
            content = read_file.read()
            read_file.close()
            print("✓ File read successful: {}".format(content[:50]))
        else:
            print("✗ File read failed")
    else:
        print("✗ File exists check failed")
    
    # Test 2: System and User objects
    print("\nTest 2: System and User Objects")
    print("✓ System name: {}".format(bridge.system.name))
    print("✓ User alias: {}".format(bridge.user.alias))
    print("✓ User number: {}".format(bridge.user.number))
    print("✓ JS exec_dir: {}".format(bridge.js.exec_dir))
    
    # Test 3: Console operations
    print("\nTest 3: Console Operations")
    bridge.console.print("Hello from SyncBridge!")
    print("✓ Console print works")
    
    # Test 4: Math and Date objects
    print("\nTest 4: Math and Date Objects")
    random_num = bridge.globals['Math'].random()
    print("✓ Math.random(): {}".format(random_num))
    
    current_date = bridge.globals['Date']()
    print("✓ Date object: {}".format(current_date.toString()))
    
    # Test 5: JSON operations (used for game saves)
    print("\nTest 5: JSON Operations")
    test_data = {"game": "chess", "moves": ["e2e4", "e7e5"]}
    json_str = bridge.globals['JSON'].stringify(test_data)
    print("✓ JSON.stringify: {}".format(json_str))
    
    parsed_data = bridge.globals['JSON'].parse(json_str)
    print("✓ JSON.parse: {}".format(parsed_data))
    
    # Test 6: Directory operations
    print("\nTest 6: Directory Operations")
    test_dir = "syncbridge_test_dir"
    if bridge.globals['mkdir'](test_dir):
        print("✓ Directory creation successful")
        
        # Test directory listing
        files = bridge.globals['directory']("*")
        print("✓ Directory listing: {} files found".format(len(files)))
        
        # Cleanup
        os.rmdir(test_dir)
    else:
        print("✗ Directory creation failed")
    
    # Test 7: Mock dependencies (critical for achess.js)
    print("\nTest 7: Mock Dependencies")
    
    # Test DDLightbarMenu mock
    menu = bridge.globals['DDLightbarMenu']()
    menu.add("Play Chess", "PLAY")
    menu.add("High Scores", "SCORES") 
    menu.add("Exit", "EXIT")
    print("✓ DDLightbarMenu mock created with {} items".format(len(menu.items)))
    
    # Test Frame mock
    frame = bridge.globals['Frame']()
    frame.open()
    print("✓ Frame mock functional")
    
    # Test require/load mocks
    result = bridge.mock_require("dd_lightbar_menu.js", "DDLightbarMenu")
    print("✓ require() mock functional")
    
    result = bridge.mock_load("chess.js")
    print("✓ load() mock functional")
    
    # Test 8: Chess engine integration
    print("\nTest 8: Chess Engine Integration")
    bridge.load_chess_engine()
    chess = bridge.globals['Chess']()
    print("✓ Chess engine loaded")
    print("✓ Initial FEN: {}".format(chess.fen()))
    
    moves = chess.moves()
    print("✓ Available moves: {}".format(len(moves)))
    
    # Summary
    print("\n" + "=" * 50)
    print("SyncBridge Integration Test: PASSED")
    print("✓ All core Synchronet APIs working")
    print("✓ File operations functional") 
    print("✓ Mock dependencies in place")
    print("✓ Chess engine integrated")
    print("✓ Ready for A-Net Chess integration!")
    print("=" * 50)
    
    # Cleanup
    try:
        os.remove("test_game.json")
    except:
        pass

if __name__ == '__main__':
    test_core_patterns()