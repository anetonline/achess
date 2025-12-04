// AChess InterBBS Utility

load("sbbsdefs.js");

// Configuration file location
var CONFIG_FILE = "/sbbs/xtrn/achess/bbs.cfg";
var ACHESS_DATA_DIR = "/sbbs/xtrn/achess/";

// Default fallback configuration
var DEFAULT_CONFIG = {
    bbs: {
        name: "A-Net Online",
        address: "1:201/10",
        bbs: "A-Net Online BBS",
        operator: "StingRay"
    },
    directories: {
        inbound: "/sbbs/filebase/inbound/",
        outbound: "/sbbs/filebase/outbound/"
    },
    mailer: {
        type: "binkd",
        poll_packets: true,
        auto_process: true
    }
};

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
    var localUsers = getLocalUsers();
    return findUserIgnoreCase(targetUser, localUsers) || targetUser;
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

// Updated getLocalBBS function to use config
function getLocalBBS(field) {
    switch (field) {
        case "name": 
            return CONFIG.bbs.name || CONFIG.bbs.bbs || system.name || "Unknown BBS";
        case "address": 
            return CONFIG.bbs.address || (system.fido_addr_list ? system.fido_addr_list[0] : "1:1/1");
        case "sysop": 
        case "operator":
            return CONFIG.bbs.operator || system.operator || "SysOp";
        case "location": 
            return CONFIG.bbs.location || system.location || "Unknown";
        default: 
            return CONFIG.bbs[field] || "";
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

function processInboundForfeit(packet) {
    if (!packet.game_id || !packet.from) {
        logEvent("Invalid forfeit packet - missing required fields");
        return false;
    }

    var games = loadInterBBSGames();
    for (var i = 0; i < games.length; i++) {
        if (games[i].game_id === packet.game_id) {
            var g = games[i];

            // Determine forfeiter and opponent
            var forfeiter = packet.from.user || packet.from_user || "Unknown";
            var whiteUser = (g.players && g.players.white) ? g.players.white.user : null;
            var blackUser = (g.players && g.players.black) ? g.players.black.user : null;
            var opponent = (whiteUser && whiteUser.toLowerCase() !== forfeiter.toLowerCase()) ? whiteUser : blackUser;
            if (!opponent) opponent = (forfeiter === whiteUser ? blackUser : whiteUser) || "Unknown";

            // Update game record to finished
            g.status = "finished";
            g.finished = true;
            g.result = opponent + " won by forfeit";
            g.last_update = packet.created || strftime("%Y-%m-%dT%H:%M:%SZ", time());

            saveInterBBSGames(games);

            // Update scores file if available
            try {
                // achess_ibbs.js uses loadScores/saveScores. These maintain summary/array differences.
                var scores = loadScores() || {};
                var bbsKey = getLocalBBS("name") + " (" + getLocalBBS("address") + ")";
                if (!scores[bbsKey]) scores[bbsKey] = {};
                if (!scores[bbsKey][opponent]) scores[bbsKey][opponent] = {wins:0, losses:0, draws:0, rating:1200};
                if (!scores[bbsKey][forfeiter]) scores[bbsKey][forfeiter] = {wins:0, losses:0, draws:0, rating:1200};
                scores[bbsKey][opponent].wins++;
                scores[bbsKey][forfeiter].losses++;
                saveScores(scores);
            } catch (e) {
                logEvent("Failed updating scores for forfeit: " + e.message);
            }

            // Send local Achess notification to opponent
            var subj = "Opponent forfeited: " + g.game_id;
            var body = forfeiter + " has forfeited InterBBS game " + g.game_id + ".\r\n\r\nResult: " + opponent + " wins by forfeit.";
            sendAchessNotification(opponent, subj, body);

            logEvent("Processed forfeit for game " + packet.game_id + " forfeiter: " + forfeiter + " opponent: " + opponent);
            return true;
        }
    }

    logEvent("Forfeit for unknown game: " + packet.game_id);
    return false;
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
    var f = new File(NODE_FILE);
    
    if (!f.open("w")) {
        logEvent("Could not write to chess_nodes.ini");
        return false;
    }
    
    f.writeln("# InterBBS Chess Nodes Configuration");
    f.writeln("# Generated: " + strftime("%Y-%m-%d %H:%M:%S", time()));
    f.writeln("");
    
    var nodeCount = 0;
    for (var address in nodes) {
        var node = nodes[address];
        f.writeln("[Node" + (++nodeCount) + "]");
        f.writeln("name=" + (node.name || "Unknown BBS"));
        f.writeln("address=" + address);
        if (node.sysop) f.writeln("sysop=" + node.sysop);
        if (node.location) f.writeln("location=" + node.location);
        if (node.last_seen) f.writeln("last_seen=" + node.last_seen);
        f.writeln("");
    }
    
    f.close();
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
    
    // If it's already summary format, return as-is
    return scores;
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
    var patterns = ["chess_", "achess_", "packet_", "challenge_", "move_", "message_", "mail_"];
    
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

// Process individual inbound packet
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
        default:
            logEvent("Unknown packet type: " + packet.type);
            return false;
    }
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

// Process inbound message - UPDATED: Fixed field validation and case-insensitive matching
function processInboundMessage(packet) {
    // Check for required fields - handle both old and new packet formats
    var hasFromInfo = packet.from || (packet.from_user && packet.bbs);
    var hasMessageBody = packet.message || packet.body;
    
    if (!hasFromInfo || !hasMessageBody) {
        logEvent("Invalid message packet - missing required fields (from info or message body)");
        return false;
    }
    
    var messages = readMessages();
    
    // Extract from information - handle both formats
    var fromUser, fromBBS, fromAddr;
    if (packet.from && typeof packet.from === 'object') {
        fromUser = packet.from.user || packet.from_user;
        fromBBS = packet.from.bbs || packet.bbs;
        fromAddr = packet.from.address || packet.address;
    } else {
        fromUser = packet.from_user;
        fromBBS = packet.bbs;
        fromAddr = packet.address;
    }
    
    // Determine target user with case-insensitive matching
    var targetUser = "ALL";
    if (packet.to_user) {
        var resolvedUser = findLocalUser(packet.to_user);
        if (resolvedUser) {
            targetUser = resolvedUser;
            logEvent("Message targeted to: " + packet.to_user + " (resolved to: " + targetUser + ")");
        }
    } else if (packet.to && packet.to.user) {
        var resolvedUser = findLocalUser(packet.to.user);
        if (resolvedUser) {
            targetUser = resolvedUser;
            logEvent("Message targeted to: " + packet.to.user + " (resolved to: " + targetUser + ")");
        }
    }
    
    var message = {
        from_user: fromUser,
        from_bbs: fromBBS,
        from_addr: fromAddr,
        to_user: targetUser,
        to_bbs: getLocalBBS("name"),
        to_addr: getLocalBBS("address"),
        subject: packet.subject || "InterBBS Message",
        body: packet.message || packet.body || "",
        created: packet.created || strftime("%Y-%m-%d %H:%M:%S", time()),
        read: false
    };
    
    messages.push(message);
    writeMessages(messages);
    
    // Send AChess notification about new message
    var subject = "New InterBBS Message!";
    var body = "You have received a new InterBBS message!\r\n\r\n" +
               "From: " + message.from_user + " @ " + message.from_bbs + "\r\n" +
               "Subject: " + message.subject + "\r\n\r\n" +
               "Go to the Chess menu and select 'Read InterBBS Messages' to view the message.";
    sendAchessNotification(targetUser, subject, body);
    
    // Update player info - handle both packet formats
    var playerInfo = {
        user: fromUser,
        bbs: fromBBS,
        address: fromAddr
    };
    updatePlayerInfo(playerInfo);
    
    logEvent("Received message from " + message.from_user + " @ " + message.from_bbs + " (target: " + targetUser + ")");
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
    
    updateNodeInfo(packet.from);
    updatePlayerInfo(packet.from);
    logEvent("Updated node info for " + packet.from.bbs);
    return true;
}

// Update node information
function updateNodeInfo(nodeInfo) {
    var nodes = loadInterBBSNodes();
    var key = nodeInfo.address || nodeInfo.bbs;
    
    nodes[key] = {
        name: nodeInfo.bbs,
        address: nodeInfo.address,
        sysop: nodeInfo.sysop || "",
        location: nodeInfo.location || "",
        last_seen: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    saveInterBBSNodes(nodes);
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

// Send outbound message
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
    
    var packet = {
        type: "message",
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
        subject: subject || "InterBBS Message",
        body: body || "",
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    var filename = "achess_message_" + targetNode.address.replace(/[^A-Za-z0-9]/g, "_") + "_" + time() + ".json";
    var filepath = INTERBBS_OUT_DIR + filename;
    
    if (saveJSONFile(filepath, packet)) {
        print("Message sent to " + targetUser + " @ " + targetBBS + "\r\n");
        logEvent("Sent message to " + targetUser + " @ " + targetBBS);
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
        print("1. Process inbound packets\r\n");
        print("2. Send outbound packets\r\n");
        print("3. View scores\r\n");
        print("4. View nodes and players\r\n");
        print("5. View InterBBS games\r\n");
        print("6. View InterBBS messages\r\n");
        print("7. Show configuration\r\n");
        print("8. Create test packets\r\n");
        print("9. Send test challenge\r\n");
        print("0. Exit\r\n");
        print(repeatChar("-", 60) + "\r\n");
        print("Choice: ");
        
        var choice = console.getstr();
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
