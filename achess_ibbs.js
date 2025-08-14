// AChess InterBBS Utility

load("sbbsdefs.js");

// Configuration file location
var CONFIG_FILE = js.exec_dir + "bbs.cfg";
var ACHESS_DATA_DIR = js.exec_dir;

// Default fallback configuration
var DEFAULT_CONFIG = {
    bbs: {
        name: "A-Net Online",
        address: "777:777/4",
        bbs: "A-Net Online BBS",
        operator: "StingRay"
    },
    directories: {
        inbound: "/sbbs/fido/inbound/",
        outbound: "/sbbs/fido/outbound/"
    },
    mailer: {
        type: "binkd",
        poll_packets: true,
        auto_process: true
    }
};

function processInterBBSResponse(packet) {
    // This function handles generic response packets
    if (!packet.from) {
        logEvent("Invalid response packet - missing from field");
        return false;
    }
    
    logEvent("Received response from " + packet.from.bbs + ": " + (packet.message || "No message"));
    
    // Update node info if available
    if (packet.from) {
        updateNodeInfo(packet.from);
    }
    
    return true;
}

// CASE-INSENSITIVE HELPER FUNCTIONS
function equalsIgnoreCase(str1, str2) {
    if (!str1 || !str2) return false;
    return String(str1).toLowerCase() === String(str2).toLowerCase();
}

function findUserIgnoreCase(targetUser, userList) {
    if (!targetUser || !userList) return null;
    var target = String(targetUser).toLowerCase();
    
    if (typeof userList === "string") {
        return equalsIgnoreCase(targetUser, userList) ? userList : null;
    }
    
    if (Array.isArray(userList)) {
        for (var i = 0; i < userList.length; i++) {
            if (equalsIgnoreCase(targetUser, userList[i])) {
                return userList[i];
            }
        }
    }
    
    return null;
}

function isUserMatch(user1, user2) {
    return equalsIgnoreCase(user1, user2);
}

function getLocalUsers() {
    var users = [];
    
    try {
        if (typeof system !== "undefined" && system.data_dir) {

        }
    } catch (e) {
        logEvent("Could not access user database: " + e.message);
    }
    
    return users;
}

function findLocalUser(targetUser) {
    if (!targetUser) return null;
    
    try {
        // Try to match user in Synchronet user database
        if (typeof system !== "undefined" && system.matchuser) {
            var userNumber = system.matchuser(targetUser);
            if (userNumber > 0) {
                var u = new User(userNumber);
                return {
                    number: userNumber,
                    alias: u.alias,
                    name: u.name
                };
            }
        }
        
        // Fallback: return the username as-is for notification purposes
        return targetUser;
        
    } catch (e) {
        logEvent("Error in findLocalUser: " + e.toString());
        return targetUser; // Return the original username as fallback
    }
}

function requestPlayerListFromAllNodes() {
    var nodes = loadInterBBSNodes();
    var successCount = 0;
    
    print("Requesting player lists from all known nodes...\r\n");
    
    for (var address in nodes) {
        // Skip requesting from ourselves
        if (address === getLocalBBS("address")) continue;
        
        var node = nodes[address];
        print("Requesting from: " + node.name + " (" + address + ")\r\n");
        
        // Generate a unique timestamp for each request to prevent overwriting
        var timestamp = time() + "_" + Math.floor(Math.random() * 10000);
        
        var requestPacket = {
            type: "player_list_request",
            from: {
                bbs: getLocalBBS("name"),
                address: getLocalBBS("address"),
                user: user ? user.alias : "SYSTEM" // Use actual user when available
            },
            to: {
                bbs: node.name,
                address: node.address
            },
            created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
        };
        
        var fname = format("achess_playerlist_req_%s_%s.json", 
            node.address.replace(/[^A-Za-z0-9]/g, "_"),
            timestamp);
        var path = INTERBBS_OUT_DIR + fname;
        var f = new File(path);
        if (f.open("w+")) {
            f.write(JSON.stringify(requestPacket, null, 2));
            f.close();
            successCount++;
            print("  Request packet created: " + fname + "\r\n");
        } else {
            print("  ERROR: Could not create request packet for " + node.name + "\r\n");
        }
    }
    
    print("Sent " + successCount + " player list requests\r\n");
    return successCount;
}

// Parse INI/CFG file
function parseConfigFile(filename) {
    var config = {
        bbs: {},
        directories: {},
        mailer: {}
    };
    
    var f = new File(filename);
    if (!f.exists) {
        print("Config file not found: " + filename + ", using defaults\r\n");
        return DEFAULT_CONFIG;
    }
    
    if (!f.open("r")) {
        print("Could not open config file: " + filename + "\r\n");
        return DEFAULT_CONFIG;
    }
    
    var currentSection = "";
    var line;
    
    while ((line = f.readln()) !== null) {
        line = line.trim();
        
        // Skip empty lines and comments
        if (line === "" || line.charAt(0) === "#" || line.charAt(0) === ";") {
            continue;
        }
        
        // Check for section headers [section]
        if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
            currentSection = line.substr(1, line.length - 2).toLowerCase();
            continue;
        }
        
        // Parse key = value pairs
        var eqPos = line.indexOf("=");
        if (eqPos > 0) {
            var key = line.substr(0, eqPos).trim();
            var value = line.substr(eqPos + 1).trim();
            
            // Remove comments from value
            var commentPos = value.indexOf("#");
            if (commentPos >= 0) {
                value = value.substr(0, commentPos).trim();
            }
            
            // Remove quotes if present
            if ((value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') ||
                (value.charAt(0) === "'" && value.charAt(value.length - 1) === "'")) {
                value = value.substr(1, value.length - 2);
            }
            
            // Convert boolean strings
            if (value.toLowerCase() === "true") {
                value = true;
            } else if (value.toLowerCase() === "false") {
                value = false;
            }
            
            // Store in appropriate section
            if (!config[currentSection]) {
                config[currentSection] = {};
            }
            config[currentSection][key] = value;
        }
    }
    
    f.close();
    
    // Merge with defaults for any missing values
    for (var section in DEFAULT_CONFIG) {
        if (!config[section]) {
            config[section] = DEFAULT_CONFIG[section];
        } else {
            for (var key in DEFAULT_CONFIG[section]) {
                if (config[section][key] === undefined) {
                    config[section][key] = DEFAULT_CONFIG[section][key];
                }
            }
        }
    }
    
    return config;
}

// Load configuration
var CONFIG = parseConfigFile(CONFIG_FILE);

// Initialize myBBS with CONFIG.bbs data
var myBBS = CONFIG.bbs || DEFAULT_CONFIG.bbs;

// Set global variables from config
var INTERBBS_IN_DIR = CONFIG.directories.inbound;
var INTERBBS_OUT_DIR = CONFIG.directories.outbound;
var ACHESS_SCORES_FILE = ACHESS_DATA_DIR + "scores.json";
var INTERBBS_GAMES_FILE = ACHESS_DATA_DIR + "interbbs_games.json";
var MESSAGES_FILE = ACHESS_DATA_DIR + "messages.json";
var ACHESS_NOTIFY_FILE = ACHESS_DATA_DIR + "achess_notify.json";
var INTERBBS_LOG_FILE = ACHESS_DATA_DIR + "interbbs.log";

// Helper function to repeat characters
function repeatChar(char, count) {
    var result = "";
    for (var i = 0; i < count; i++) {
        result += char;
    }
    return result;
}

// Logging function
function logEvent(message) {
    var timestamp = strftime("%Y-%m-%d %H:%M:%S", time());
    var logEntry = timestamp + " - " + message + "\r\n";
    
    var f = new File(INTERBBS_LOG_FILE);
    if (f.open("a")) {
        f.write(logEntry);
        f.close();
    }
    
    print("LOG: " + message + "\r\n");
}

function getLocalBBS(field) {
    var bbsConfig = (typeof myBBS !== 'undefined' && myBBS) ? myBBS : 
                   (CONFIG && CONFIG.bbs) ? CONFIG.bbs : DEFAULT_CONFIG.bbs;
    
    if (bbsConfig && bbsConfig[field]) return bbsConfig[field];
    
    switch(field) {
        case "name": return system.name || "Unknown BBS";
        case "address": 
            // Try multiple sources for the address
            if (bbsConfig && bbsConfig.address) return bbsConfig.address;
            if (system.fidonet_addr) return system.fidonet_addr;
            return "777:777/4"; // Your known address as fallback
        case "bbs": return system.name || "Unknown BBS";
        case "operator": return system.operator || "SysOp";
        default: return "";
    }
}

function verifyNotificationPath() {
    // Ensure the notification file path is accessible
    var testFile = new File(ACHESS_NOTIFY_FILE);
    if (!testFile.exists) {
        // Create empty array file
        if (testFile.open("w")) {
            testFile.write("[]");
            testFile.close();
        }
    }
}

// AChess notification functions
function readAchessNotifications() {
    if (!file_exists(ACHESS_NOTIFY_FILE)) return [];
    var file = new File(ACHESS_NOTIFY_FILE);
    if (!file.open("r")) return [];
    var arr = [];
    try { arr = JSON.parse(file.readAll().join("")); } catch(e) {}
    file.close();
    return Array.isArray(arr) ? arr : [];
}

function writeAchessNotifications(arr) {
    var file = new File(ACHESS_NOTIFY_FILE);
    if (file.open("w+")) {
        file.write(JSON.stringify(arr, null, 2));
        file.close();
    }
}

function sendAchessNotification(to_alias, subject, body) {
    var arr = readAchessNotifications();
    arr.push({
        to: to_alias,
        subject: subject,
        body: body,
        time: strftime("%Y-%m-%d %H:%M:%S", time()),
        read: false
    });
    writeAchessNotifications(arr);
}

// AChess message functions
function readMessages() {
    if (!file_exists(MESSAGES_FILE)) return [];
    var f = new File(MESSAGES_FILE);
    if (!f.open("r")) return [];
    var content = f.read();
    f.close();
    
    if (!content || content.trim() === "") {
        return [];
    }
    
    try {
        var arr = JSON.parse(content);
        return Array.isArray(arr) ? arr : [];
    } catch (e) {
        logEvent("Error parsing messages.json: " + e.message);
        return [];
    }
}

function writeMessages(msgs) {
    var f = new File(MESSAGES_FILE);
    if (f.open("w+")) {
        f.write(JSON.stringify(msgs, null, 2));
        f.close();
    }
}

// Load JSON data with error handling
function loadJSONFile(filename, defaultValue) {
    var f = new File(filename);
    if (!f.exists) {
        logEvent("File does not exist, creating: " + filename);
        saveJSONFile(filename, defaultValue || {});
        return defaultValue || {};
    }
    
    if (f.open("r")) {
        var content = f.read();
        f.close();
        
        if (!content || content.trim() === "") {
            logEvent("Empty file, using default: " + filename);
            return defaultValue || {};
        }
        
        try {
            return JSON.parse(content);
        } catch (e) {
            logEvent("JSON parse error in " + filename + ": " + e.message);
            return defaultValue || {};
        }
    }
    
    logEvent("Could not open file: " + filename);
    return defaultValue || {};
}

// Save JSON data
function saveJSONFile(filename, data) {
    var f = new File(filename);
    if (f.open("w")) {
        f.write(JSON.stringify(data, null, 2));
        f.close();
        return true;
    }
    logEvent("Could not save file: " + filename);
    return false;
}

// Load InterBBS games
function loadInterBBSGames() {
    return loadJSONFile(INTERBBS_GAMES_FILE, []);
}

// Save InterBBS games
function saveInterBBSGames(games) {
    return saveJSONFile(INTERBBS_GAMES_FILE, games);
}

// Read nodes from chess_nodes.ini (INI format)
function loadInterBBSNodes() {
    var nodes = {};
    var NODE_FILE = ACHESS_DATA_DIR + "chess_nodes.ini";
    
    if (!file_exists(NODE_FILE)) {
        logEvent("chess_nodes.ini not found at: " + NODE_FILE);
        return nodes;
    }
    
    var f = new File(NODE_FILE);
    if (!f.open("r")) {
        logEvent("Could not open chess_nodes.ini");
        return nodes;
    }
    
    var lines = f.readAll();
    f.close();
    
    var current = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line[0] == "#") continue;
        
        if (line[0] == "[") {

            if (Object.keys(current).length && current.address) {
                nodes[current.address] = {
                    name: current.name || current.bbs || "Unknown BBS",
                    address: current.address,
                    sysop: current.sysop || current.operator || "",
                    location: current.location || "",
                    last_seen: current.last_seen || "Never"
                };
            }
            current = {};
        } else {
            // Parse key=value pairs
            var m = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (m) {
                current[m[1]] = m[2];
            }
        }
    }
    
    if (Object.keys(current).length && current.address) {
        nodes[current.address] = {
            name: current.name || current.bbs || "Unknown BBS",
            address: current.address,
            sysop: current.sysop || current.operator || "",
            location: current.location || "",
            last_seen: current.last_seen || "Never"
        };
    }
    
    return nodes;
}

// Save nodes back to chess_nodes.ini (INI format)
function saveInterBBSNodes(nodes) {
    var NODE_FILE = ACHESS_DATA_DIR + "chess_nodes.ini";
    
    // Validate and clean nodes before saving
    var cleanedNodes = validateAndDeduplicateNodes(nodes);
    
    var f = new File(NODE_FILE);
    if (!f.open("w")) {
        logEvent("Could not write to chess_nodes.ini");
        return false;
    }
    
    f.writeln("# InterBBS Chess Nodes Configuration");
    f.writeln("# Generated: " + strftime("%Y-%m-%d %H:%M:%S", time()));
    f.writeln("# Validated and deduplicated");
    f.writeln("");
    
    var nodeCount = 0;
    for (var address in cleanedNodes) {
        var node = cleanedNodes[address];
        f.writeln("[Node" + (++nodeCount) + "]");
        f.writeln("name=" + node.name);
        f.writeln("address=" + address);
        if (node.sysop) f.writeln("sysop=" + node.sysop);
        if (node.location) f.writeln("location=" + node.location);
        f.writeln("last_seen=" + node.last_seen);
        f.writeln("");
    }
    
    f.close();
    logEvent("Saved " + nodeCount + " validated nodes to chess_nodes.ini");
    return true;
}

// Enhanced node cleanup function
function cleanupDuplicateNodes() {
    print("=== NODE CLEANUP UTILITY ===\r\n");
    
    var nodes = loadInterBBSNodes();
    var masterNodes = isLeagueCoordinator() ? loadMasterNodeList() : {};
    
    // Enhanced duplicate detection
    var duplicates = [];
    var addressMismatches = [];
    var nameDuplicates = {};
    
    // First pass: Find name duplicates within local nodes list
    for (var address in nodes) {
        var node = nodes[address];
        var normalizedName = node.name.toLowerCase().trim();
        
        if (!nameDuplicates[normalizedName]) {
            nameDuplicates[normalizedName] = [];
        }
        nameDuplicates[normalizedName].push(address);
    }
    
    // Process name duplicates
    for (var name in nameDuplicates) {
        if (nameDuplicates[name].length > 1) {
            var addresses = nameDuplicates[name];
            var names = addresses.map(function(addr) { return nodes[addr].name; });
            
            duplicates.push({
                type: "duplicate_name",
                addresses: addresses,
                names: names,
                normalized_name: name
            });
        }
    }
    
    // Second pass: For LC only - check against master list
    if (isLeagueCoordinator() && Object.keys(masterNodes).length > 0) {
        // Check for nodes with wrong addresses compared to master list
        for (var address in nodes) {
            var node = nodes[address];
            var normalizedName = node.name.toLowerCase().trim();
            
            // Check for nodes with same name but different address in master list
            for (var masterAddr in masterNodes) {
                var masterNode = masterNodes[masterAddr];
                var masterNormalizedName = masterNode.name.toLowerCase().trim();
                
                if (masterAddr !== address && normalizedName === masterNormalizedName) {
                    addressMismatches.push({
                        type: "address_mismatch",
                        current: address,
                        master: masterAddr,
                        name: node.name,
                        master_name: masterNode.name
                    });
                    break;
                }
            }
            
            // Check for addresses in local list not in master list
            if (!masterNodes[address]) {
                duplicates.push({
                    type: "not_in_master",
                    addresses: [address],
                    names: [node.name],
                    normalized_name: normalizedName
                });
            }
        }
        
        // Check for master nodes missing from local list
        for (var masterAddr in masterNodes) {
            if (!nodes[masterAddr]) {
                duplicates.push({
                    type: "missing_from_local",
                    addresses: [masterAddr],
                    names: [masterNodes[masterAddr].name],
                    normalized_name: masterNodes[masterAddr].name.toLowerCase().trim(),
                    master_node: masterNodes[masterAddr]
                });
            }
        }
    }
    
    print("Found " + duplicates.length + " node issues and " + 
          addressMismatches.length + " address mismatches.\r\n\r\n");
    
    // Display duplicates first
    if (duplicates.length > 0) {
        print("=== NODE ISSUES ===\r\n");
        for (var i = 0; i < duplicates.length; i++) {
            var dup = duplicates[i];
            print("Issue " + (i + 1) + ":\r\n");
            print("  Type: " + dup.type + "\r\n");
            
            if (dup.type === "duplicate_name") {
                print("  Multiple entries with same name found:\r\n");
                for (var j = 0; j < dup.addresses.length; j++) {
                    var addr = dup.addresses[j];
                    var node = nodes[addr];
                    print("    [" + addr + "] " + node.name + " (Last seen: " + (node.last_seen || "Never") + ")\r\n");
                }
            } else if (dup.type === "not_in_master") {
                print("  Node exists in local list but not in master list:\r\n");
                print("    [" + dup.addresses[0] + "] " + dup.names[0] + "\r\n");
            } else if (dup.type === "missing_from_local") {
                print("  Node exists in master list but not in local list:\r\n");
                print("    [" + dup.addresses[0] + "] " + dup.names[0] + "\r\n");
            }
            
            print("\r\n");
        }
    }
    
    // Display address mismatches next
    if (addressMismatches.length > 0) {
        print("=== ADDRESS MISMATCHES ===\r\n");
        print("These nodes have the correct name but WRONG ADDRESS compared to master list.\r\n\r\n");
        
        for (var i = 0; i < addressMismatches.length; i++) {
            var mismatch = addressMismatches[i];
            print("Mismatch " + (i + 1) + ":\r\n");
            print("  BBS Name: " + mismatch.name + "\r\n");
            print("  Current Address: " + mismatch.current + "\r\n");
            print("  CORRECT Address: " + mismatch.master + " (from master list)\r\n");
            print("\r\n");
        }
    }
    
    if (duplicates.length === 0 && addressMismatches.length === 0) {
        print("No issues found! Node list is clean.\r\n");
        return;
    }
    
    print("Clean up these issues? (Y/N): ");
    var confirm = console.getstr().toUpperCase();
    
    if (confirm === "Y") {
        var cleaned = improvedAutomaticCleanup(nodes, duplicates, addressMismatches, masterNodes);
        saveInterBBSNodes(cleaned);
        
        // If LC, also update the master list
        if (isLeagueCoordinator()) {
            var f = new File(LC_MASTER_NODELIST);
            if (f.open("w+")) {
                f.write(JSON.stringify(cleaned, null, 2));
                f.close();
                print("Master node list updated.\r\n");
            }
            
            // Ask if the user wants to automatically distribute the clean list
            print("Distribute clean node list to all BBSes? (Y/N): ");
            var distribute = console.getstr().toUpperCase();
            if (distribute === "Y") {
                distributeCleanNodeList();
            }
        }
        
        print("Node cleanup completed!\r\n");
    } else {
        print("Cleanup cancelled.\r\n");
    }
}

// Improved automatic cleanup function that handles all issue types
function improvedAutomaticCleanup(nodes, duplicates, addressMismatches, masterNodes) {
    var cleaned = {};
    var removed = [];
    var corrected = [];
    var added = [];
    
    // Start with a copy of the current nodes
    for (var addr in nodes) {
        cleaned[addr] = JSON.parse(JSON.stringify(nodes[addr]));
    }
    
    // Process duplicates
    for (var i = 0; i < duplicates.length; i++) {
        var dup = duplicates[i];
        
        if (dup.type === "duplicate_name") {
            // For duplicate names, keep the most recently seen node
            var latest = null;
            var latestTime = 0;
            
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                var node = nodes[addr];
                var lastSeenStr = node.last_seen || "1970-01-01T00:00:00Z";
                var nodeTime = 0;
                
                try {
                    nodeTime = new Date(lastSeenStr).getTime();
                } catch(e) {
                    // If parsing fails, use 0 (oldest possible time)
                    nodeTime = 0;
                }
                
                if (!latest || nodeTime > latestTime) {
                    latest = addr;
                    latestTime = nodeTime;
                }
            }
            
            // LC only: check if any address matches the master list
            if (isLeagueCoordinator() && Object.keys(masterNodes).length > 0) {
                for (var j = 0; j < dup.addresses.length; j++) {
                    var addr = dup.addresses[j];
                    if (masterNodes[addr]) {
                        // This address exists in master list, prefer it over timestamp
                        latest = addr;
                        break;
                    }
                }
            }
            
            // Remove all except the latest/master
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                if (addr !== latest) {
                    delete cleaned[addr];
                    removed.push(addr + " (" + nodes[addr].name + ")");
                    logEvent("Removed duplicate node: " + addr + " (" + nodes[addr].name + ")");
                }
            }
        } else if (dup.type === "not_in_master" && isLeagueCoordinator()) {
            // Node exists in local but not in master - for LC, remove these
            var addr = dup.addresses[0];
            delete cleaned[addr];
            removed.push(addr + " (" + nodes[addr].name + ") - not in master list");
            logEvent("Removed node not in master list: " + addr);
        } else if (dup.type === "missing_from_local" && isLeagueCoordinator()) {
            // Node exists in master but not in local - for LC, add these
            var addr = dup.addresses[0];
            cleaned[addr] = dup.master_node;
            added.push(addr + " (" + dup.master_node.name + ") - from master list");
            logEvent("Added missing node from master list: " + addr);
        }
    }
    
    // Process address mismatches (only if we have the master list to reference)
    if (isLeagueCoordinator() && addressMismatches.length > 0) {
        for (var i = 0; i < addressMismatches.length; i++) {
            var mismatch = addressMismatches[i];
            
            // Get the node data
            var nodeData = cleaned[mismatch.current];
            if (!nodeData) continue;
            
            // Remove the node with incorrect address
            delete cleaned[mismatch.current];
            
            // Add it back with the correct address from master list
            cleaned[mismatch.master] = masterNodes[mismatch.master] || {
                name: nodeData.name,
                address: mismatch.master,
                sysop: nodeData.sysop || "",
                location: nodeData.location || "",
                last_seen: nodeData.last_seen || "Never"
            };
            
            corrected.push(mismatch.current + " -> " + mismatch.master + " (" + nodeData.name + ")");
            logEvent("Corrected address for " + nodeData.name + ": " + mismatch.current + " -> " + mismatch.master);
        }
    }
    
    // Summary report
    if (removed.length > 0) {
        print("\r\nRemoved " + removed.length + " duplicate/invalid entries:\r\n");
        for (var i = 0; i < removed.length; i++) {
            print("  - " + removed[i] + "\r\n");
        }
    }
    
    if (corrected.length > 0) {
        print("\r\nCorrected " + corrected.length + " address mismatches:\r\n");
        for (var i = 0; i < corrected.length; i++) {
            print("  - " + corrected[i] + "\r\n");
        }
    }
    
    if (added.length > 0) {
        print("\r\nAdded " + added.length + " nodes from master list:\r\n");
        for (var i = 0; i < added.length; i++) {
            print("  - " + added[i] + "\r\n");
        }
    }
    
    return cleaned;
}

// Enhanced automaticCleanup to handle address mismatches
function automaticCleanup(nodes, duplicates, addressMismatches) {
    var cleaned = {};
    var removed = [];
    var corrected = [];
    
    // Copy all nodes first
    for (var addr in nodes) {
        cleaned[addr] = nodes[addr];
    }
    
    // Process duplicates
    for (var i = 0; i < duplicates.length; i++) {
        var dup = duplicates[i];
        
        if (dup.type === "duplicate_name") {
            // Keep the most recently seen node
            var latest = null;
            var latestTime = 0;
            
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                var node = nodes[addr];
                var nodeTime = new Date(node.last_seen).getTime();
                
                if (!latest || nodeTime > latestTime) {
                    latest = addr;
                    latestTime = nodeTime;
                }
            }
            
            // Remove all except the latest
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                if (addr !== latest) {
                    delete cleaned[addr];
                    removed.push(addr + " (" + nodes[addr].name + ")");
                    logEvent("Removed duplicate node: " + addr + " (" + nodes[addr].name + ")");
                }
            }
        }
    }
    
    // Process address mismatches (only if we have the master list to reference)
    if (addressMismatches) {
        for (var i = 0; i < addressMismatches.length; i++) {
            var mismatch = addressMismatches[i];
            
            // Get the node data
            var nodeData = cleaned[mismatch.current];
            if (!nodeData) continue;
            
            // Remove the node with incorrect address
            delete cleaned[mismatch.current];
            
            // Add it back with the correct address from master list
            cleaned[mismatch.master] = {
                name: nodeData.name,
                address: mismatch.master, // Use the correct address
                sysop: nodeData.sysop || "",
                location: nodeData.location || "",
                last_seen: nodeData.last_seen
            };
            
            corrected.push(mismatch.current + " -> " + mismatch.master + " (" + nodeData.name + ")");
            logEvent("Corrected address for " + nodeData.name + ": " + mismatch.current + " -> " + mismatch.master);
        }
    }
    
    print("Removed " + removed.length + " duplicate entries:\r\n");
    for (var i = 0; i < removed.length; i++) {
        print("  - " + removed[i] + "\r\n");
    }
    
    if (corrected.length > 0) {
        print("\r\nCorrected " + corrected.length + " address mismatches:\r\n");
        for (var i = 0; i < corrected.length; i++) {
            print("  - " + corrected[i] + "\r\n");
        }
    }
    
    return cleaned;
}

function findDuplicateNodes(nodes) {
    var duplicates = [];
    var seenNames = {};
    var seenAddresses = {};
    
    // Find duplicate BBS names
    for (var address in nodes) {
        var node = nodes[address];
        var normalizedName = node.name.toLowerCase().trim();
        
        if (!seenNames[normalizedName]) {
            seenNames[normalizedName] = [];
        }
        seenNames[normalizedName].push(address);
    }
    
    // Report name duplicates
    for (var name in seenNames) {
        if (seenNames[name].length > 1) {
            var addresses = seenNames[name];
            var names = addresses.map(function(addr) { return nodes[addr].name; });
            
            duplicates.push({
                type: "duplicate_name",
                addresses: addresses,
                names: names,
                normalized_name: name
            });
        }
    }
    
    return duplicates;
}

function automaticCleanup(nodes, duplicates) {
    var cleaned = {};
    var removed = [];
    
    // Copy all nodes first
    for (var addr in nodes) {
        cleaned[addr] = nodes[addr];
    }
    
    // Process duplicates
    for (var i = 0; i < duplicates.length; i++) {
        var dup = duplicates[i];
        
        if (dup.type === "duplicate_name") {
            // Keep the most recently seen node
            var latest = null;
            var latestTime = 0;
            
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                var node = nodes[addr];
                var nodeTime = new Date(node.last_seen).getTime();
                
                if (!latest || nodeTime > latestTime) {
                    latest = addr;
                    latestTime = nodeTime;
                }
            }
            
            // Remove all except the latest
            for (var j = 0; j < dup.addresses.length; j++) {
                var addr = dup.addresses[j];
                if (addr !== latest) {
                    delete cleaned[addr];
                    removed.push(addr + " (" + nodes[addr].name + ")");
                    logEvent("Removed duplicate node: " + addr + " (" + nodes[addr].name + ")");
                }
            }
        }
    }
    
    print("Removed " + removed.length + " duplicate entries:\r\n");
    for (var i = 0; i < removed.length; i++) {
        print("  - " + removed[i] + "\r\n");
    }
    
    return cleaned;
}

// Enhanced validateNodeRegistration with strict address checking
function validateNodeRegistration(nodeInfo) {
    // Add validation for required fields first
    if (!nodeInfo || typeof nodeInfo !== 'object') {
        logEvent("Invalid nodeInfo: not an object");
        return false;
    }
    
    if (!nodeInfo.address) {
        logEvent("Invalid nodeInfo: missing address field");
        return false;
    }
    
    // CRITICAL FIX: Handle missing name field safely
    var nodeName = nodeInfo.name || nodeInfo.bbs || ("Unknown BBS (" + nodeInfo.address + ")");
    
    // For the LC, we check against the master list
    if (isLeagueCoordinator()) {
        var masterNodes = loadMasterNodeList();
        
        // If this is a new node, we can add it to the master list
        if (!masterNodes[nodeInfo.address]) {
            // Ensure the address doesn't exist with a different name
            var nameConflict = false;
            for (var addr in masterNodes) {
                if (masterNodes[addr].name.toLowerCase() === nodeName.toLowerCase() && addr !== nodeInfo.address) {
                    logEvent("WARNING: BBS name '" + nodeName + "' already registered with address " + addr);
                    nameConflict = true;
                    break;
                }
            }
            
            if (!nameConflict) {
                // New valid node - add to master list
                masterNodes[nodeInfo.address] = {
                    name: nodeName,
                    address: nodeInfo.address,
                    sysop: nodeInfo.sysop || "",
                    location: nodeInfo.location || "",
                    last_seen: strftime("%Y-%m-%dT%H:%M:%SZ", time())
                };
                
                var f = new File(LC_MASTER_NODELIST);
                if (f.open("w+")) {
                    f.write(JSON.stringify(masterNodes, null, 2));
                    f.close();
                    logEvent("Added new node to master list: " + nodeInfo.address + " (" + nodeName + ")");
                }
            } else {
                logEvent("Rejected new node due to name conflict: " + nodeInfo.address);
                return false;
            }
        }
    } else {
        // For non-LC nodes, we need to check the local node list which should match LC's master list
        var nodes = loadInterBBSNodes();
        
        // Only allow updates for nodes that already exist in our local list
        if (!nodes[nodeInfo.address]) {
            logEvent("WARNING: Unknown node address attempted registration: " + nodeInfo.address);
            logEvent("New nodes must be registered with the League Coordinator first");
            return false;
        }
        
        // Ensure name matches
        var existingName = nodes[nodeInfo.address].name || "Unknown BBS";
        if (existingName.toLowerCase() !== nodeName.toLowerCase()) {
            logEvent("WARNING: Address " + nodeInfo.address + " trying to change name from '" + 
                    existingName + "' to '" + nodeName + "' - rejecting");
            return false;
        }
    }
    
    // Set the corrected name back on the nodeInfo object
    nodeInfo.name = nodeName;
    
    return true;
}

function isLeagueCoordinator() {
    var myAddress = getLocalBBS("address");
    var coordinatorAddress = CONFIG.league_coordinator || "777:777/1"; // Set your LC address
    return myAddress === coordinatorAddress;
}

function distributeCleanNodeList() {
    if (!isLeagueCoordinator()) {
        print("Only the League Coordinator can distribute node lists.\r\n");
        return false;
    }
    
    print("=== DISTRIBUTE CLEAN NODE LIST ===\r\n");
    print("This will send the current clean node list to all registered nodes.\r\n");
    print("Continue? (Y/N): ");
    
    var confirm = console.getstr().toUpperCase();
    if (confirm !== "Y") {
        print("Distribution cancelled.\r\n");
        return false;
    }
    
    // First, ensure we have the latest master list
    var masterNodes = loadMasterNodeList();
    var nodes = loadInterBBSNodes();
    
    // Check for discrepancies between master and local nodes
    var discrepancies = 0;
    for (var address in nodes) {
        if (!masterNodes[address]) {
            discrepancies++;
        } else if (nodes[address].name !== masterNodes[address].name) {
            discrepancies++;
        }
    }
    
    for (var address in masterNodes) {
        if (!nodes[address]) {
            discrepancies++;
        }
    }
    
    if (discrepancies > 0) {
        print("\r\nWARNING: Found " + discrepancies + " discrepancies between local nodes and master list.\r\n");
        print("You should run node cleanup before distributing.\r\n");
        print("Continue anyway? (Y/N): ");
        
        var override = console.getstr().toUpperCase();
        if (override !== "Y") {
            print("Distribution cancelled.\r\n");
            return false;
        }
    }
    
    // Use the master list as the definitive source if it exists and we're the LC
    var cleanedNodes = Object.keys(masterNodes).length > 0 ? masterNodes : validateAndDeduplicateNodes(nodes);
    
    // Create node registry packet
    var registryPacket = {
        type: "node_registry_update",
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            user: "LEAGUE_COORDINATOR"
        },
        node_registry: cleanedNodes,
        version: time(),
        authority: "league_coordinator",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var sent = 0;
    for (var address in cleanedNodes) {
        if (address === getLocalBBS("address")) continue; // Don't send to ourselves
        
        var filename = "achess_registry_update_" + address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
        var filepath = INTERBBS_OUT_DIR + filename;
        
        if (saveJSONFile(filepath, registryPacket)) {
            print("  Sent registry to " + cleanedNodes[address].name + "\r\n");
            sent++;
        }
    }
    
    print("Registry update sent to " + sent + " nodes.\r\n");
    logEvent("Distributed clean node registry to " + sent + " nodes");
    return true;
}

// Load players database
function loadInterBBSPlayers() {
    return loadJSONFile(ACHESS_DATA_DIR + "players_db.json", {});
}

// Save players database
function saveInterBBSPlayers(players) {
    return saveJSONFile(ACHESS_DATA_DIR + "players_db.json", players);
}

// Update player information when processing packets - UPDATED: Case-insensitive
function updatePlayerInfo(playerInfo) {
    if (!playerInfo || !playerInfo.user || !playerInfo.bbs) {
        return; // Skip if incomplete player info
    }
    
    var players = loadInterBBSPlayers();
    var nodeAddress = playerInfo.address || playerInfo.bbs;
    
    if (!players[nodeAddress]) players[nodeAddress] = [];
    
    // Check if player already exists (case-insensitive)
    var found = false;
    for (var i = 0; i < players[nodeAddress].length; i++) {
        if (isUserMatch(players[nodeAddress][i].username, playerInfo.user)) {
            players[nodeAddress][i].lastSeen = strftime("%Y-%m-%d", time());
            // Update with exact case from latest packet
            players[nodeAddress][i].username = playerInfo.user;
            found = true;
            logEvent("Updated existing player (case resolved): " + playerInfo.user + " @ " + playerInfo.bbs);
            break;
        }
    }
    
    if (!found) {
        players[nodeAddress].push({
            username: playerInfo.user,
            lastSeen: strftime("%Y-%m-%d", time()),
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0
        });
        logEvent("Added new player: " + playerInfo.user + " @ " + playerInfo.bbs);
    }
    
    saveInterBBSPlayers(players);
}

// Load scores
function loadScores() {
    var scores = loadJSONFile(ACHESS_SCORES_FILE, []);
    
    // If it's an array (game history format), convert to summary
    if (Array.isArray(scores)) {
        return convertGamesToSummary(scores);
    }
    
    // If it's an empty object, initialize with proper structure
    if (Object.keys(scores).length === 0) {
        var ourBBS = getLocalBBS("name") + " (" + getLocalBBS("address") + ")";
        scores[ourBBS] = {};
    }
    
    return scores;
}

function updateSummaryScoresFromRecent(scores) {
    var summary = {};
    var ourBBS = getLocalBBS("name") + " (" + getLocalBBS("address") + ")";
    summary[ourBBS] = {};
    
    for (var i = 0; i < scores.length; i++) {
        var s = scores[i];
        var name = s.user;
        if (!summary[ourBBS][name]) summary[ourBBS][name] = {wins:0, losses:0, draws:0, rating:1200};
        if (typeof s.result === "string") {
            if (s.result.match(/win/i)) summary[ourBBS][name].wins++;
            else if (s.result.match(/loss/i)) summary[ourBBS][name].losses++;
            else if (s.result.match(/draw/i)) summary[ourBBS][name].draws++;
        }
    }
    
    // Calculate ratings
    for (var player in summary[ourBBS]) {
        var stats = summary[ourBBS][player];
        stats.rating = 1200 + (stats.wins * 25) - (stats.losses * 15);
    }
    
    var f = new File(SCORES_SUMMARY);
    if (f.open("w+")) {
        f.write(JSON.stringify(summary, null, 2));
        f.close();
    }
    
    // Trigger InterBBS score sharing after updating
    runInterBBSScoreUpdate();
}

function runInterBBSScoreUpdate() {
    // Check if the InterBBS script exists
    var ibbsScript = js.exec_dir + "achess_ibbs.js";
    if (file_exists(ibbsScript)) {
        try {
            system.exec(ibbsScript + " outbound", true);
            logEvent("Triggered InterBBS score update");
        } catch(e) {
            logEvent("Error triggering InterBBS score update: " + e.toString());
        }
    }
}

function logEvent(message) {
    var logFile = js.exec_dir + "achess.log";
    var f = new File(logFile);
    if (f.open("a")) {
        f.writeln(strftime("%Y-%m-%d %H:%M:%S", time()) + " - " + message);
        f.close();
    }
}

function getLocalBBS(field) {
    if (myBBS && myBBS[field]) return myBBS[field];
    switch(field) {
        case "name": return system.name || "Unknown BBS";
        case "address": 
            // Try multiple sources for the address
            if (myBBS && myBBS.address) return myBBS.address;
            if (system.fidonet_addr) return system.fidonet_addr;
            return "777:777/4"; // Your known address as fallback
        case "bbs": return system.name || "Unknown BBS";
        case "operator": return system.operator || "SysOp";
        default: return "";
    }
}

function addScore(username, result, vs) {
    var scores = readScores();
    if (!Array.isArray(scores)) scores = [];
    var now = strftime("%Y-%m-%d %H:%M", time());
    scores.push({
        user: username,
        result: result,
        vs: vs,
        date: now
    });
    while (scores.length > 30) scores.shift();
    writeScores(scores);
    updateSummaryScoresFromRecent(scores);
    updateScoreFiles();
}

function readScores() {
    if (!file_exists(SCORES_FILE)) return [];
    var f = new File(SCORES_FILE);
    if (!f.open("r")) return [];
    var arr = JSON.parse(f.readAll().join(""));
    f.close();
    if (!Array.isArray(arr)) return [];
    return arr;
}

function writeScores(scores) {
    if (!Array.isArray(scores)) scores = [];
    var f = new File(SCORES_FILE);
    if (f.open("w+")) {
        f.write(JSON.stringify(scores, null, 2));
        f.close();
    }
}

function chess_readScores() {
    if (!file_exists(SCORES_SUMMARY)) return {};
    var f = new File(SCORES_SUMMARY);
    if (!f.open("r")) return {};
    var obj;
    try {
        obj = JSON.parse(f.readAll().join(""));
    } catch(e) {
        obj = {};
        logEvent("Error reading scores summary: " + e.toString());
    }
    f.close();
    
    // Extract player scores from BBS structure if needed
    var playerScores = {};
    
    // First check if it's already in the old format
    if (obj && typeof obj === 'object' && !obj[getLocalBBS("name") + " (" + getLocalBBS("address") + ")"]) {
        var hasPlayerEntries = false;
        for (var key in obj) {
            if (obj[key] && typeof obj[key] === 'object' && 
                (typeof obj[key].wins !== 'undefined' || 
                 typeof obj[key].losses !== 'undefined' || 
                 typeof obj[key].draws !== 'undefined')) {
                hasPlayerEntries = true;
                break;
            }
        }
        
        if (hasPlayerEntries) {
            // It's already in the old format, use as is
            return obj;
        }
    }
    
    // If it's in the new format, extract our BBS's players
    for (var bbsKey in obj) {
        if (bbsKey === getLocalBBS("name") + " (" + getLocalBBS("address") + ")") {
            return obj[bbsKey];
        }
    }
    
    // If we got here, it's neither format or empty
    return {};
}

function updateScoreFiles() {
    writeScoresANS();
    writeScoresASC();
    convertScoresAnsToAnsi();
}

// Function to add a new node to the master list (LC only)
function addNodeToMasterList() {
    if (!isLeagueCoordinator()) {
        print("Only the League Coordinator can modify the master node list.\r\n");
        return false;
    }
    
    print("=== ADD NEW NODE TO MASTER LIST ===\r\n");
    
    // Get existing master nodes
    var masterNodes = loadMasterNodeList();
    
    // Get node information
    print("Enter BBS Name: ");
    var name = console.getstr();
    if (!name || name.trim() === "") {
        print("Error: BBS name cannot be empty.\r\n");
        return false;
    }
    
    print("Enter BBS Address (format: 777:777/X): ");
    var address = console.getstr();
    if (!address || address.trim() === "") {
        print("Error: BBS address cannot be empty.\r\n");
        return false;
    }
    
    // Check if address already exists
    if (masterNodes[address]) {
        print("Error: A node with address " + address + " already exists.\r\n");
        print("BBS: " + masterNodes[address].name + "\r\n");
        print("Use option 3 to edit this node instead.\r\n");
        return false;
    }
    
    // Check if name already exists with different address
    var normalizedName = name.toLowerCase().trim();
    var nameExists = false;
    var existingAddress = "";
    
    for (var addr in masterNodes) {
        if (masterNodes[addr].name.toLowerCase().trim() === normalizedName) {
            nameExists = true;
            existingAddress = addr;
            break;
        }
    }
    
    if (nameExists) {
        print("Warning: A node with the same name already exists with address " + existingAddress + "\r\n");
        print("Adding this node may create duplicates. Continue? (Y/N): ");
        var confirm = console.getstr().toUpperCase();
        if (confirm !== "Y") {
            print("Addition cancelled.\r\n");
            return false;
        }
    }
    
    // Get optional fields
    print("Enter SysOp Name (optional): ");
    var sysop = console.getstr();
    
    print("Enter Location (optional): ");
    var location = console.getstr();
    
    // Create node entry
    masterNodes[address] = {
        name: name,
        address: address,
        sysop: sysop || "",
        location: location || "",
        last_seen: "Never"
    };
    
    // Save master list
    var f = new File(LC_MASTER_NODELIST);
    if (f.open("w+")) {
        f.write(JSON.stringify(masterNodes, null, 2));
        f.close();
        print("\r\nNode added successfully to master list!\r\n");
        
        // Update local node list too
        var nodes = loadInterBBSNodes();
        nodes[address] = masterNodes[address];
        saveInterBBSNodes(nodes);
        print("Local node list also updated.\r\n");
        
        return true;
    } else {
        print("Error: Could not save master node list.\r\n");
        return false;
    }
}

// Function to edit an existing node in the master list (LC only)
function editNodeInMasterList() {
    if (!isLeagueCoordinator()) {
        print("Only the League Coordinator can modify the master node list.\r\n");
        return false;
    }
    
    print("=== EDIT NODE IN MASTER LIST ===\r\n");
    
    // Get existing master nodes
    var masterNodes = loadMasterNodeList();
    
    // Display available nodes
    print("Available nodes in master list:\r\n");
    var nodeAddresses = Object.keys(masterNodes);
    
    if (nodeAddresses.length === 0) {
        print("No nodes found in master list. Use option 2 to add nodes.\r\n");
        return false;
    }
    
    for (var i = 0; i < nodeAddresses.length; i++) {
        var addr = nodeAddresses[i];
        var node = masterNodes[addr];
        print(format("%2d. %-25s  %s\r\n", i + 1, node.name, addr));
    }
    
    // Select node to edit
    print("\r\nEnter node number to edit (1-" + nodeAddresses.length + "): ");
    var nodeNum = parseInt(console.getstr());
    
    if (isNaN(nodeNum) || nodeNum < 1 || nodeNum > nodeAddresses.length) {
        print("Invalid selection.\r\n");
        return false;
    }
    
    var selectedAddr = nodeAddresses[nodeNum - 1];
    var selectedNode = masterNodes[selectedAddr];
    
    print("\r\nEditing node: " + selectedNode.name + " (" + selectedAddr + ")\r\n");
    
    // Get updated information - prefill with current values
    print("Enter BBS Name [" + selectedNode.name + "]: ");
    var name = console.getstr();
    if (!name || name.trim() === "") {
        name = selectedNode.name;
    }
    
    // Address is handled specially since it's the key
    var addressChanged = false;
    var newAddress = "";
    
    print("Enter BBS Address [" + selectedAddr + "]: ");
    newAddress = console.getstr();
    if (!newAddress || newAddress.trim() === "") {
        newAddress = selectedAddr;
    } else if (newAddress !== selectedAddr) {
        addressChanged = true;
        
        // Check if new address already exists
        if (masterNodes[newAddress]) {
            print("Error: A node with address " + newAddress + " already exists.\r\n");
            print("Address change cancelled. Other fields will still be updated.\r\n");
            addressChanged = false;
            newAddress = selectedAddr;
        }
    }
    
    print("Enter SysOp Name [" + selectedNode.sysop + "]: ");
    var sysop = console.getstr();
    if (!sysop || sysop.trim() === "") {
        sysop = selectedNode.sysop;
    }
    
    print("Enter Location [" + selectedNode.location + "]: ");
    var location = console.getstr();
    if (!location || location.trim() === "") {
        location = selectedNode.location;
    }
    
    // Create updated node entry
    var updatedNode = {
        name: name,
        address: newAddress,
        sysop: sysop,
        location: location,
        last_seen: selectedNode.last_seen
    };
    
    // If address changed, remove old entry and add new one
    if (addressChanged) {
        delete masterNodes[selectedAddr];
        masterNodes[newAddress] = updatedNode;
    } else {
        masterNodes[selectedAddr] = updatedNode;
    }
    
    // Save master list
    var f = new File(LC_MASTER_NODELIST);
    if (f.open("w+")) {
        f.write(JSON.stringify(masterNodes, null, 2));
        f.close();
        print("\r\nNode updated successfully in master list!\r\n");
        
        // Update local node list too
        var nodes = loadInterBBSNodes();
        if (addressChanged) {
            delete nodes[selectedAddr];
            nodes[newAddress] = updatedNode;
        } else {
            nodes[selectedAddr] = updatedNode;
        }
        saveInterBBSNodes(nodes);
        print("Local node list also updated.\r\n");
        
        return true;
    } else {
        print("Error: Could not save master node list.\r\n");
        return false;
    }
}

// Function to remove a node from the master list (LC only)
function removeNodeFromMasterList() {
    if (!isLeagueCoordinator()) {
        print("Only the League Coordinator can modify the master node list.\r\n");
        return false;
    }
    
    print("=== REMOVE NODE FROM MASTER LIST ===\r\n");
    
    // Get existing master nodes
    var masterNodes = loadMasterNodeList();
    
    // Display available nodes
    print("Available nodes in master list:\r\n");
    var nodeAddresses = Object.keys(masterNodes);
    
    if (nodeAddresses.length === 0) {
        print("No nodes found in master list.\r\n");
        return false;
    }
    
    for (var i = 0; i < nodeAddresses.length; i++) {
        var addr = nodeAddresses[i];
        var node = masterNodes[addr];
        print(format("%2d. %-25s  %s\r\n", i + 1, node.name, addr));
    }
    
    // Select node to remove
    print("\r\nEnter node number to remove (1-" + nodeAddresses.length + "): ");
    var nodeNum = parseInt(console.getstr());
    
    if (isNaN(nodeNum) || nodeNum < 1 || nodeNum > nodeAddresses.length) {
        print("Invalid selection.\r\n");
        return false;
    }
    
    var selectedAddr = nodeAddresses[nodeNum - 1];
    var selectedNode = masterNodes[selectedAddr];
    
    print("\r\nYou are about to remove: " + selectedNode.name + " (" + selectedAddr + ")\r\n");
    print("This action cannot be undone.\r\n");
    print("Are you sure? (YES to confirm): ");
    
    var confirm = console.getstr();
    if (confirm !== "YES") {
        print("Removal cancelled.\r\n");
        return false;
    }
    
    // Remove the node
    delete masterNodes[selectedAddr];
    
    // Save master list
    var f = new File(LC_MASTER_NODELIST);
    if (f.open("w+")) {
        f.write(JSON.stringify(masterNodes, null, 2));
        f.close();
        print("\r\nNode removed successfully from master list!\r\n");
        
        // Update local node list too
        var nodes = loadInterBBSNodes();
        delete nodes[selectedAddr];
        saveInterBBSNodes(nodes);
        print("Local node list also updated.\r\n");
        
        return true;
    } else {
        print("Error: Could not save master node list.\r\n");
        return false;
    }
}

function convertGamesToSummary(games) {
    var summary = {};
    var ourBBS = getLocalBBS("name") + " (" + getLocalBBS("address") + ")";
    summary[ourBBS] = {};
    
    var playerStats = {};
    for (var i = 0; i < games.length; i++) {
        var game = games[i];
        
        // Skip invalid entries
        if (!game.user || typeof game.user !== 'string') continue;
        
        if (!playerStats[game.user]) {
            playerStats[game.user] = {wins: 0, losses: 0, draws: 0, rating: 1200};
        }
        
        if (game.result && typeof game.result === 'string') {
            var result = game.result.toLowerCase();
            if (result.indexOf("win") !== -1) {
                playerStats[game.user].wins++;
            } else if (result.indexOf("loss") !== -1) {
                playerStats[game.user].losses++;
            } else if (result.indexOf("draw") !== -1) {
                playerStats[game.user].draws++;
            }
        }
        
        // Simple rating calculation
        var totalWins = playerStats[game.user].wins;
        var totalLosses = playerStats[game.user].losses;
        playerStats[game.user].rating = 1200 + (totalWins * 25) - (totalLosses * 15);
    }
    
    summary[ourBBS] = playerStats;
    return summary;
}

function processInboundPlayerListRequest(packet) {
    if (!packet.from) {
        logEvent("Invalid player list request - missing from field");
        return false;
    }
    
    // Get all local players, not just active ones
    var activePlayers = [];
    try {
        for (var i = 1; i <= system.lastuser; i++) {
            var u = new User(i);
            if (u.name && !u.deleted && !u.locked) {
                // Include all valid users, regardless of activity
                activePlayers.push({
                    username: u.alias,
                    lastSeen: strftime("%Y-%m-%d", u.stats.laston_date),
                    totalCalls: u.stats.total_calls
                });
            }
        }
    } catch (e) {
        logEvent("Error getting local users: " + e.message);
    }
    
    // Send response packet
    var responsePacket = {
        type: "player_list_response", 
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            user: "SYSTEM"
        },
        to: packet.from,
        players: activePlayers,
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = "achess_playerlist_resp_" + packet.from.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, responsePacket)) {
        logEvent("Sent player list response to " + packet.from.bbs + " with " + activePlayers.length + " players");
        return true;
    } else {
        logEvent("Failed to send player list response");
        return false;
    }
}

function processInboundPlayerListResponse(packet) {
    if (!packet.from || !packet.players) {
        logEvent("Invalid player list response - missing required fields");
        return false;
    }
    
    var players = loadInterBBSPlayers();
    var nodeAddress = packet.from.address || packet.from.bbs;
    
    // Clear existing players for this node and add new ones
    players[nodeAddress] = [];
    
    if (Array.isArray(packet.players)) {
        for (var i = 0; i < packet.players.length; i++) {
            var player = packet.players[i];
            players[nodeAddress].push({
                username: player.username,
                lastSeen: player.lastSeen || strftime("%Y-%m-%d", time()),
                gamesPlayed: player.gamesPlayed || 0,
                wins: player.wins || 0,
                losses: player.losses || 0,
                draws: player.draws || 0
            });
        }
        
        logEvent("Updated player list from " + packet.from.bbs + " (" + packet.players.length + " players)");
    }
    
    saveInterBBSPlayers(players);
    updateNodeInfo(packet.from);
    
    // Improved notification with better checking for the target user
    if (packet.to && packet.to.user) {
        var targetUser = packet.to.user;
        
        // Try to find the user with case-insensitive matching if necessary
        if (typeof findLocalUser === 'function') {
            var resolvedUser = findLocalUser(targetUser);
            if (resolvedUser && typeof resolvedUser === 'object' && resolvedUser.alias) {
                targetUser = resolvedUser.alias;
            } else if (resolvedUser && typeof resolvedUser === 'string') {
                targetUser = resolvedUser;
            }
        }
        
        sendAchessNotification(targetUser, 
            "Player List Updated", 
            "Player list received from " + packet.from.bbs + "\r\n" +
            "Found " + packet.players.length + " players.\r\n\r\n" +
            "Return to InterBBS Challenge to see the updated list.");
        
        logEvent("Sent player list notification to " + targetUser);
    }
    
    return true;
}

// Save scores
function saveScores(scores) {
    return saveJSONFile(ACHESS_SCORES_FILE, scores);
}

// Generate unique game ID
function generateGameId() {
    var timestamp = strftime("%Y%m%dT%H%M%S", time());
    var random = Math.floor(Math.random() * 1000);
    return getLocalBBS("address").replace(/[^0-9]/g, "") + "_" + timestamp + "_" + random;
}

function getJSONFiles(inboundDir) {
    var files = [];
    
    print("Scanning directory: " + inboundDir + "\r\n");
    
    try {
        if (typeof directory !== "undefined") {
            print("Trying directory() function...\r\n");
            var foundFiles = directory(inboundDir + "*.json");
            if (foundFiles && foundFiles.length > 0) {
                print("Found " + foundFiles.length + " files with directory() function\r\n");
                return foundFiles;
            }
        }
    } catch (e) {
        print("directory() function not available: " + e.message + "\r\n");
    }
    
    print("Using File object enumeration...\r\n");
    
    var now = time();
    var patterns = [
    "chess_", "achess_", "packet_", "challenge_", "move_", "message_", 
    "mail_", "chess_ibbs_", "achess_ibbs_", "chess_playerlist_",
    "achess_playerlist_", "achess_league_", "achess_registry_"
    ];
    
    // Check last 7 days worth of potential filenames
    for (var days = 0; days < 7; days++) {
        var checkTime = now - (days * 24 * 60 * 60);
        var timestamp = strftime("%Y%m%d_%H%M%S", checkTime);
        var dateOnly = strftime("%Y%m%d", checkTime);
        
        for (var p = 0; p < patterns.length; p++) {
            var testFiles = [
                patterns[p] + timestamp + ".json",
                patterns[p] + dateOnly + ".json",
                patterns[p] + checkTime + ".json"
            ];
            
            for (var t = 0; t < testFiles.length; t++) {
                var f = new File(inboundDir + testFiles[t]);
                if (f.exists) {
                    files.push(inboundDir + testFiles[t]);
                    print("FOUND: " + testFiles[t] + "\r\n");
                }
            }
        }
    }
    
    var simpleNames = ["test.json", "packet.json", "chess.json", "challenge.json"];
    for (var i = 0; i < simpleNames.length; i++) {
        var f = new File(inboundDir + simpleNames[i]);
        if (f.exists) {
            files.push(inboundDir + simpleNames[i]);
            print("FOUND: " + simpleNames[i] + "\r\n");
        }
    }
    
    print("Total files found: " + files.length + "\r\n");
    return files;
}

// Process inbound packets
function processInterBBSInboundPackets() {
    var files = getJSONFiles(INTERBBS_IN_DIR);
    var processed = 0;
    
    print("Found " + files.length + " JSON files in inbound directory\r\n");
    
    if (files.length === 0) {
        print("No inbound packets to process.\r\n");
        return;
    }
    
    for (var i = 0; i < files.length; i++) {
        var filename = files[i];
        print("\r\n--- Processing file " + (i + 1) + " of " + files.length + " ---\r\n");
        print("Processing: " + filename + "\r\n");
        
        var packet = loadJSONFile(filename, null);
        if (!packet) {
            print("  ERROR: Could not load packet\r\n");
            continue;
        }
        
        if (processInboundPacket(packet)) {
            processed++;
            // Move processed file to backup location or delete
            var f = new File(filename);
            if (f.exists) {
                f.remove();
                print("  SUCCESS: Packet processed and file removed\r\n");
            }
        } else {
            print("  ERROR: Failed to process packet\r\n");
        }
    }
    
    print("\r\n=== PROCESSING SUMMARY ===\r\n");
    print("Files processed: " + processed + "/" + files.length + "\r\n");
    logEvent("Processed " + processed + " inbound packets");
}

// Process individual inbound packet - UPDATED with node_registry_update case
function processInboundPacket(packet) {
    if (!packet.type) {
        logEvent("Packet missing type field");
        return false;
    }
    
    print("Packet type: " + packet.type + "\r\n");
    
    switch (packet.type.toLowerCase()) {
        case "challenge":
            return processInboundChallenge(packet);
        case "challenge_response":
        case "accept":
        case "decline":
            return processInboundChallengeResponse(packet);
        case "move":
            return processInboundMove(packet);
        case "message":
            return processInboundMessage(packet);
        case "score_update":
            return processInboundScoreUpdate(packet);
        case "node_info":
            return processInboundNodeInfo(packet);
        case "player_list_request":
            return processInboundPlayerListRequest(packet);
        case "player_list_response":
            return processInboundPlayerListResponse(packet);
        case "league_reset":
            return processInboundLeagueReset(packet);
        case "reset_acknowledgment":
            return processInboundResetAck(packet);
        case "node_registry_update":
            return processInboundNodeRegistryUpdate(packet);
        default:
            logEvent("Unknown packet type: " + packet.type);
            return false;
    }
}

// Validate and deduplicate nodes before saving
function validateAndDeduplicateNodes(nodes) {
    var cleaned = {};
    var addressMap = {};
    var nameMap = {};
    
    for (var address in nodes) {
        var node = nodes[address];
        
        // Skip nodes with invalid data
        if (!node || !address) {
            logEvent("WARNING: Skipping invalid node entry");
            continue;
        }
        
        // Provide fallback name if missing
        if (!node.name) {
            node.name = "Unknown BBS (" + address + ")";
            logEvent("WARNING: Added fallback name for address " + address);
        }
        
        // Check for duplicate addresses (primary key)
        if (cleaned[address]) {
            logEvent("WARNING: Duplicate address found: " + address + " - keeping newest entry");
            continue;
        }
        
        // Check for duplicate BBS names (secondary validation)
        var normalizedName = node.name.toLowerCase().trim();
        if (nameMap[normalizedName]) {
            logEvent("WARNING: Duplicate BBS name '" + node.name + "' found at address " + address + 
                    " (conflicts with " + nameMap[normalizedName] + ") - keeping first entry");
            continue;
        }
        
        // Clean and validate node data
        cleaned[address] = {
            name: node.name,
            address: address,
            sysop: node.sysop || "",
            location: node.location || "",
            last_seen: node.last_seen || strftime("%Y-%m-%dT%H:%M:%SZ", time())
        };
        
        nameMap[normalizedName] = address;
    }
    
    return cleaned;
}

// Send league-wide reset packet
function sendLeagueReset() {
    print("=== LEAGUE-WIDE RESET ===\r\n");
    print("This will send a reset packet to ALL known InterBBS nodes.\r\n");
    print("The reset will clear:\r\n");
    print("  - Player databases\r\n");
    print("  - Game scores\r\n");
    print("  - InterBBS messages\r\n");
    print("  - Active games (optional)\r\n");
    print("  - Node statistics\r\n");
    print("\r\n");
    print("WARNING: This action cannot be undone!\r\n");
    print("\r\n");
    
    // Double confirmation
    print("Are you absolutely sure you want to reset the entire league? (yes/no): ");
    var confirm1 = console.getstr(10).toLowerCase();
    
    if (confirm1 !== "yes") {
        print("Reset cancelled.\r\n");
        return false;
    }
    
    print("\r\nThis will affect ALL BBSes in the chess league.\r\n");
    print("Type 'RESET LEAGUE' to confirm: ");
    var confirm2 = console.getstr(20);
    
    if (confirm2 !== "RESET LEAGUE") {
        print("Reset cancelled - confirmation text incorrect.\r\n");
        return false;
    }
    
    // Reset options
    print("\r\nReset Options:\r\n");
    print("Include active games in reset? (Y/N) [N]: ");
    var resetGames = console.getkey().toUpperCase() === "Y";
    
    print("\r\nReset reason/message: ");
    var resetReason = console.getstr(100) || "League-wide reset initiated";
    
    var nodes = loadInterBBSNodes();
    var nodeCount = 0;
    for (var address in nodes) {
        nodeCount++;
    }
    
    if (nodeCount === 0) {
        print("No nodes in database to send reset to\r\n");
        return false;
    }
    
    print("\r\nSending reset packets to " + nodeCount + " nodes...\r\n");
    
    var resetPacket = {
        type: "league_reset",
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            sysop: getLocalBBS("sysop"),
            location: getLocalBBS("location"),
            user: "LEAGUE_COORDINATOR"
        },
        reset_components: {
            players: true,
            scores: true,
            messages: true,
            games: resetGames,
            nodes: false, // Keep node list
            statistics: true
        },
        reset_reason: resetReason,
        reset_timestamp: strftime("%Y-%m-%dT%H:%M:%SZ", time()),
        league_coordinator: getLocalBBS("address"),
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var sent = 0;
    for (var address in nodes) {
        var node = nodes[address];
        
        // Create individual packet for each node
        var nodePacket = {
            type: "league_reset",
            from: resetPacket.from,
            to: {
                bbs: node.name,
                address: node.address
            },
            reset_components: resetPacket.reset_components,
            reset_reason: resetPacket.reset_reason,
            reset_timestamp: resetPacket.reset_timestamp,
            league_coordinator: resetPacket.league_coordinator,
            created: resetPacket.created
        };
        
        var filename = "achess_league_reset_" + address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
        var filepath = INTERBBS_OUT_DIR + filename;
        
        if (saveJSONFile(filepath, nodePacket)) {
            print("  Sent reset packet to " + node.name + " (" + address + ")\r\n");
            sent++;
        } else {
            print("  ERROR: Could not send to " + node.name + "\r\n");
        }
    }
    
    // Log the reset action
    logEvent("LEAGUE RESET: Sent " + sent + " reset packets. Reason: " + resetReason);
    
    print("\r\nReset packets sent: " + sent + "/" + nodeCount + "\r\n");
    print("League-wide reset initiated successfully!\r\n");
    
    // Optionally reset local data too
    print("\r\nReset local data as well? (Y/N) [Y]: ");
    var resetLocal = console.getkey().toUpperCase() !== "N";
    
    if (resetLocal) {
        performLocalReset(resetPacket.reset_components);
        print("Local data reset completed.\r\n");
    }
    
    return true;
}

// Perform local reset based on components
function performLocalReset(components) {
    print("Resetting local data...\r\n");
    
    if (components.players) {
        saveInterBBSPlayers({});
        print("  - Players database cleared\r\n");
    }
    
    if (components.scores) {
        saveScores({});
        print("  - Scores cleared\r\n");
    }
    
    if (components.messages) {
        writeMessages([]);
        print("  - Messages cleared\r\n");
    }
    
    if (components.games) {
        saveInterBBSGames([]);
        print("  - Active games cleared\r\n");
    }
    
    if (components.statistics) {
        // Clear any statistics files if they exist
        print("  - Statistics cleared\r\n");
    }
    
    logEvent("Local reset completed");
}

// Process incoming league reset packet
function processInboundLeagueReset(packet) {
    if (!packet.from || !packet.league_coordinator) {
        logEvent("Invalid league reset packet - missing required fields");
        return false;
    }
    
    // Verify this is from the designated league coordinator
    var myCoordinator = CONFIG.league_coordinator || getLocalBBS("address");
    if (packet.league_coordinator !== myCoordinator) {
        logEvent("League reset rejected - not from authorized coordinator: " + packet.league_coordinator);
        return false;
    }
    
    logEvent("Processing league reset from coordinator: " + packet.from.bbs);
    print("Received league-wide reset packet from " + packet.from.bbs + "\r\n");
    print("Reason: " + (packet.reset_reason || "No reason provided") + "\r\n");
    
    // Perform the reset
    if (packet.reset_components) {
        performLocalReset(packet.reset_components);
    }
    
    // Send acknowledgment back to coordinator
    var ackPacket = {
        type: "reset_acknowledgment",
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            user: "SYSTEM"
        },
        to: packet.from,
        reset_timestamp: packet.reset_timestamp,
        status: "completed",
        message: "League reset completed successfully",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = "achess_reset_ack_" + packet.from.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, ackPacket)) {
        logEvent("Sent reset acknowledgment to " + packet.from.bbs);
    }
    
    // Send notification to local users
    sendAchessNotification("ALL", "League Reset Completed", 
        "The InterBBS Chess League has been reset.\r\n\r\n" +
        "Reason: " + (packet.reset_reason || "Administrative reset") + "\r\n" +
        "Initiated by: " + packet.from.bbs + "\r\n\r\n" +
        "All player statistics, scores, and messages have been cleared.\r\n" +
        "You can start fresh with new games and challenges!");
    
    logEvent("League reset completed successfully");
    return true;
}

// Process reset acknowledgment
function processInboundResetAck(packet) {
    if (!packet.from || !packet.reset_timestamp) {
        logEvent("Invalid reset acknowledgment - missing required fields");
        return false;
    }
    
    logEvent("Reset acknowledgment received from " + packet.from.bbs + ": " + (packet.message || "No message"));
    print("Reset acknowledgment from " + packet.from.bbs + ": " + packet.status + "\r\n");
    
    return true;
}

// Process inbound challenge - UPDATED: Case-insensitive username matching
function processInboundChallenge(packet) {
    if (!packet.from || (!packet.challenge_id && !packet.game_id)) {
        logEvent("Invalid challenge packet - missing required fields");
        return false;
    }
    
    var games = loadInterBBSGames();
    var challengeId = packet.challenge_id || packet.game_id;
    
    // Check if challenge already exists
    for (var i = 0; i < games.length; i++) {
        if (games[i].challenge_id === challengeId || games[i].game_id === challengeId) {
            logEvent("Challenge already exists: " + challengeId);
            return true;
        }
    }
    
    // Determine target user with case-insensitive matching
    var targetUser = "PENDING";
    if (packet.to && packet.to.user) {
        targetUser = findLocalUser(packet.to.user);
        logEvent("Challenge targeted to: " + packet.to.user + " (resolved to: " + targetUser + ")");
    }
    
    // Create new game record
    var game = {
        game_id: packet.game_id || generateGameId(),
        challenge_id: challengeId,
        status: "pending",
        players: {
            white: packet.color === "white" ? packet.from : { user: targetUser, bbs: getLocalBBS("name"), address: getLocalBBS("address") },
            black: packet.color === "black" ? packet.from : { user: targetUser, bbs: getLocalBBS("name"), address: getLocalBBS("address") }
        },
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        turn: "white",
        move_history: [],
        created: packet.created || strftime("%Y-%m-%dT%H:%M:%SZ", time()),
        last_update: strftime("%Y-%m-%dT%H:%M:%SZ", time()),
        challenge_message: packet.message || "",
        time_control: packet.time_control || ""
    };
    
    games.push(game);
    saveInterBBSGames(games);
    
    // Send AChess notification for challenge (use resolved username if specific, otherwise ALL)
    var notificationTarget = (targetUser && targetUser !== "PENDING") ? targetUser : "ALL";
    var subject = "InterBBS Chess Challenge from " + packet.from.user;
    var body = "You have received an InterBBS chess challenge!\r\n\r\n" +
               "From: " + packet.from.user + " @ " + packet.from.bbs + "\r\n" +
               "Color: You will play as " + (packet.color === "white" ? "Black" : "White") + "\r\n" +
               "Game ID: " + challengeId + "\r\n";
    
    if (packet.time_control) {
        body += "Time Control: " + packet.time_control + "\r\n";
    }
    
    if (packet.message) {
        body += "Message: " + packet.message + "\r\n";
    }
    
    body += "\r\nGo to the Chess menu and select 'View/Respond to InterBBS Challenges' to accept or decline.";
    
    // ADDED: Verify notification path before sending
    verifyNotificationPath();
    sendAchessNotification(notificationTarget, subject, body);
    
    // Update databases
    updateNodeInfo(packet.from);
    updatePlayerInfo(packet.from);
    
    logEvent("Received challenge from " + packet.from.user + " @ " + packet.from.bbs + " (target: " + notificationTarget + ")");
    return true;
}

// Process inbound challenge response - UPDATED: Case-insensitive matching
function processInboundChallengeResponse(packet) {
    var challengeId = packet.challenge_id || packet.game_id;
    if (!challengeId) {
        logEvent("Invalid challenge response - missing challenge/game ID");
        return false;
    }
    
    var games = loadInterBBSGames();
    
    for (var i = 0; i < games.length; i++) {
        if (games[i].challenge_id === challengeId || games[i].game_id === challengeId) {
            if (packet.type === "accept" || packet.accepted === true) {
                games[i].status = "active";
                if (packet.players) {
                    games[i].players.white = packet.players.white || games[i].players.white;
                    games[i].players.black = packet.players.black || games[i].players.black;
                }
                
                // Determine notification target with case-insensitive matching
                var notificationTarget = "ALL";
                if (games[i].players.white && games[i].players.white.user) {
                    var whiteUser = findLocalUser(games[i].players.white.user);
                    if (whiteUser && whiteUser !== "PENDING") {
                        notificationTarget = whiteUser;
                    }
                } else if (games[i].players.black && games[i].players.black.user) {
                    var blackUser = findLocalUser(games[i].players.black.user);
                    if (blackUser && blackUser !== "PENDING") {
                        notificationTarget = blackUser;
                    }
                }
                
                // Send AChess notification about accepted challenge
                var subject = "InterBBS Challenge Accepted!";
                var body = "Your InterBBS chess challenge has been accepted!\r\n\r\n" +
                           "Game ID: " + challengeId + "\r\n" +
                           "Opponent: " + (packet.from ? packet.from.user + " @ " + packet.from.bbs : "Remote player") + "\r\n\r\n" +
                           "Go to the Chess menu and select 'View/Move in My InterBBS Games' to make your move.";
                sendAchessNotification(notificationTarget, subject, body);
                
                logEvent("Challenge accepted: " + challengeId + " (notified: " + notificationTarget + ")");
            } else {
                games[i].status = "declined";
                
                // Determine notification target with case-insensitive matching
                var notificationTarget = "ALL";
                if (games[i].players.white && games[i].players.white.user) {
                    var whiteUser = findLocalUser(games[i].players.white.user);
                    if (whiteUser && whiteUser !== "PENDING") {
                        notificationTarget = whiteUser;
                    }
                } else if (games[i].players.black && games[i].players.black.user) {
                    var blackUser = findLocalUser(games[i].players.black.user);
                    if (blackUser && blackUser !== "PENDING") {
                        notificationTarget = blackUser;
                    }
                }
                
                // Send AChess notification about declined challenge
                var subject = "InterBBS Challenge Declined";
                var body = "Your InterBBS chess challenge was declined.\r\n\r\n" +
                           "Game ID: " + challengeId + "\r\n" +
                           "Opponent: " + (packet.from ? packet.from.user + " @ " + packet.from.bbs : "Remote player");
                sendAchessNotification(notificationTarget, subject, body);
                
                logEvent("Challenge declined: " + challengeId + " (notified: " + notificationTarget + ")");
            }
            games[i].last_update = strftime("%Y-%m-%dT%H:%M:%SZ", time());
            saveInterBBSGames(games);
            
            if (packet.from) {
                updatePlayerInfo(packet.from);
            }
            
            return true;
        }
    }
    
    logEvent("Challenge response for unknown challenge: " + challengeId);
    return false;
}

// Process inbound move - UPDATED: Case-insensitive matching
function processInboundMove(packet) {
    if (!packet.game_id || !packet.move || !packet.fen) {
        logEvent("Invalid move packet - missing required fields");
        return false;
    }
    
    var games = loadInterBBSGames();
    
    for (var i = 0; i < games.length; i++) {
        if (games[i].game_id === packet.game_id) {
            games[i].fen = packet.fen;
            games[i].move_history = packet.move_history || games[i].move_history;
            if (!games[i].move_history) games[i].move_history = [];
            games[i].move_history.push(packet.move);
            games[i].turn = (games[i].turn === "white") ? "black" : "white";
            games[i].last_update = strftime("%Y-%m-%dT%H:%M:%SZ", time());
            
            if (packet.game_status) {
                games[i].status = packet.game_status;
            }
            
            saveInterBBSGames(games);
            
            // Determine notification target with case-insensitive matching
            var notificationTarget = "ALL";
            var currentTurn = games[i].turn;
            
            if (currentTurn === "white" && games[i].players.white && games[i].players.white.user) {
                var whiteUser = findLocalUser(games[i].players.white.user);
                if (whiteUser && whiteUser !== "PENDING") {
                    notificationTarget = whiteUser;
                }
            } else if (currentTurn === "black" && games[i].players.black && games[i].players.black.user) {
                var blackUser = findLocalUser(games[i].players.black.user);
                if (blackUser && blackUser !== "PENDING") {
                    notificationTarget = blackUser;
                }
            }
            
            // Send AChess notification about new move
            var subject = "New InterBBS Move!";
            var body = "Your opponent has made a move in your InterBBS chess game!\r\n\r\n" +
                       "Game ID: " + packet.game_id + "\r\n" +
                       "Move: " + packet.move + "\r\n" +
                       "From: " + (packet.from ? packet.from.user + " @ " + packet.from.bbs : "Remote player") + "\r\n\r\n";
            
            if (games[i].status === "finished" || games[i].status === "completed") {
                body += "Game has ended!\r\n\r\n";
            } else {
                body += "It's your turn to move!\r\n\r\n";
            }
            
            body += "Go to the Chess menu and select 'View/Move in My InterBBS Games' to see the board and make your move.";
            
            // ADDED: Verify notification path before sending
            verifyNotificationPath();
            sendAchessNotification(notificationTarget, subject, body);
            
            if (packet.from) {
                updatePlayerInfo(packet.from);
            }
            
            logEvent("Received move for game " + packet.game_id + ": " + packet.move + " (notified: " + notificationTarget + ")");
            return true;
        }
    }
    
    logEvent("Move for unknown game: " + packet.game_id);
    return false;
}

// ProcessInboundMessage function
function processInboundMessage(packet) {
    logEvent("Processing InterBBS message packet");

    // Validate packet structure
    if (!packet || typeof packet !== 'object') {
        logEvent("ERROR: Invalid message packet - not an object");
        return false;
    }

    // Handle both direct packet format and data-wrapped format
    var messageData = packet.data || packet;

    // Log what we actually received
    logEvent("Message packet structure: " + Object.keys(packet).join(", "));
    if (packet.data) {
        logEvent("Message data keys: " + Object.keys(messageData).join(", "));
    }

    // Check for required fields - handle multiple packet formats
    var hasFromInfo = false;
    var hasMessageBody = false;

    // Check for from information (multiple possible formats) 
    if (
        messageData.from ||
        (messageData.from_user && (messageData.from_bbs || messageData.bbs)) ||
        (messageData.from_user && messageData.from_address) ||
        (messageData.from_user && messageData.address) ||
        (messageData.from_user && messageData.bbs && messageData.address)
    ) { // NEW: handle root level bbs+address
        hasFromInfo = true;
    }

    // Check for message body - UPDATED to be more lenient
    if (
        (messageData.message && messageData.message.trim() !== "") ||
        (messageData.body && messageData.body.trim() !== "") ||
        (messageData.subject && messageData.subject.trim() !== "")
    ) { // NEW: allow subject-only messages
        hasMessageBody = true;
    }

    // SPECIAL CASE: If it's a valid packet structure but no meaningful content, treat as a "ping" message
    if (!hasMessageBody && hasFromInfo && messageData.type === "message") {
        logEvent("Processing empty message packet as ping/status message");
        hasMessageBody = true; // Allow empty messages through
    }

    if (!hasFromInfo || !hasMessageBody) {
        logEvent("ERROR: Invalid message packet - missing required fields (from info or message body)");
        logEvent("Available fields: " + Object.keys(messageData).join(', '));

        // Log the actual values for debugging
        for (var key in messageData) {
            logEvent("  " + key + " = '" + messageData[key] + "'");
        }

        return false;
    }

    // Extract from information - handle both formats - UPDATED
    var fromUser, fromBBS, fromAddr;
    if (messageData.from && typeof messageData.from === 'object') {
        fromUser = messageData.from.user || messageData.from_user;
        fromBBS = messageData.from.bbs || messageData.from_bbs || messageData.bbs;
        fromAddr = messageData.from.address || messageData.from_address || messageData.address;
    } else {
        fromUser = messageData.from_user;
        fromBBS = messageData.from_bbs || messageData.bbs; // Now includes 'bbs' fallback
        fromAddr = messageData.from_address || messageData.address;
    }

    // Determine target user with case-insensitive matching - UPDATED FIX
    var targetUser = null;
    var targetAlias = messageData.to_user || (messageData.to ? messageData.to.user : null);

    // Only default to ALL if explicitly set, not if blank
    if (
        typeof targetAlias === "string" &&
        targetAlias.trim() !== "" &&
        targetAlias.toUpperCase() !== "ALL"
    ) {
        var resolvedUser = findLocalUser(targetAlias);
        if (resolvedUser && typeof resolvedUser === 'object' && resolvedUser.alias) {
            targetUser = resolvedUser.alias;
            logEvent("Message targeted to: " + targetAlias + " (resolved to: " + targetUser + ")");
        } else if (resolvedUser && typeof resolvedUser === 'string') {
            targetUser = resolvedUser;
            logEvent("Message targeted to: " + targetAlias + " (using fallback: " + targetUser + ")");
        } else {
            targetUser = targetAlias;
            logEvent("Message targeted to: " + targetAlias + " (using original alias)");
        }
    } else {
        targetUser = "ALL";
        logEvent("Message has no specific target user, sending to ALL");
    }

    var message = {
        from_user: fromUser,
        from_bbs: fromBBS,
        from_addr: fromAddr,
        to_user: targetUser,
        to_bbs: getLocalBBS("name"),
        to_addr: getLocalBBS("address"),
        subject: messageData.subject || "InterBBS Message",
        body: messageData.message || messageData.body || messageData.subject || "[Empty Message/Ping]", // UPDATED: fallback to subject or ping
        created: messageData.created || strftime("%Y-%m-%d %H:%M:%S", time()),
        read: false
    };

    var messages = readMessages();
    messages.push(message);
    writeMessages(messages);

    // Send AChess notification about new message
    var subject = "New InterBBS Message!";
    var body =
        "You have received a new InterBBS message!\r\n\r\n" +
        "From: " + message.from_user + " @ " + message.from_bbs + "\r\n" +
        "Subject: " + message.subject + "\r\n\r\n" +
        "Go to the Chess menu and select 'Read InterBBS Messages' to view the message.";
    
    // ADDED: Verify notification path before sending
    verifyNotificationPath();
    sendAchessNotification(targetUser, subject, body);

    // Update player info - handle both packet formats
    var playerInfo = {
        user: fromUser,
        bbs: fromBBS,
        address: fromAddr
    };
    updatePlayerInfo(playerInfo);

    logEvent(
        "Received message from " +
        message.from_user +
        " @ " +
        message.from_bbs +
        " (target: " + targetUser + ")"
    );
    return true;
}

// Process inbound score update - UPDATED: Case-insensitive matching
function processInboundScoreUpdate(packet) {
    if (!packet.from || !packet.scores) {
        logEvent("Invalid score update - missing required fields");
        return false;
    }
    
    var scores = loadScores();
    var bbs_key = packet.from.bbs + " (" + packet.from.address + ")";
    
    if (!scores[bbs_key]) {
        scores[bbs_key] = {};
    }
    
    // Handle both array and object format scores with case-insensitive username handling
    if (Array.isArray(packet.scores)) {
        for (var i = 0; i < packet.scores.length; i++) {
            var score = packet.scores[i];
            var username = score.name || score.user;
            
            // Check if this user already exists with different case
            var existingUser = null;
            for (var existingUsername in scores[bbs_key]) {
                if (isUserMatch(existingUsername, username)) {
                    existingUser = existingUsername;
                    break;
                }
            }
            
            // Use existing case or new case
            var finalUsername = existingUser || username;
            scores[bbs_key][finalUsername] = {
                wins: score.wins || 0,
                losses: score.losses || 0,
                draws: score.draws || 0,
                rating: score.rating || 1200
            };
            
            if (existingUser && existingUser !== username) {
                logEvent("Score update: case resolved " + username + " -> " + finalUsername);
            }
        }
    } else {
        for (var user in packet.scores) {
            // Check if this user already exists with different case
            var existingUser = null;
            for (var existingUsername in scores[bbs_key]) {
                if (isUserMatch(existingUsername, user)) {
                    existingUser = existingUsername;
                    break;
                }
            }
            
            // Use existing case or new case
            var finalUsername = existingUser || user;
            scores[bbs_key][finalUsername] = packet.scores[user];
            
            if (existingUser && existingUser !== user) {
                logEvent("Score update: case resolved " + user + " -> " + finalUsername);
            }
        }
    }
    
    saveScores(scores);
    updateNodeInfo(packet.from);
    updatePlayerInfo(packet.from);
    
    logEvent("Updated scores from " + packet.from.bbs);
    return true;
}

// Process inbound node info
function processInboundNodeInfo(packet) {
    if (!packet.from) {
        logEvent("Invalid node info - missing from field");
        return false;
    }
    
    // Validate the node registration before updating
    if (!updateNodeInfo(packet.from)) {
        logEvent("Rejected potentially duplicate node registration from " + 
                (packet.from.bbs || "unknown") + " (" + (packet.from.address || "unknown") + ")");
        return false;
    }
    
    // Update player info only if node validation succeeded
    updatePlayerInfo(packet.from);
    logEvent("Updated node info for " + packet.from.bbs);
    return true;
}

// Update node information
function updateNodeInfo(nodeInfo) {
    // Validate first (this will add fallback name if needed)
    if (!validateNodeRegistration(nodeInfo)) {
        var safeAddress = nodeInfo ? (nodeInfo.address || "unknown") : "unknown";
        var safeName = nodeInfo ? (nodeInfo.name || nodeInfo.bbs || "unknown") : "unknown";
        logEvent("Node registration rejected for: " + safeAddress + " (" + safeName + ")");
        return false;
    }
    
    var nodes = loadInterBBSNodes();
    var key = nodeInfo.address;
    
    nodes[key] = {
        name: nodeInfo.name || nodeInfo.bbs || "Unknown BBS",
        address: nodeInfo.address,
        sysop: nodeInfo.sysop || "",
        location: nodeInfo.location || "",
        last_seen: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    saveInterBBSNodes(nodes);
    logEvent("Node info updated: " + nodes[key].name + " (" + nodeInfo.address + ")");
    return true;
}

var LC_MASTER_NODELIST = js.exec_dir + "lc_master_nodes.json";

// Function to create/update the master node list (LC only)
function createMasterNodeList() {
    if (!isLeagueCoordinator()) {
        print("Only the League Coordinator can manage the master node list.\r\n");
        return false;
    }
    
    // Get current nodes
    var nodes = loadInterBBSNodes();
    
    // Save to master file
    var f = new File(LC_MASTER_NODELIST);
    if (f.open("w+")) {
        f.write(JSON.stringify(nodes, null, 2));
        f.close();
        print("Master node list created/updated with " + Object.keys(nodes).length + " nodes.\r\n");
        return true;
    }
    
    print("Error: Could not create master node list.\r\n");
    return false;
}

// Load the master node list (LC only)
function loadMasterNodeList() {
    if (!file_exists(LC_MASTER_NODELIST)) {
        if (isLeagueCoordinator()) {
            // Auto-create if LC
            createMasterNodeList();
        }
        return {};
    }
    
    var f = new File(LC_MASTER_NODELIST);
    if (!f.open("r")) return {};
    
    var nodes = {};
    try {
        nodes = JSON.parse(f.read());
    } catch(e) {
        logEvent("Error parsing master node list: " + e.toString());
    }
    f.close();
    
    return nodes;
}

function processInboundNodeRegistryUpdate(packet) {
    if (!packet.from || !packet.node_registry) {
        logEvent("Invalid node registry update - missing required fields");
        return false;
    }
    
    logEvent("Processing node registry update from " + packet.from.bbs);
    
    // Get the LC address from the first node in chess_nodes.ini
    var lcAddress = null;
    var nodeFile = ACHESS_DATA_DIR + "chess_nodes.ini";
    if (file_exists(nodeFile)) {
        var f = new File(nodeFile);
        if (f.open("r")) {
            var lines = f.readAll();
            f.close();
            
            // Look for the first [Node1] section - Node1 is ALWAYS the LC
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line === "[Node1]") {
                    // Found Node1, now get its address
                    for (var j = i + 1; j < lines.length; j++) {
                        var nextLine = lines[j].trim();
                        if (nextLine.indexOf("[") === 0) break;
                        if (nextLine.indexOf("address") === 0) {
                            var m = nextLine.match(/address\s*=\s*(.+)/);
                            if (m) {
                                lcAddress = m[1].trim();
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }
    }
    
    // Verify this is from the league coordinator (Node1)
    if (!lcAddress || packet.from.address !== lcAddress) {
        logEvent("Rejected node registry update - not from authorized coordinator: " + 
                packet.from.address + " (LC is: " + lcAddress + ")");
        return false;
    }
    
    var currentNodes = loadInterBBSNodes();
    var updatedNodes = packet.node_registry;
    
    for (var address in updatedNodes) {
        currentNodes[address] = updatedNodes[address];
        logEvent("Updated node registry entry: " + address);
    }
    
    saveInterBBSNodes(currentNodes);
    updateNodeInfo(packet.from);
    
    logEvent("Node registry updated successfully from " + packet.from.bbs);
    return true;
}

// Helper function to send InterBBS message
function sendInterBBSMessage(targetUser, fromInfo, subject, messageBody) {
    try {
        
        var msgbase = new MsgBase("mail");
        if (!msgbase.open()) {
            logEvent("ERROR: Could not open mail message base");
            return false;
        }
        
        var targetAlias = targetUser;
        var targetNumber = 0;
        
        // Handle both object and string format for targetUser
        if (typeof targetUser === 'object' && targetUser.alias) {
            targetAlias = targetUser.alias;
            targetNumber = targetUser.number || 0;
        }
        
        var hdr = {
            to: targetAlias,
            to_ext: targetNumber,
            from: fromInfo,
            subject: subject,
            when_written_time: time(),
            when_imported_time: time()
        };
        
        var success = msgbase.save_msg(hdr, messageBody);
        msgbase.close();
        
        return success;
        
    } catch (e) {
        logEvent("ERROR: Exception sending message: " + e.toString());
        return false;
    }
}

function processInterBBSInboundPacket(filename) {
    try {
        logEvent("Processing: " + filename);
        
        var content = file_get_contents(filename);
        if (!content) {
            logEvent("ERROR: Could not read packet file: " + filename);
            return false;
        }
        
        var packet;
        try {
            packet = JSON.parse(content);
        } catch (e) {
            logEvent("ERROR: Invalid JSON in packet file: " + filename + " - " + e.toString());
            return false;
        }
        
        if (!packet.type) {
            logEvent("ERROR: Packet missing type field: " + filename);
            return false;
        }
        
        logEvent("Packet type: " + packet.type);
        
        var success = false;
        
        switch (packet.type.toLowerCase()) {
            case "challenge":
                success = processInboundChallenge(packet);
                break;
            case "challenge_response":
            case "accept":
            case "decline":
                success = processInboundChallengeResponse(packet);
                break;
            case "move":
                success = processInboundMove(packet);
                break;
            case "message":
                success = processInboundMessage(packet);
                break;
            case "score_update":
                success = processInboundScoreUpdate(packet);
                break;
            case "node_info":
            case "nodeinfo":
                success = processInboundNodeInfo(packet);
                break;
            case "player_list_request":
                success = processInboundPlayerListRequest(packet);
                break;
            case "player_list_response":
                success = processInboundPlayerListResponse(packet);
                break;
            case "league_reset":
                success = processInboundLeagueReset(packet);
                break;
            case "reset_acknowledgment":
                success = processInboundResetAck(packet);
                break;
            case "node_registry_update":
                success = processInboundNodeRegistryUpdate(packet);
                break;
            case "response":
                success = processInterBBSResponse(packet);
                break;
            default:
                logEvent("ERROR: Unknown packet type: " + packet.type);
                return false;
        }
        
        if (success) {
            logEvent("Successfully processed packet: " + filename);
            // Move to processed folder
            var processedDir = INTERBBS_IN_DIR.replace(/inbound/i, "processed");
            if (!file_exists(processedDir)) {
                try {
                    mkdir(processedDir);
                } catch (e) {
                    logEvent("Could not create processed directory: " + e.toString());
                }
            }
            var newPath = processedDir + "/" + file_getname(filename);
            try {
                file_rename(filename, newPath);
                logEvent("Moved processed packet to: " + newPath);
            } catch (e) {
                logEvent("Could not move processed packet: " + e.toString());
                // If move fails, just delete the original
                try {
                    var f = new File(filename);
                    if (f.exists) {
                        f.remove();
                        logEvent("Deleted processed packet: " + filename);
                    }
                } catch (e2) {
                    logEvent("Could not delete processed packet: " + e2.toString());
                }
            }
        } else {
            logEvent("ERROR: Failed to process packet: " + filename);
            // Move to error folder for manual review
            var errorDir = INTERBBS_IN_DIR.replace(/inbound/i, "error");
            if (!file_exists(errorDir)) {
                try {
                    mkdir(errorDir);
                } catch (e) {
                    logEvent("Could not create error directory: " + e.toString());
                }
            }
            var errorPath = errorDir + "/" + file_getname(filename);
            try {
                file_rename(filename, errorPath);
                logEvent("Moved error packet to: " + errorPath);
            } catch (e) {
                logEvent("Could not move error packet: " + e.toString());
            }
        }
        
        return success;
        
    } catch (e) {
        logEvent("ERROR: Exception processing packet " + filename + ": " + e.toString());
        return false;
    }
}

// Helper function for file operations if they don't exist
function file_get_contents(filename) {
    var f = new File(filename);
    if (!f.exists || !f.open("r")) {
        return null;
    }
    var content = f.read();
    f.close();
    return content;
}

function file_getname(filepath) {
    var parts = filepath.split("/");
    return parts[parts.length - 1];
}

function file_exists(path) {
    var f = new File(path);
    return f.exists;
}

function mkdir(path) {
    return mkpath(path);
}

function file_rename(oldPath, newPath) {
    var oldFile = new File(oldPath);
    if (oldFile.exists) {
        return oldFile.moveTo(newPath);
    }
    return false;
}

// message debugging
function debugMessagePacket(filename) {
    print("=== DEBUGGING MESSAGE PACKET ===\r\n");
    print("File: " + filename + "\r\n");
    
    var content = file_get_contents(filename);
    if (!content) {
        print("ERROR: Could not read file\r\n");
        return;
    }
    
    try {
        var packet = JSON.parse(content);
        print("Raw packet structure:\r\n");
        print(JSON.stringify(packet, null, 2) + "\r\n");
        
        print("\r\nPacket analysis:\r\n");
        print("- Type: " + (packet.type || "MISSING") + "\r\n");
        print("- Has data field: " + (packet.data ? "YES" : "NO") + "\r\n");
        
        if (packet.data) {
            print("- Data keys: " + Object.keys(packet.data).join(", ") + "\r\n");
            print("\r\nField by field:\r\n");
            
            var expectedFields = ['from_bbs', 'from_user', 'to_bbs', 'to_user', 'message', 'subject'];
            for (var i = 0; i < expectedFields.length; i++) {
                var field = expectedFields[i];
                var value = packet.data[field];
                var status = value ? "PRESENT" : "MISSING";
                print("  " + field + ": " + status);
                if (value) {
                    print(" ('" + value + "')");
                }
                print("\r\n");
            }
        }
        
    } catch (e) {
        print("ERROR: Invalid JSON - " + e.toString() + "\r\n");
        print("Raw content:\r\n" + content + "\r\n");
    }
    
    print("================================\r\n");
}

// Send outbound packets
function sendInterBBSPackets() {
    print("Sending score updates to all known nodes...\r\n");
    
    var nodes = loadInterBBSNodes();
    var scores = loadScores();
    var localScores = scores[getLocalBBS("name") + " (" + getLocalBBS("address") + ")"] || {};
    
    var nodeCount = 0;
    for (var address in nodes) {
        nodeCount++;
    }
    
    if (nodeCount === 0) {
        print("No nodes in database to send to\r\n");
        return;
    }
    
    var sent = 0;
    for (var address in nodes) {
        var node = nodes[address];
        
        var packet = {
            type: "score_update",
            from: {
                bbs: getLocalBBS("name"),
                address: getLocalBBS("address"),
                sysop: getLocalBBS("sysop"),
                location: getLocalBBS("location")
            },
            to: {
                bbs: node.name,
                address: node.address
            },
            scores: localScores,
            created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
        };
        
        var filename = "achess_scores_" + address.replace(/[^A-Za-z0-9]/g, "_") + ".json";
        var filepath = INTERBBS_OUT_DIR + filename;
        
        if (saveJSONFile(filepath, packet)) {
            print("  Sent scores to " + node.name + " (" + address + ")\r\n");
            sent++;
        } else {
            print("  ERROR: Could not send to " + node.name + "\r\n");
        }
    }
    
    print("Score packets sent: " + sent + "/" + nodeCount + "\r\n");
    logEvent("Sent " + sent + " score packets");
}

// Send outbound challenge
function sendInterBBSChallenge(targetBBS, targetUser, color, message, timeControl) {
    var nodes = loadInterBBSNodes();
    var targetNode = null;
    
    // Find target node (case-insensitive BBS name matching)
    for (var address in nodes) {
        if (equalsIgnoreCase(nodes[address].name, targetBBS)) {
            targetNode = nodes[address];
            break;
        }
    }
    
    if (!targetNode) {
        print("ERROR: Target BBS not found: " + targetBBS + "\r\n");
        return false;
    }
    
    var challengeId = "challenge_" + generateGameId();
    
    var packet = {
        type: "challenge",
        game_id: challengeId,
        challenge_id: challengeId,
        from: {
            user: user.alias || user.name || "LocalUser",
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address")
        },
        to: {
            user: targetUser,
            bbs: targetNode.name,
            address: targetNode.address
        },
        color: color || "white",
        message: message || "InterBBS chess challenge",
        time_control: timeControl || "",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = "achess_challenge_" + targetNode.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, packet)) {
        print("Challenge sent to " + targetUser + " @ " + targetBBS + "\r\n");
        logEvent("Sent challenge to " + targetUser + " @ " + targetBBS);
        
        // Add pending game to local database
        var games = loadInterBBSGames();
        var game = {
            game_id: challengeId,
            challenge_id: challengeId,
            status: "sent",
            players: {
                white: color === "white" ? packet.from : packet.to,
                black: color === "black" ? packet.from : packet.to
            },
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            turn: "white",
            move_history: [],
            created: packet.created,
            last_update: packet.created,
            challenge_message: message,
            time_control: timeControl || ""
        };
        
        games.push(game);
        saveInterBBSGames(games);
        
        return true;
    } else {
        print("ERROR: Could not send challenge\r\n");
        return false;
    }
}

// Send outbound move
function sendInterBBSMove(gameId, move, fen, moveHistory, gameStatus) {
    var games = loadInterBBSGames();
    var game = null;
    
    // Find the game
    for (var i = 0; i < games.length; i++) {
        if (games[i].game_id === gameId) {
            game = games[i];
            break;
        }
    }
    
    if (!game) {
        print("ERROR: Game not found: " + gameId + "\r\n");
        return false;
    }
    
    // Determine opponent
    var opponent = null;
    var currentUser = user.alias || user.name || "LocalUser";
    
    if (game.players.white && isUserMatch(game.players.white.user, currentUser)) {
        opponent = game.players.black;
    } else if (game.players.black && isUserMatch(game.players.black.user, currentUser)) {
        opponent = game.players.white;
    }
    
    if (!opponent || !opponent.address) {
        print("ERROR: Cannot determine opponent for game " + gameId + "\r\n");
        return false;
    }
    
    var packet = {
        type: "move",
        game_id: gameId,
        move: move,
        fen: fen,
        move_history: moveHistory || game.move_history,
        game_status: gameStatus || "active",
        from: {
            user: currentUser,
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address")
        },
        to: opponent,
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = "achess_move_" + opponent.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, packet)) {
        print("Move sent to " + opponent.user + " @ " + opponent.bbs + "\r\n");
        logEvent("Sent move " + move + " for game " + gameId);
        return true;
    } else {
        print("ERROR: Could not send move\r\n");
        return false;
    }
}

// Send outbound message - UPDATED to match expected format
function sendInterBBSMessage(targetBBS, targetUser, subject, body) {
    var nodes = loadInterBBSNodes();
    var targetNode = null;
    
    // Find target node (case-insensitive BBS name matching)
    for (var address in nodes) {
        if (equalsIgnoreCase(nodes[address].name, targetBBS)) {
            targetNode = nodes[address];
            break;
        }
    }
    
    if (!targetNode) {
        print("ERROR: Target BBS not found: " + targetBBS + "\r\n");
        return false;
    }
    
    // UPDATED: Create packet in root-level format that matches inbound expectations
    var packet = {
        type: "message",
        bbs: getLocalBBS("name"),                    // Root level
        address: getLocalBBS("address"),             // Root level  
        to_bbs: targetNode.name,
        to_addr: targetNode.address,
        to_user: targetUser || "",
        from_user: user.alias || user.name || "LocalUser",
        subject: subject || "InterBBS Message",
        body: body || "",
        created: strftime("%Y-%m-%d %H:%M:%S", time())  // Match X-Bit format
    };
    
    var filename = "achess_message_" + targetNode.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, packet)) {
        print("Message sent to " + (targetUser || "ALL") + " @ " + targetBBS + "\r\n");
        logEvent("Sent message to " + (targetUser || "ALL") + " @ " + targetBBS);
        return true;
    } else {
        print("ERROR: Could not send message\r\n");
        return false;
    }
}

// Show current scores
function showScores() {
    var scores = loadScores();
    
    print("Current InterBBS Chess Scores:\r\n");
    print(repeatChar("=", 60) + "\r\n");
    
    var hasScores = false;
    for (var bbs in scores) {
        hasScores = true;
        print("\r\n" + bbs + ":\r\n");
        print(repeatChar("-", 40) + "\r\n");
        
        var bbsScores = scores[bbs];
        var hasUsers = false;
        
        for (var user in bbsScores) {
            hasUsers = true;
            var userScore = bbsScores[user];
            print(format("  %-20s  W:%3d L:%3d D:%3d  Rating:%4d\r\n",
                user,
                userScore.wins || 0,
                userScore.losses || 0,
                userScore.draws || 0,
                userScore.rating || 1200
            ));
        }
        
        if (!hasUsers) {
            print("  No players recorded\r\n");
        }
    }
    
    if (!hasScores) {
        print("No scores recorded yet\r\n");
    }
}

// Show InterBBS games
function showInterBBSGames() {
    var games = loadInterBBSGames();
    
    print("Current InterBBS Chess Games:\r\n");
    print(repeatChar("=", 80) + "\r\n");
    
    if (games.length === 0) {
        print("No InterBBS games found\r\n");
        return;
    }
    
    for (var i = 0; i < games.length; i++) {
        var game = games[i];
        print("Game " + (i + 1) + ":\r\n");
        print("  ID: " + game.game_id + "\r\n");
        print("  Status: " + game.status + "\r\n");
        
        if (game.players) {
            if (game.players.white) {
                print("  White: " + game.players.white.user + " @ " + game.players.white.bbs + "\r\n");
            }
            if (game.players.black) {
                print("  Black: " + game.players.black.user + " @ " + game.players.black.bbs + "\r\n");
            }
        }
        
        print("  Turn: " + (game.turn || "white") + "\r\n");
        print("  Created: " + (game.created || "Unknown") + "\r\n");
        print("  Last Update: " + (game.last_update || "Unknown") + "\r\n");
        
        if (game.move_history && game.move_history.length > 0) {
            print("  Moves: " + game.move_history.join(" ") + "\r\n");
        }
        
        if (game.time_control) {
            print("  Time Control: " + game.time_control + "\r\n");
        }
        
        print("\r\n");
    }
}

// Show InterBBS messages with interactive management
function showInterBBSMessages() {
    var messages = readMessages();
    
    if (messages.length === 0) {
        print("No InterBBS messages found\r\n");
        return;
    }
    
    while (true) {
        print("\r\n" + repeatChar("=", 60) + "\r\n");
        print("InterBBS Messages:\r\n");
        print(repeatChar("=", 60) + "\r\n");
        
        // Show message list
        for (var i = 0; i < messages.length; i++) {
            var msg = messages[i];
            var status = msg.read ? "READ" : "UNREAD";
            print(format("%2d. [%s] From: %s @ %s\r\n", 
                i + 1, status, msg.from_user, msg.from_bbs));
            print(format("    Subject: %s\r\n", msg.subject));
            print(format("    Date: %s\r\n", msg.created));
            if (msg.body.length > 50) {
                print(format("    Preview: %s...\r\n", msg.body.substr(0, 50)));
            } else {
                print(format("    Preview: %s\r\n", msg.body));
            }
            print("\r\n");
        }
        
        print("Commands:\r\n");
        print("  1-" + messages.length + "  - View message details\r\n");
        print("  R#        - Mark message # as read (e.g., R1)\r\n");
        print("  D#        - Delete message # (e.g., D1)\r\n");
        print("  RA        - Mark all as read\r\n");
        print("  DA        - Delete all messages\r\n");
        print("  Q         - Quit to main menu\r\n");
        print("\r\nChoice: ");
        
        var choice = console.getstr().toUpperCase();
        
        if (choice === "Q" || choice === "") {
            break;
        } else if (choice === "RA") {
            // Mark all as read
            for (var i = 0; i < messages.length; i++) {
                messages[i].read = true;
            }
            writeMessages(messages);
            print("\r\nAll messages marked as read.\r\n");
        } else if (choice === "DA") {
            // Delete all
            print("\r\nAre you sure you want to delete ALL messages? (Y/N): ");
            var confirm = console.getstr().toUpperCase();
            if (confirm === "Y") {
                writeMessages([]);
                messages = [];
                print("All messages deleted.\r\n");
            } else {
                print("Cancelled.\r\n");
            }
        } else if (choice.charAt(0) === "R" && choice.length > 1) {
            // Mark specific message as read
            var msgNum = parseInt(choice.substr(1)) - 1;
            if (msgNum >= 0 && msgNum < messages.length) {
                messages[msgNum].read = true;
                writeMessages(messages);
                print("\r\nMessage " + (msgNum + 1) + " marked as read.\r\n");
            } else {
                print("\r\nInvalid message number.\r\n");
            }
        } else if (choice.charAt(0) === "D" && choice.length > 1) {
            // Delete specific message
            var msgNum = parseInt(choice.substr(1)) - 1;
            if (msgNum >= 0 && msgNum < messages.length) {
                print("\r\nDelete message from " + messages[msgNum].from_user + "? (Y/N): ");
                var confirm = console.getstr().toUpperCase();
                if (confirm === "Y") {
                    messages.splice(msgNum, 1);
                    writeMessages(messages);
                    print("Message deleted.\r\n");
                } else {
                    print("Cancelled.\r\n");
                }
            } else {
                print("\r\nInvalid message number.\r\n");
            }
        } else {
            // View specific message
            var msgNum = parseInt(choice) - 1;
            if (msgNum >= 0 && msgNum < messages.length) {
                var msg = messages[msgNum];
                
                print("\r\n" + repeatChar("=", 60) + "\r\n");
                print("Message " + (msgNum + 1) + ":\r\n");
                print(repeatChar("-", 60) + "\r\n");
                print("From: " + msg.from_user + " @ " + msg.from_bbs + "\r\n");
                print("To: " + msg.to_user + "\r\n");
                print("Subject: " + msg.subject + "\r\n");
                print("Date: " + msg.created + "\r\n");
                print("Status: " + (msg.read ? "READ" : "UNREAD") + "\r\n");
                print(repeatChar("-", 60) + "\r\n");
                print(msg.body + "\r\n");
                print(repeatChar("=", 60) + "\r\n");
                
                // Auto-mark as read when viewing
                if (!msg.read) {
                    messages[msgNum].read = true;
                    writeMessages(messages);
                    print("(Message automatically marked as read)\r\n");
                }
                
                print("\r\nPress any key to continue...");
                console.getkey();
            } else {
                print("\r\nInvalid choice.\r\n");
            }
        }
        
        if (messages.length === 0) {
            print("\r\nNo more messages. Returning to main menu.\r\n");
            break;
        }
        
        print("\r\nPress any key to continue...");
        console.getkey();
    }
}

// Show InterBBS nodes
function showInterBBSNodes() {
    var nodes = loadInterBBSNodes();
    var players = loadInterBBSPlayers();
    
    print("Known InterBBS Nodes:\r\n");
    print(repeatChar("=", 70) + "\r\n");
    
    var hasNodes = false;
    for (var address in nodes) {
        hasNodes = true;
        var node = nodes[address];
        print(format("%-25s  %s\r\n", node.name, address));
        print(format("  SysOp: %-20s  Location: %s\r\n", node.sysop, node.location));
        print(format("  Last Seen: %s\r\n", node.last_seen || "Never"));
        print("\r\n");
    }
    
    if (!hasNodes) {
        print("No nodes in database\r\n");
    }
    
    print("\r\nKnown Players by Node:\r\n");
    print(repeatChar("=", 50) + "\r\n");
    
    var hasPlayers = false;
    for (var nodeAddress in players) {
        if (players[nodeAddress] && players[nodeAddress].length > 0) {
            hasPlayers = true;
            print("Node " + nodeAddress + ":\r\n");
            for (var i = 0; i < players[nodeAddress].length; i++) {
                var player = players[nodeAddress][i];
                print(format("  %-20s (Last seen: %s)\r\n", player.username, player.lastSeen || "Unknown"));
            }
            print("\r\n");
        }
    }
    
    if (!hasPlayers) {
        print("No players in database\r\n");
    }
}

// Show configuration
function showConfig() {
    print("Current Configuration:\r\n");
    print(repeatChar("=", 50) + "\r\n");
    print("Config file: " + CONFIG_FILE + "\r\n");
    print("\r\n[BBS]\r\n");
    print("Name: " + getLocalBBS("name") + "\r\n");
    print("Address: " + getLocalBBS("address") + "\r\n");
    print("Operator: " + getLocalBBS("operator") + "\r\n");
    print("\r\n[Directories]\r\n");
    print("Inbound: " + INTERBBS_IN_DIR + "\r\n");
    print("Outbound: " + INTERBBS_OUT_DIR + "\r\n");
    print("Data: " + ACHESS_DATA_DIR + "\r\n");
    print("\r\n[Files Used by AChess]\r\n");
    print("InterBBS Games: " + INTERBBS_GAMES_FILE + "\r\n");
    print("Messages: " + MESSAGES_FILE + "\r\n");
    print("Notifications: " + ACHESS_NOTIFY_FILE + "\r\n");
    print("Scores: " + ACHESS_SCORES_FILE + "\r\n");
    print("\r\n[Mailer]\r\n");
    print("Type: " + CONFIG.mailer.type + "\r\n");
    print("Poll packets: " + CONFIG.mailer.poll_packets + "\r\n");
    print("Auto process: " + CONFIG.mailer.auto_process + "\r\n");
    print("\r\n[Case-Insensitive Features]\r\n");
    print("Username matching: ENABLED\r\n");
    print("Case resolution logging: ENABLED\r\n");
}

// Create test packets for debugging
function createTestPackets() {
    print("Creating test packets with various case combinations...\r\n");
    
    // Test challenge packet with mixed case
    var challenge = {
        type: "challenge",
        game_id: "test_case_" + time(),
        from: {
            user: "TestUser",
            bbs: "Test BBS",
            address: "21:1/999"
        },
        to: {
            user: "ANETONLINE", // Different case to test matching
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address")
        },
        color: "white",
        message: "Test challenge with mixed case username",
        time_control: "15+10",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = INTERBBS_IN_DIR + "test_case_challenge_" + time() + ".json";
    if (saveJSONFile(filename, challenge)) {
        print("Created test challenge with mixed case: " + filename + "\r\n");
    }
    
    // Test message packet with different case
    var message = {
        type: "message",
        from: {
            user: "testuser", // lowercase
            bbs: "Test BBS",
            address: "21:1/999"
        },
        to: {
            user: "anetonline", // lowercase to test
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address")
        },
        subject: "Case Test Message",
        body: "This message tests case-insensitive username matching.",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    filename = INTERBBS_IN_DIR + "test_case_message_" + time() + ".json";
    if (saveJSONFile(filename, message)) {
        print("Created test message with mixed case: " + filename + "\r\n");
    }
    
    // Test move packet
    var move = {
        type: "move",
        game_id: "test_game_123",
        move: "e2e4",
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        move_history: ["e2e4"],
        from: {
            user: "RemotePlayer",
            bbs: "Remote BBS",
            address: "21:1/888"
        },
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    filename = INTERBBS_IN_DIR + "test_move_" + time() + ".json";
    if (saveJSONFile(filename, move)) {
        print("Created test move packet: " + filename + "\r\n");
    }
    
    print("Test packets with case variations created\r\n");
    print("Process with 'achess_ibbs.js inbound' to test case-insensitive matching\r\n");
}

// Interactive menu system
function runInteractiveMenu() {
    while (true) {
        print("\r\n" + repeatChar("=", 60) + "\r\n");
        print("AChess InterBBS Utility - Interactive Menu\r\n");
        print(repeatChar("=", 60) + "\r\n");
        print("1. Process inbound packets               2. Send outbound packets\r\n");
        print("3. View scores                           4. View nodes and players\r\n");
        print("5. View InterBBS games                   6. View InterBBS messages\r\n");
        print("7. Show configuration                    8. Create test packets\r\n");
        print("9. Send test challenge                   C. Cleanup duplicate nodes\r\n");
        print("V. Validate nodelist                     R. Nodelist status\r\n");
        print("T. Debug packet                          P. Request player lists\r\n");
        
        // Only show LC-only options to the League Coordinator
        if (isLeagueCoordinator()) {
            print("D. Distribute clean nodelist            M. Manage master node list\r\n");
        }
        
        print("0. Exit\r\n");
        print(repeatChar("-", 60) + "\r\n");
        print("Choice: ");
        
        var choice = console.getstr().toUpperCase();
        print("\r\n");
        
        switch (choice) {
            case "1":
                processInterBBSInboundPackets();
                break;
            case "2":
                sendInterBBSPackets();
                break;
            case "3":
                showScores();
                break;
            case "4":
                showInterBBSNodes();
                break;
            case "5":
                showInterBBSGames();
                break;
            case "6":
                showInterBBSMessages();
                break;
            case "7":
                showConfig();
                break;
            case "8":
                createTestPackets();
                break;
            case "9":
                print("Send Test Challenge:\r\n");
                print("Target BBS: ");
                var targetBBS = console.getstr();
                print("Target User: ");
                var targetUser = console.getstr();
                print("Your Color (white/black): ");
                var color = console.getstr();
                print("Message: ");
                var message = console.getstr();
                print("Time Control: ");
                var timeControl = console.getstr();
                
                if (targetBBS && targetUser) {
                    sendInterBBSChallenge(targetBBS, targetUser, color, message, timeControl);
                } else {
                    print("Invalid input\r\n");
                }
                break;
            case "C":
                cleanupDuplicateNodes();
                break;
            case "V":
                var nodes = loadInterBBSNodes();
                var duplicates = findDuplicateNodes(nodes);
                if (duplicates.length === 0) {
                    print("No issues found in node registry.\r\n");
                } else {
                    print("Found " + duplicates.length + " potential issues.\r\n");
                    print("Use option 'C' to clean them up.\r\n");
                }
                break;
            case "R":
                print("=== NODE REGISTRY STATUS ===\r\n");
                var nodes = loadInterBBSNodes();
                var duplicates = findDuplicateNodes(nodes);
                
                print("Total nodes: " + Object.keys(nodes).length + "\r\n");
                print("Duplicate issues: " + duplicates.length + "\r\n");
                print("\r\n");
                
                if (duplicates.length > 0) {
                    print("Issues found:\r\n");
                    for (var i = 0; i < duplicates.length; i++) {
                        print("  " + duplicates[i].type + ": " + duplicates[i].addresses.join(", ") + "\r\n");
                    }
                    print("\r\nUse option 'C' to resolve.\r\n");
                } else {
                    print("Registry is clean!\r\n");
                }
                break;
            case "D":
                if (isLeagueCoordinator()) {
                    distributeCleanNodeList();
                } else {
                    print("This option is only available to the League Coordinator.\r\n");
                }
                break;
            case "T":
                print("Debug Packet\r\n");
                print("Enter packet filename: ");
                var debugFile = console.getstr();
                if (debugFile && file_exists(debugFile)) {
                    debugMessagePacket(debugFile);
                } else {
                    print("File not found or invalid\r\n");
                }
                break;
            case "P":
                requestPlayerListFromAllNodes();
                break;
            case "M":
                if (isLeagueCoordinator()) {
                    print("=== MASTER NODE LIST MANAGEMENT ===\r\n");
                    print("1. Create/Update master node list from current nodes\r\n");
                    print("2. Add new node to master list\r\n");
                    print("3. Edit existing node in master list\r\n");
                    print("4. Remove node from master list\r\n");
                    print("5. Validate all nodes against master list\r\n");
                    print("6. Distribute master node list to all nodes\r\n");
                    print("7. Back to main menu\r\n");
                    print("Choice: ");
                    
                    var lcChoice = console.getstr();
                    
                    switch (lcChoice) {
                        case "1":
                            createMasterNodeList();
                            break;
                        case "2":
                            addNodeToMasterList();
                            break;
                        case "3":
                            editNodeInMasterList();
                            break;
                        case "4":
                            removeNodeFromMasterList();
                            break;
                        case "5":
                            cleanupDuplicateNodes();
                            break;
                        case "6":
                            distributeCleanNodeList();
                            break;
                        default:
                            print("Returning to main menu.\r\n");
                            break;
                    }
                } else {
                    print("This option is only available to the League Coordinator.\r\n");
                }
                break;
            case "0":
                print("Goodbye!\r\n");
                return;
            default:
                print("Invalid choice\r\n");
                break;
        }
        
        print("\r\nPress any key to continue...");
        console.getkey();
    }
}

// ---- Main command routing ----
var hasArgs = false;
if (typeof argc !== "undefined" && argc >= 1) hasArgs = true;
if (typeof argv !== "undefined" && argv && argv.length >= 1) hasArgs = true;

if (!hasArgs) {
    print("Usage: achess_ibbs.js [command]\r\n");
    print("\r\nCommands:\r\n");
    print("  config    - Display current configuration\r\n");
    print("  outbound  - Send score packets to all nodes\r\n");
    print("  inbound   - Process inbound packets\r\n");
    print("  process   - Same as inbound\r\n");
    print("  scores    - Display current scores\r\n");
    print("  games     - Display InterBBS games\r\n");
    print("  messages  - Display InterBBS messages\r\n");
    print("  nodes     - Display node table and player database\r\n");
    print("  test      - Create test packets (now with case variations)\r\n");
    print("  menu      - Run interactive menu\r\n");
    print("  all       - Run outbound, inbound, show scores and nodes\r\n");
    print("\r\nNEW: Case-insensitive username matching enabled!\r\n");
    print("Usernames like 'StingRay', 'stingray', 'STINGRAY' will all match correctly.\r\n");
    exit();
}

// Parse command from argv[0]
var cmd = "help";
if (typeof argv !== "undefined" && argv && argv.length > 0) {
    cmd = String(argv[0]).toLowerCase();
}

if (cmd === "help" || cmd === "") {
    print("Usage: achess_ibbs.js [command]\r\n");
    print("\r\nCommands:\r\n");
    print("  config    - Display current configuration\r\n");
    print("  outbound  - Send score packets to all nodes\r\n");
    print("  inbound   - Process inbound packets\r\n");
    print("  process   - Same as inbound\r\n");
    print("  scores    - Display current scores\r\n");
    print("  games     - Display InterBBS games\r\n");
    print("  messages  - Display InterBBS messages\r\n");
    print("  nodes     - Display node table and player database\r\n");
    print("  test      - Create test packets (now with case variations)\r\n");
    print("  menu      - Run interactive menu\r\n");
    print("  all       - Run outbound, inbound, show scores and nodes\r\n");
    print("\r\nNEW: Case-insensitive username matching enabled!\r\n");
    print("Usernames like 'StingRay', 'stingray', 'STINGRAY' will all match correctly.\r\n");
    exit();
}

var startTime = time();
print("AChess InterBBS Utility with Case-Insensitive Matching - Command: " + cmd.toUpperCase() + "\r\n");
print("Started: " + strftime("%Y-%m-%d %H:%M:%S", startTime) + "\r\n");
print("Config: " + getLocalBBS("name") + " (" + getLocalBBS("address") + ")\r\n");
print("Inbound: " + INTERBBS_IN_DIR + "\r\n");
print("Outbound: " + INTERBBS_OUT_DIR + "\r\n");
print(repeatChar("=", 50) + "\r\n");

switch (cmd) {
    case "config":
        showConfig();
        break;
    case "outbound":
        sendInterBBSPackets();
        break;
    case "inbound":
    case "process":
        processInterBBSInboundPackets();
        break;
    case "scores":
        showScores();
        break;
    case "games":
        showInterBBSGames();
        break;
    case "messages":
        showInterBBSMessages();
        break;
    case "nodes":
        showInterBBSNodes();
        break;
    case "test":
        createTestPackets();
        break;
    case "menu":
        runInteractiveMenu();
        break;
    case "all":
        print("=== SENDING OUTBOUND PACKETS ===\r\n");
        sendInterBBSPackets();
        print("\r\n=== PROCESSING INBOUND PACKETS ===\r\n");
        processInterBBSInboundPackets();
        print("\r\n=== CURRENT SCORES ===\r\n");
        showScores();
        print("\r\n=== INTERBBS GAMES ===\r\n");
        showInterBBSGames();
        print("\r\n=== INTERBBS MESSAGES ===\r\n");
        showInterBBSMessages();
        print("\r\n=== NODES AND PLAYERS ===\r\n");
        showInterBBSNodes();
        print("\r\n'All' parameter completed successfully.\r\n");
        break;
    default:
        print("Unknown command: " + cmd + "\r\n");
        print("Usage: achess_ibbs.js [command]\r\n");
        break;
}

var endTime = time();
print(repeatChar("=", 50) + "\r\n");
print("Completed: " + strftime("%Y-%m-%d %H:%M:%S", endTime) + "\r\n");
print("Duration: " + (endTime - startTime) + " seconds\r\n");
logEvent("Command '" + cmd + "' completed in " + (endTime - startTime) + " seconds");
