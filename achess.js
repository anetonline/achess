// Synchronet ANSI Chess Game: Full rules, ANSI board, Player-vs-Computer or Player-vs-Player or InterBBS Chess
// Requires: chess.js (Synchronet-compatible), cboard.ans (ANSI board)
//
// Features: Game saving/loading per user, high score tracking and view, plain ASCII and Synchronet color score files,
//           Player-vs-Computer or Player-vs-Player or InterBBS modes, summary high scores.
//           InterBBS messaging integrated (send/read messages, notification on menu).
//           InterBBS Chess: Challenge remote players, manage and play InterBBS games.
//
// Brought to you by; StingRay of A-Net Online BBS 

require("dd_lightbar_menu.js", "DDLightbarMenu");
load("frame.js");
load("scrollbar.js");
load(js.exec_dir + "chess.js"); // Load chess.js engine

var SAVE_DIR = js.exec_dir + "games/";
var COMPUTER_GAMES_FILE = js.exec_dir + "games/computer_games.json";
var SCORES_FILE = js.exec_dir + "scores.json";
var SCORES_ANS = js.exec_dir + "scores.ans";
var SCORES_ASC = js.exec_dir + "scores.asc";
var SCORES_SUMMARY = js.exec_dir + "scores_summary.json";

var MESSAGES_FILE = js.exec_dir + "messages.json";
var NODE_FILE = js.exec_dir + "chess_nodes.ini";
var INTERBBS_GAMES_FILE = js.exec_dir + "interbbs_games.json";

var files = "ABCDEFGH";
var ranks = "87654321";
var startX = 11, startY = 1, squareW = 5, squareH = 2, centerOffsetX = 2, centerOffsetY = 1;

var squareCoords = {};
for (var r = 0; r < 8; r++)
    for (var f = 0; f < 8; f++) {
        var square = files[f] + ranks[r];
        var x = startX + f * squareW + centerOffsetX;
        var y = startY + r * squareH + centerOffsetY;
        squareCoords[square] = { x: x, y: y };
    }

var SBBS_TO_ANSI = {
    n: "\x1b[0m",
    h: "\x1b[1m",
    b: "\x1b[34m",
    c: "\x1b[36m",
    g: "\x1b[32m",
    r: "\x1b[31m",
    w: "\x1b[37m",
    y: "\x1b[33m",
};

var ACHESS_NOTIFY_FILE = js.exec_dir + "achess_notify.json";

function repeatChar(char, count) {
    var s = "";
    for (var i = 0; i < count; i++) s += char;
    return s;
}

var BBS_CFG_FILE = js.exec_dir + "bbs.cfg";

function readBBSConfig() {
    var cfg = { 
        name: "", address: "", bbs: "", operator: "",
        inbound: js.exec_dir + "inbound/",   // defaults
        outbound: js.exec_dir + "outbound/", // defaults
        mailer_type: "binkd",                // default
        poll_packets: true,                  // default
        auto_process: true                   // default
    };
    
    if (!file_exists(BBS_CFG_FILE)) return cfg;
    var f = new File(BBS_CFG_FILE);
    if (!f.open("r")) return cfg;
    var lines = f.readAll();
    f.close();
    
    var currentSection = "";
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^\s+|\s+$/g, '');
        
        if (line === '') continue;
        
        if (line[0] === '#' || line[0] === ';') continue;
        
        var sectionMatch = line.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            continue;
        }
        
        var keyValueMatch = line.match(/^(\w+)\s*=\s*([^#]+)(?:#.*)?$/);
        if (keyValueMatch) {
            var key = keyValueMatch[1].trim();
            var value = keyValueMatch[2].trim();
            
            if (currentSection === "bbs") {
                cfg[key] = value;
            } else if (currentSection === "directories") {
                if (key === "inbound") cfg.inbound = value;
                if (key === "outbound") cfg.outbound = value;
            } else if (currentSection === "mailer") {
                if (key === "type") cfg.mailer_type = value;
                if (key === "poll_packets") cfg.poll_packets = (value.toLowerCase() === "true");
                if (key === "auto_process") cfg.auto_process = (value.toLowerCase() === "true");
            }
        }
    }
    return cfg;
}

var myBBS = readBBSConfig();

var INTERBBS_OUT_DIR = myBBS.outbound;
var INTERBBS_IN_DIR = myBBS.inbound;

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

function arrayFindIndex(arr, predicate) {
    if (!Array.isArray(arr)) return -1;
    for (var i = 0; i < arr.length; i++) {
        if (predicate(arr[i], i, arr)) return i;
    }
    return -1;
}

function ensureGamesDir() {
    var dir = js.exec_dir + "games";
    if (!file_exists(dir)) mkdir(dir);
}

// Enhanced function to properly request player lists from any node
function requestPlayerList(nodeAddress) {
    var nodes = readNodes();
    var targetNode = null;
    
    console.print("\r\nLooking for node with address: " + nodeAddress + "\r\n");
    
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].address === nodeAddress) {
            targetNode = nodes[i];
            console.print("Found node: " + nodes[i].name + "\r\n");
            break;
        }
    }
    
    if (!targetNode) {
        console.print("ERROR: Target node not found with address " + nodeAddress + "\r\n");
        return false;
    }
    
    // Generate unique request ID to prevent collisions
    var requestId = "req_" + Math.floor(Math.random() * 100000) + "_" + time();
    
    var requestPacket = {
        type: "player_list_request",
        request_id: requestId,
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            user: user.alias
        },
        to: {
            bbs: targetNode.name,
            address: targetNode.address
        },
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    console.print("Creating request packet for " + targetNode.name + "...\r\n");
    
    var fname = format("achess_playerlist_req_%s_%s.json", 
        requestId, // Use the unique ID in the filename
        time());
    var path = INTERBBS_OUT_DIR + fname;
    var f = new File(path);
    if (f.open("w+")) {
        f.write(JSON.stringify(requestPacket, null, 2));
        f.close();
        console.print("Request sent successfully. Packet: " + fname + "\r\n");
        return true;
    }
    
    console.print("ERROR: Could not create request file!\r\n");
    return false;
}

// Check if InterBBS is enabled by looking for required files
function isInterBBSEnabled() {
    var nodeFile = js.exec_dir + "chess_nodes.ini";
    var configFile = js.exec_dir + "bbs.cfg";
    
    // Need both files for InterBBS functionality
    return file_exists(nodeFile) && file_exists(configFile);
}

// Player Database Functions
function loadPlayersDB() {
    var dbFile = js.exec_dir + "players_db.json";
    if (!file_exists(dbFile)) return {};
    var f = new File(dbFile);
    if (!f.open("r")) return {};
    var db;
    try {
        db = JSON.parse(f.readAll().join(""));
    } catch(e) {
        db = {};
    }
    f.close();
    return db;
}

function savePlayersDB(db) {
    var dbFile = js.exec_dir + "players_db.json";
    var f = new File(dbFile);
    if (f.open("w+")) {
        f.write(JSON.stringify(db, null, 2));
        f.close();
    }
}

function addPlayerToDB(nodeAddress, username, lastSeen) {
    var db = loadPlayersDB();
    if (!db[nodeAddress]) db[nodeAddress] = [];
    
    // Check if player already exists
    var found = false;
    for (var i=0; i<db[nodeAddress].length; i++) {
        if (db[nodeAddress][i].username === username) {
            db[nodeAddress][i].lastSeen = lastSeen;
            found = true;
            break;
        }
    }
    
    if (!found) {
        db[nodeAddress].push({
            username: username,
            lastSeen: lastSeen,
            gamesPlayed: 0,
            wins: 0,
            losses: 0,
            draws: 0
        });
    }
    
    savePlayersDB(db);
}

function getPlayersForNode(nodeAddress) {
    var db = loadPlayersDB();
    return db[nodeAddress] || [];
}

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

function getMyUnreadAchessNotifications() {
    var arr = readAchessNotifications();
    return arr.filter(function(n) {
        return (
            !n.read &&
            typeof n.to === "string" &&
            n.to.toLowerCase() === user.alias.toLowerCase()
        );
    });
}

function markMyAchessNotificationsRead() {
    var arr = readAchessNotifications();
    var changed = false;
    for (var i=0; i<arr.length; i++) {
        if (
            !arr[i].read &&
            typeof arr[i].to === "string" &&
            arr[i].to.toLowerCase() === user.alias.toLowerCase()
        ) {
            arr[i].read = true;
            changed = true;
        }
    }
    if (changed) writeAchessNotifications(arr);
}

function showAchessNotifications() {
    var notes = getMyUnreadAchessNotifications();
    if (!notes.length) {
        console.print("\r\nNo new Achess notifications.\r\n");
        return;
    }
    console.print("\r\n\x01c\x01h*** You have " + notes.length + " new Achess notification" + (notes.length>1?"s":"") + "! ***\x01n\r\n");
    for (var i=0; i<notes.length; i++) {
        var n = notes[i];
        console.print("\x01g["+(i+1)+"]\x01n \x01h"+(n.subject||"No subject")+"\x01n   "+(n.time||"")+"\r\n");
        console.print((n.body||"") + "\r\n");
        console.print("\x01b---------------------------------------------\x01n\r\n");
    }
    markMyAchessNotificationsRead();
    console.print("\r\n\x01cPress any key to continue...\x01n\r\n");
    console.getkey();
}

function randomAIMove(chess) {
    var moves = chess.moves();
    if (moves.length === 0) return false;
    var move = moves[Math.floor(Math.random() * moves.length)];
    chess.move(move);
    return move;
}

function easyAIMove(chess) {
    var moves = chess.moves({ verbose: true });
    if (moves.length === 0) return false;
    
    var captures = moves.filter(function(m) { return m.flags.indexOf('c') !== -1; });
    if (captures.length > 0 && Math.random() < 0.7) {
        var move = captures[Math.floor(Math.random() * captures.length)];
        chess.move(move);
        return move.san;
    }
    
    var checks = moves.filter(function(m) { return m.san.indexOf('+') !== -1; });
    if (checks.length > 0 && Math.random() < 0.6) {
        var move = checks[Math.floor(Math.random() * checks.length)];
        chess.move(move);
        return move.san;
    }
    
    var move = moves[Math.floor(Math.random() * moves.length)];
    chess.move(move);
    return move.san;
}

function mediumAIMove(chess) {
    var moves = chess.moves({ verbose: true });
    if (moves.length === 0) return false;
    
    var pieceValues = {
        p: 1,  // pawn
        n: 3,  // knight
        b: 3,  // bishop
        r: 5,  // rook
        q: 9,  // queen
        k: 0   // king (not captured, but used for moves evaluation)
    };
    
    // Evaluate each move
    var bestMoves = [];
    var bestScore = -999;
    
    for (var i = 0; i < moves.length; i++) {
        var move = moves[i];
        var score = 0;
        
        // Temporarily make move to evaluate position
        chess.move(move);
        
        // Give points for putting opponent in check
        if (chess.in_check()) score += 0.5;
        
        // Consider material capture value
        if (move.flags.indexOf('c') !== -1) {
            score += pieceValues[move.captured];
        }
        
        // Check if our piece would be captured next move
        var opponentMoves = chess.moves({ verbose: true });
        var inDanger = false;
        for (var j = 0; j < opponentMoves.length; j++) {
            if (opponentMoves[j].to === move.to) {
                score -= pieceValues[move.piece] * 0.8; // Discount slightly
                inDanger = true;
                break;
            }
        }
        
        // Undo the move
        chess.undo();
        
        // Keep track of best moves
        if (score > bestScore) {
            bestMoves = [move];
            bestScore = score;
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }
    
    // Pick one of the best moves at random
    var selectedMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    chess.move(selectedMove);
    return selectedMove.san;
}

function getMoveHistoryDisplay(chess, savedMoves) {
    // Always ensure savedMoves is defined
    savedMoves = savedMoves || [];
    
    var moves = [];
    
    // Priority order: chess.history() first, then savedMoves fallback
    if (chess && chess.history) {
        try {
            var historyMoves = chess.history({ verbose: true });
            if (historyMoves && historyMoves.length > 0) {
                moves = historyMoves;
            } else {
                // Try simple history
                historyMoves = chess.history();
                if (historyMoves && historyMoves.length > 0) {
                    moves = historyMoves;
                }
            }
        } catch(e) {
            // Fall through to savedMoves
        }
    }
    
    // If chess.history() didn't work or was empty, use savedMoves
    if ((!moves || moves.length === 0) && savedMoves && savedMoves.length > 0) {
        moves = savedMoves;
    }
    
    if (!moves || moves.length === 0) {
        return [];
    }
    
    // Limit to last 8 moves (4 move pairs)
    var maxMoves = 8;
    var startIndex = Math.max(0, moves.length - maxMoves);
    var recentMoves = moves.slice(startIndex);
    
    // Format moves in pairs (1. e4 e5, 2. Nf3 Nc6, etc.)
    var formattedLines = [];
    var moveNumber = Math.floor(startIndex / 2) + 1;
    
    for (var i = 0; i < recentMoves.length; i += 2) {
        var whiteMove = recentMoves[i];
        var blackMove = (i + 1 < recentMoves.length) ? recentMoves[i + 1] : null;
        
        // Format moves with capture indicator
        var whitePly = formatMoveWithCapture(whiteMove);
        var blackPly = blackMove ? formatMoveWithCapture(blackMove) : "";
        
        var line = moveNumber + ". " + whitePly;
        if (blackPly) {
            line += " " + blackPly;
        }
        
        // Truncate long lines to fit sidebar (accounting for ANSI codes)
        var cleanLine = line.replace(/\x01./g, ""); // Remove ANSI codes for length check
        if (cleanLine.length > 16) {
            var truncated = truncateWithAnsi(line, 13);
            line = truncated + "...";
        }
        
        formattedLines.push(line);
        moveNumber++;
    }
    
    return formattedLines;
}

function truncateWithAnsi(str, maxLength) {
    var result = "";
    var visibleLength = 0;
    var i = 0;
    
    while (i < str.length && visibleLength < maxLength) {
        if (str[i] === '\x01' && i + 1 < str.length) {

            result += str[i] + str[i + 1];
            i += 2;
        } else {

            result += str[i];
            visibleLength++;
            i++;
        }
    }
    
    return result;
}

function formatMoveWithCapture(moveObj) {
    if (!moveObj || typeof moveObj === 'string') {
        return moveObj || "";
    }
    
    var moveText = moveObj.san || moveObj.move || "";
    
    // Check for captures using proper Synchronet color codes
    if (moveObj.flags) {
        if (moveObj.flags.indexOf('e') !== -1) {
            // En passant capture
            return moveText + "\x01y\x01hX\x01n"; // Bright yellow X
        } else if (moveObj.flags.indexOf('c') !== -1) {
            // Regular capture
            return moveText + "\x01r\x01hX\x01n"; // Bright red X
        }
    }
    
    // Alternative check for captures (fallback)
    if (moveObj.captured) {
        return moveText + "\x01r\x01hX\x01n";
    }
    
    return moveText;
}

function truncateWithAnsi(str, maxLength) {
    var result = "";
    var visibleLength = 0;
    var i = 0;
    
    while (i < str.length && visibleLength < maxLength) {
        if (str[i] === '\x01' && i + 1 < str.length) {

            result += str[i] + str[i + 1];
            i += 2;
        } else {

            result += str[i];
            visibleLength++;
            i++;
        }
    }
    
    return result;
}

// Hard AI - Uses minimax with depth 2
function hardAIMove(chess) {
    // Piece values for evaluation
    var pieceValues = {
        p: 1,    // pawn
        n: 3,    // knight
        b: 3.25, // bishop (slightly better than knight)
        r: 5,    // rook
        q: 9,    // queen
        k: 0     // king (not captured)
    };
    
    // Evaluate board position - positive is good for white, negative for black
    function evaluateBoard(chess) {
        var score = 0;
        
        // Material counting
        for (var i = 0; i < 8; i++) {
            for (var j = 0; j < 8; j++) {
                var square = files[j] + ranks[i];
                var piece = chess.get(square);
                if (piece) {
                    var value = pieceValues[piece.type] * (piece.color === 'w' ? 1 : -1);
                    score += value;
                }
            }
        }
        
        // Check bonus
        if (chess.in_check()) {
            score += (chess.turn() === 'w' ? -0.5 : 0.5);
        }
        
        // Return final score - invert for black's perspective
        return chess.turn() === 'w' ? score : -score;
    }
    
    // Minimax function with alpha-beta pruning
    function minimax(chess, depth, alpha, beta, isMaximizing) {
        if (depth === 0 || chess.game_over()) {
            return evaluateBoard(chess);
        }
        
        if (isMaximizing) {
            var bestScore = -Infinity;
            var moves = chess.moves();
            for (var i = 0; i < moves.length; i++) {
                chess.move(moves[i]);
                var score = minimax(chess, depth - 1, alpha, beta, false);
                chess.undo();
                bestScore = Math.max(score, bestScore);
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break;
            }
            return bestScore;
        } else {
            var bestScore = Infinity;
            var moves = chess.moves();
            for (var i = 0; i < moves.length; i++) {
                chess.move(moves[i]);
                var score = minimax(chess, depth - 1, alpha, beta, true);
                chess.undo();
                bestScore = Math.min(score, bestScore);
                beta = Math.min(beta, bestScore);
                if (beta <= alpha) break;
            }
            return bestScore;
        }
    }
    
    var moves = chess.moves();
    if (moves.length === 0) return false;
    
    var bestMove = null;
    var bestScore = -Infinity;
    var isMaximizing = chess.turn() === 'w'; // White maximizes, black minimizes
    
    for (var i = 0; i < moves.length; i++) {
        chess.move(moves[i]);
        var score = minimax(chess, 2, -Infinity, Infinity, !isMaximizing);
        chess.undo();
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = moves[i];
        }
    }
    
    chess.move(bestMove);
    return bestMove;
}

// Main AI function that selects the appropriate difficulty
function computerMove(chess, difficulty) {
    switch(difficulty) {
        case "hard":
            return hardAIMove(chess);
        case "medium":
            return mediumAIMove(chess);
        case "easy":
        default:
            return easyAIMove(chess);
    }
}

function promptMove(chess, playerColor, playerNames, savedMoves) {
    var files = "ABCDEFGH";
    var ranks = "12345678";
    var promptY = 23; 
    var promptText = "Enter move (e.g. E2E4, Nf3, Q=quit, S=save): ";

    while (bbs.online && !js.terminated) {
        var turnText = (playerColor === "w" ? "White" : "Black") + " to move.";
        var checkText = "";
        if (chess.in_check()) {
            checkText = (chess.turn() === "w" ? "White" : "Black") + " is in check!";
        }
        
        // Make sure to pass savedMoves here
        drawChessBoard(chess, turnText, checkText, playerNames, savedMoves || []);

        if (chess.in_checkmate()) {
            console.gotoxy(1, promptY);
            console.print("Checkmate! " + (chess.turn() === "w" ? "Black" : "White") + " wins! [Press any key]");
            console.getkey();
            return false;
        }
        if (chess.in_stalemate() || chess.in_draw()) {
            console.gotoxy(1, promptY);
            console.print("Draw! [Press any key]");
            console.getkey();
            return false;
        }

        console.gotoxy(1, promptY);
        console.cleartoeol();
        console.print("\x01w\x01h" + promptText + "\x01n");
        var moveInput = console.getstr(10);

        if (!moveInput) continue;
        moveInput = moveInput.toUpperCase();

        if (moveInput === "Q") return "QUIT";
        if (moveInput === "S") return "SAVE";

        var moveObj = null;
        if (
            moveInput.length === 4 &&
            files.indexOf(moveInput[0]) >= 0 &&
            ranks.indexOf(moveInput[1]) >= 0 &&
            files.indexOf(moveInput[2]) >= 0 &&
            ranks.indexOf(moveInput[3]) >= 0
        ) {
            moveObj = chess.move({
                from: moveInput.substr(0,2).toLowerCase(),
                to: moveInput.substr(2,2).toLowerCase(),
                promotion: "q"
            });
        } else {
            moveObj = chess.move(moveInput);
        }
        if (moveObj) {
            return moveInput; // Return move string
        } else {
            console.gotoxy(1, promptY + 1);
            console.cleartoeol();
            console.print("Illegal move. Try again. [Press any key]");
            console.getkey();
        }
    }
    return false;
}

function ensureComputerGamesFileIsArray() {
    ensureGamesDir();
    if (!file_exists(COMPUTER_GAMES_FILE)) {
        var file = new File(COMPUTER_GAMES_FILE);
        if (file.open("w+")) {
            file.write("[]");
            file.close();
        }
        return;
    }
    var file = new File(COMPUTER_GAMES_FILE);
    if (!file.open("r+")) return;
    var data;
    try { data = JSON.parse(file.readAll().join("")); } catch (e) { data = []; }
    if (!Array.isArray(data)) {
        file.rewind();
        file.truncate();
        file.write(JSON.stringify([], null, 2));
    }
    file.close();
}

function getAllComputerGames() {
    ensureComputerGamesFileIsArray();
    var file = new File(COMPUTER_GAMES_FILE);
    if (!file.open("r")) return [];
    var games;
    try {
        var raw = file.readAll().join("");
        games = JSON.parse(raw);
        if (!Array.isArray(games)) games = [];
    } catch (e) {
        games = [];
    } finally { file.close(); }
    return games;
}

function saveAllComputerGames(games) {
    ensureGamesDir();
    if (!Array.isArray(games)) games = [];
    var file = new File(COMPUTER_GAMES_FILE);
    if (file.open("w")) {
        file.write(JSON.stringify(games, null, 2));
        file.close();
    }
}

function saveComputerGame(game) {
    var games = getAllComputerGames();
    if (!Array.isArray(games)) games = [];
    
    // Generate a unique ID if not present
    if (!game.id) {
        game.id = "comp_" + user.alias + "_" + (new Date().getTime());
    }
    
    var idx = arrayFindIndex(games, function(g) { return g.id === game.id; });
    var saveGame = {
        id: game.id,
        mode: game.mode,
        fen: game.fen,
        turn: game.turn,
        moves: game.moves,
        white: game.white,
        black: game.black,
        playerColor: game.playerColor,
        difficulty: game.difficulty || "easy",
        timestamp: new Date().getTime(),
        userNumber: user.number
    };
    
    if (idx >= 0) games[idx] = saveGame;
    else games.push(saveGame);
    saveAllComputerGames(games);
}

function getUserComputerGames(usernum) {
    var games = getAllComputerGames();
    if (!Array.isArray(games)) games = [];
    return games.filter(function(g) {
        return g.userNumber === usernum;
    });
}

function getComputerGameById(id) {
    var games = getAllComputerGames();
    if (!Array.isArray(games)) games = [];
    for (var i = 0; i < games.length; i++) {
        var g = games[i];
        if (typeof g.id === "string" && typeof id === "string" && g.id.trim() === id.trim()) {
            return g;
        }
    }
    return undefined;
}

function deleteComputerGame(id) {
    var games = getAllComputerGames();
    if (!Array.isArray(games)) games = [];
    games = games.filter(function(g) { return g.id !== id; });
    saveAllComputerGames(games);
}

function playVsComputer(loadFromSave, saveObj) {
    var chess, playerColor = "w", difficulty = "easy", gameId = null;
    var savedMoves = [];
    
    if (loadFromSave && saveObj) {
        playerColor = saveObj.playerColor || "w";
        difficulty = saveObj.difficulty || "easy";
        gameId = saveObj.id || null;
        savedMoves = saveObj.moves || [];
        
        // IMPORTANT: Always start with a fresh chess instance and replay moves
        chess = new Chess();
        
        if (savedMoves.length > 0) {
            // Replay all saved moves to rebuild the game state and history
            for (var i = 0; i < savedMoves.length; i++) {
                try {
                    var moveResult = chess.move(savedMoves[i]);
                    if (!moveResult) {
                        // If move fails, fall back to FEN position and clear history tracking
                        chess = new Chess(saveObj.fen);
                        savedMoves = saveObj.moves || []; // Keep original moves for display
                        break;
                    }
                } catch(e) {
                    // If replay fails completely, use FEN
                    chess = new Chess(saveObj.fen);
                    savedMoves = saveObj.moves || [];
                    break;
                }
            }
        } else if (saveObj.fen) {
            // No moves but we have FEN, use it
            chess = new Chess(saveObj.fen);
        }
    } else {
        chess = new Chess();
        
        // Color selection
        console.print("\r\nPlay as (W)hite or (B)lack? [W]: ");
        var c = console.getkey().toUpperCase();
        if (c === "B") playerColor = "b";
        
        // Difficulty selection
        console.print("\r\nSelect difficulty: (E)asy, (M)edium, or (H)ard? [E]: ");
        c = console.getkey().toUpperCase();
        if (c === "M") difficulty = "medium";
        else if (c === "H") difficulty = "hard";
    }
    
    var playerNames = (playerColor === "w" ? 
                       "You (White) vs Computer " + difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + " (Black)" : 
                       "Computer " + difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + " (White) vs You (Black)");
    
    while (bbs.online && !js.terminated) {
        if (chess.turn() === playerColor) {
            var res = promptMove(chess, playerColor, playerNames, savedMoves);
            if (res === "QUIT" || res === false) {
                // Save current state
                var currentMoves = chess.history ? chess.history() : savedMoves;
                var gameData = {
                    id: gameId,
                    mode: "computer",
                    fen: chess.fen(),
                    turn: chess.turn() === "w" ? "white" : "black",
                    moves: currentMoves,
                    white: (playerColor === "w" ? user.alias : "Computer"),
                    black: (playerColor === "b" ? user.alias : "Computer"),
                    playerColor: playerColor,
                    difficulty: difficulty
                };
                saveComputerGame(gameData);
                console.gotoxy(11, 22);
                console.print("Game saved. [Press any key]");
                console.getkey();
                break;
            }
            if (res === "SAVE") {
                // Save current state
                var currentMoves = chess.history ? chess.history() : savedMoves;
                var gameData = {
                    id: gameId,
                    mode: "computer",
                    fen: chess.fen(),
                    turn: chess.turn() === "w" ? "white" : "black",
                    moves: currentMoves,
                    white: (playerColor === "w" ? user.alias : "Computer"),
                    black: (playerColor === "b" ? user.alias : "Computer"),
                    playerColor: playerColor,
                    difficulty: difficulty
                };
                saveComputerGame(gameData);
                console.gotoxy(11, 22);
                console.print("Game saved. [Press any key]");
                console.getkey();
                return;
            }
            // Update savedMoves after player move
            if (chess.history) {
                savedMoves = chess.history();
            }
        } else {
            drawChessBoard(chess, "Computer (" + difficulty + ") is thinking...", "", playerNames, savedMoves);
            sleep(2000);
            computerMove(chess, difficulty);
            // Update savedMoves after computer move
            if (chess.history) {
                savedMoves = chess.history();
            }
        }
        
        if (chess.in_checkmate() || chess.in_stalemate() || chess.in_draw()) {
            // Final update of savedMoves
            if (chess.history) {
                savedMoves = chess.history();
            }
            
            var resultMsg = chess.in_checkmate()
                ? "Checkmate! " + (chess.turn() === "w" ? "Black" : "White") + " wins!"
                : "Draw!";
                
            // Display the final board position
            drawChessBoard(chess, resultMsg, "", playerNames, savedMoves);
            
            // Create a more prominent game-over message
            console.gotoxy(11, 20);
            console.print("\x01h\x01w" + repeatChar("-", 40) + "\x01n");
            console.gotoxy(11, 21);
            
            var gameResult = "";
            var winningColor = "";
            var victoryMessage = "";
            
            if (chess.in_checkmate()) {
                winningColor = (chess.turn() === "w" ? "b" : "w");
                var result = (playerColor === winningColor ? "Win" : "Loss");
                
                if (result === "Win") {
                    gameResult = "\x01h\x01g*** VICTORY! ***\x01n";
                    victoryMessage = "\x01h\x01gCongratulations! You defeated the " + 
                                    difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + 
                                    " computer opponent!\x01n";
                } else {
                    gameResult = "\x01h\x01r*** DEFEAT! ***\x01n";
                    victoryMessage = "\x01h\x01rThe " + difficulty.charAt(0).toUpperCase() + difficulty.slice(1) + 
                                    " computer opponent has defeated you.\x01n";
                }
                
                // Record the score
                try {
                    safeAddScore(user.alias, result, "Computer (" + difficulty + ")");
                } catch(e) {
                    logEvent("Error in score update: " + e.toString());
                }
            } else {
                gameResult = "\x01h\x01y*** DRAW! ***\x01n";
                victoryMessage = "\x01h\x01yThe game ended in a draw.\x01n";
                
                // Record draw
                try {
                    safeAddScore(user.alias, "Draw", "Computer (" + difficulty + ")");
                } catch(e) {
                    logEvent("Error in score update: " + e.toString());
                }
            }
            
            // Center the game result message
            var padLen = Math.floor((40 - gameResult.replace(/\x01./g, "").length) / 2);
            console.print(repeatChar(" ", padLen) + gameResult);
            
            console.gotoxy(11, 22);
            console.print(victoryMessage);
            
            console.gotoxy(11, 23);
            console.print("\x01h\x01w" + repeatChar("-", 40) + "\x01n");
            
            // Delete game from saved games if it exists
            if (gameId) {
                deleteComputerGame(gameId);
            }
            
            console.gotoxy(11, 25);
            console.print("\x01h\x01cPress any key to return to the menu...\x01n");
            console.getkey();
            break;
        }
    }
}

function getCapturedPieces(chess, capturerColor) {
    var initial = {
        w: { K:1, Q:1, R:2, B:2, N:2, P:8 },
        b: { k:1, q:1, r:2, b:2, n:2, p:8 }
    };
    var current = {
        K:0, Q:0, R:0, B:0, N:0, P:0,
        k:0, q:0, r:0, b:0, n:0, p:0
    };
    for (var r = 0; r < 8; r++) {
        for (var f = 0; f < 8; f++) {
            var square = files[f] + ranks[r];
            var piece = chess.get(square.toLowerCase());
            if (piece && piece.type && piece.color && current[piece.type.toUpperCase()] !== undefined) {
                var code = piece.type.toUpperCase();
                if (piece.color === "b") code = code.toLowerCase();
                current[code]++;
            }
        }
    }
    var result = [];
    if (capturerColor === 'w') {
        for (var p in initial.b) {
            var diff = initial.b[p] - current[p];
            for (var i = 0; i < diff; i++) result.push(p);
        }
    } else {
        for (var p in initial.w) {
            var diff = initial.w[p] - current[p];
            for (var i = 0; i < diff; i++) result.push(p);
        }
    }
    return result;
}

function getMaterialScore(capturedWhite, capturedBlack) {
    var values = { q:9, r:5, b:3, n:3, p:1, Q:9, R:5, B:3, N:3, P:1 };
    var score = 0;
    for (var i = 0; i < capturedWhite.length; i++) {
        var piece = capturedWhite[i];
        if (values[piece]) score += values[piece];
    }
    for (var i = 0; i < capturedBlack.length; i++) {
        var piece = capturedBlack[i];
        if (values[piece]) score -= values[piece];
    }
    if (score > 0) return "+" + score + " (White)";
    if (score < 0) return score + " (Black)";
    return "Even";
}

var squareCoords = {};
for (var r = 0; r < 8; r++)
    for (var f = 0; f < 8; f++) {
        var square = files[f] + ranks[r];
        var x = startX + f * squareW + centerOffsetX;
        var y = startY + r * squareH + centerOffsetY;
        squareCoords[square] = { x: x, y: y };
    }

function getNewBoard() {
    return new Chess();
}

function convertSyncAnsi(text) {
    return text.replace(/(?:\x01|\u263A)([a-z])/g, function(match, code) {
        return SBBS_TO_ANSI[code] || '';
    });
}

function getNewBoard() {
    return new Chess();
}

function convertSyncAnsi(text) {
    return text.replace(/(?:\x01|\u263A)([a-z])/g, function(match, code) {
        return SBBS_TO_ANSI[code] || '';
    });
}

function convertScoresAnsToAnsi() {
    var infile = js.exec_dir + "scores.ans";
    var outfile = js.exec_dir + "score.ans";
    if (!file_exists(infile))
        return false;
    var inf = new File(infile);
    if (!inf.open("r"))
        return false;
    var text = inf.readAll().join('\n');
    inf.close();
    var converted = convertSyncAnsi(text);
    var outf = new File(outfile);
    if (!outf.open("w"))
        return false;
    outf.write(converted);
    outf.close();
    return true;
}

function getLocalPlayerList() {
    var players = [];
    for (var i = 1; i <= system.lastuser; i++) {
        if (i === user.number) continue;
        var u = new User(i);
        if (u.name && !u.deleted && !u.locked) {
            players.push({num: i, alias: u.alias, name: u.name});
        }
    }
    return players;
}

function selectLocalOpponent(players) {
    var WIDTH = 36;
    var HEIGHT = console.screen_rows;
    var menu_x = 4;
    var menu_y = 6;
    var menu_height = Math.min(players.length + 2, HEIGHT - menu_y - 2);

    var menu = new DDLightbarMenu(menu_x, menu_y, WIDTH, menu_height);
    for (var i = 0; i < players.length; i++) {
        var disp = format("%s (%s)", players[i].alias, players[i].name);
        menu.Add(disp, i.toString());
    }
    menu.colors.itemColor = "\x01k\x01h";
    menu.colors.selectedItemColor = "\x01g\x01h";
    menu.colors.borderColor = "\x01g";
    menu.colors.scrollbarBGColor = "\x01g";
    menu.colors.scrollbarFGColor = "\x01w";
    menu.borderEnabled = true;
    menu.scrollbarEnabled = true;
    menu.AddAdditionalQuitKeys("qQ\x1b");

    console.clear();
    console.gotoxy(menu_x, menu_y - 2);
    console.print("\x01w\x01hSelect a local player to play as Black:\x01n");

    var selected = menu.GetVal();
    if (typeof selected !== "string") return null;
    var idx = parseInt(selected, 10);
    if (isNaN(idx) || idx < 0 || idx >= players.length) return null;
    return players[idx];
}

function loadInterBBSGames() {
    if (!file_exists(INTERBBS_GAMES_FILE)) return [];
    var f = new File(INTERBBS_GAMES_FILE);
    if (!f.open("r")) return [];
    var arr = JSON.parse(f.readAll().join(""));
    f.close();
    return arr;
}
function saveInterBBSGames(games) {
    var f = new File(INTERBBS_GAMES_FILE);
    if (f.open("w+")) {
        f.write(JSON.stringify(games, null, 2));
        f.close();
    }
}
function getMyInterBBSGames() {
    var games = loadInterBBSGames();
    return games.filter(function(g) {
        return g.players && (g.players.white.user === user.alias || g.players.black.user === user.alias);
    });
}
function getPendingChallenges() {
    var games = loadInterBBSGames();
    return games.filter(function(g) {
        return g.status === "pending" && g.players && g.players.black.user === user.alias;
    });
}

function interbbsChallenge() {
    var nodes = readNodes();
    if (!nodes.length) {
        console.print("\r\nNo InterBBS node file found or no nodes listed.\r\n");
        console.print("[Press any key]");
        console.getkey();
        return;
    }
    
    console.print("\r\nAvailable BBSes:\r\n");
    for (var i=0; i<nodes.length; i++) {
        console.print(format("%2d. %-25s Address: %-15s\r\n", i+1, nodes[i].name||"", nodes[i].address||""));
    }
    
    console.print("Enter destination BBS number: ");
    var idx = parseInt(console.getstr(2));
    if (isNaN(idx) || idx < 1 || idx > nodes.length) {
        console.print("Invalid choice.\r\n");
        console.print("[Press any key]");
        console.getkey();
        return;
    }
    var node = nodes[idx-1];
    
    var oppUser = "";
    
    // Show available players on that BBS (if we have them)
    var players = getPlayersForNode(node.address);
    if (players.length > 0) {
        console.print("\r\nKnown players on " + node.name + ":\r\n");
        for (var i=0; i<players.length; i++) {
            console.print(format("%2d. %s (Last seen: %s)\r\n", i+1, players[i].username, players[i].lastSeen || "Unknown"));
        }
        console.print(format("%2d. Request updated player list\r\n", players.length+1));
        console.print(format("%2d. Enter custom username\r\n", players.length+2));
        console.print("Select option: ");
        var pidx = parseInt(console.getstr(2));
        
        if (!isNaN(pidx) && pidx >= 1 && pidx <= players.length) {
            oppUser = players[pidx-1].username;
        } else if (pidx === players.length + 1) {
            // Request player list
            console.print("\r\nRequesting updated player list from " + node.name + "...\r\n");
            if (requestPlayerList(node.address)) {
                console.print("Request sent! Check back later for updated player list.\r\n");
            } else {
                console.print("Error sending request.\r\n");
            }
            console.print("[Press any key]");
            console.getkey();
            return;
        } else if (pidx === players.length + 2) {
            console.print("Enter opponent's username: ");
            oppUser = console.getstr(30);
        } else {
            console.print("Invalid choice.\r\n");
            console.print("[Press any key]");
            console.getkey();
            return;
        }
    } else {
        console.print("\r\nNo known players on " + node.name + ".\r\n");
        console.print("Options:\r\n");
        console.print("1. Request player list from " + node.name + "\r\n");
        console.print("2. Enter username manually\r\n");
        console.print("Choice: ");
        var choice = console.getkey();
        
        if (choice === "1") {
            console.print("\r\nRequesting player list from " + node.name + "...\r\n");
            if (requestPlayerList(node.address)) {
                console.print("Request sent! Check back later for updated player list.\r\n");
            } else {
                console.print("Error sending request.\r\n");
            }
            console.print("[Press any key]");
            console.getkey();
            return;
        } else if (choice === "2") {
            console.print("\r\nEnter opponent's username: ");
            oppUser = console.getstr(30);
        } else {
            console.print("\r\nInvalid choice.\r\n");
            console.print("[Press any key]");
            console.getkey();
            return;
        }
    }
    
    // Rest of the function remains the same...
    if (!oppUser) {
        console.print("No username entered.\r\n");
        console.print("[Press any key]");
        console.getkey();
        return;
    }
    
    console.print("Play as (W)hite, (B)lack, or (R)andom? [W]: ");
    var color = "white";
    var c = console.getkey().toUpperCase();
    if (c === "B") color = "black";
    else if (c === "R") color = (Math.random() < 0.5) ? "white" : "black";
    
    // FIX: Better game ID generation
    var myAddress = getLocalBBS("address");
    if (!myAddress || myAddress === "unknown") {
        // Fallback to system fidonet address or generate one
        myAddress = system.fidonet_addr || myBBS.address || "777:777/4";
    }
    
    var game_id = myAddress.replace(/[^A-Za-z0-9]/g, "_") + "_" + strftime("%Y%m%dT%H%M%S", time());
    
    var challengePacket = {
        type: "challenge",
        game_id: game_id,
        from: {
            bbs: getLocalBBS("name"),
            address: myAddress,
            user: user.alias
        },
        to: {
            bbs: node.name,
            address: node.address,
            user: oppUser
        },
        color: color,
        created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
    };
    
    // Save this challenge to our games list so we can track it
    var games = loadInterBBSGames();
    var newGame = {
        game_id: game_id,
        status: "sent",
        players: {
            white: (color === "white") ? { bbs: getLocalBBS("name"), address: myAddress, user: user.alias } : { bbs: node.name, address: node.address, user: oppUser },
            black: (color === "black") ? { bbs: getLocalBBS("name"), address: myAddress, user: user.alias } : { bbs: node.name, address: node.address, user: oppUser }
        },
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        move_history: [],
        turn: "white",
        last_update: challengePacket.created,
        result: ""
    };
    games.push(newGame);
    saveInterBBSGames(games);
    
    // Add opponent to player database
    addPlayerToDB(node.address, oppUser, strftime("%Y-%m-%d", time()));
    
    var fname = format("chess_ibbs_challenge_%s.json", game_id.replace(/[^A-Za-z0-9_]/g,""));
    var path = INTERBBS_OUT_DIR + fname;
    var f = new File(path);
    if (f.open("w+")) {
        f.write(JSON.stringify(challengePacket, null, 2));
        f.close();
        console.print("\r\nChallenge sent to " + oppUser + " at " + node.name + "\r\n");
        console.print("Game ID: " + game_id + "\r\n");
        console.print("You will play as: " + color + "\r\n");
        console.print("Packet saved to: " + path + "\r\n");
    } else {
        console.print("\r\nError: Could not create challenge packet.\r\n");
    }
    console.print("[Press any key]");
    console.getkey();
}

function interbbsListChallenges() {
    var challenges = getPendingChallenges();
    if (!challenges || challenges.length === 0) {
        console.print("\x01r\x01hNo pending InterBBS challenges.\x01n\r\n");
        console.print("Press any key to return to the menu...\r\n");
        console.getkey();
        return;
    }
    
    console.print("\r\n\x01h\x01cPending InterBBS Challenges:\x01n\r\n");
    console.print("\x01b" + "=".repeat(50) + "\x01n\r\n");
    
    for (var i = 0; i < challenges.length; i++) {
        var c = challenges[i];
        var challenger = c.players.white.user;
        var challengerBBS = c.players.white.bbs;
        console.print(format("\x01g[%d]\x01n From: \x01h%s\x01n @ \x01c%s\x01n\r\n", i + 1, challenger, challengerBBS));
        console.print(format("     Game ID: %s\r\n", c.game_id));
        console.print(format("     You would play as: \x01h%s\x01n\r\n", (c.players.black.user === user.alias) ? "Black" : "White"));
        console.print("\r\n");
    }
    
    console.print("Select challenge number to accept/decline (or Q to quit): ");
    var sel = console.getstr(2);
    if (!sel || sel.toUpperCase() === "Q") return;
    
    var idx = parseInt(sel);
    if (isNaN(idx) || idx < 1 || idx > challenges.length) {
        console.print("Invalid selection.\r\n");
        console.print("[Press any key]");
        console.getkey();
        return;
    }
    
    var challenge = challenges[idx - 1];
    console.print("\r\n\x01h\x01gAccept (A) or Decline (D) this challenge?\x01n ");
    var resp = console.getkey().toUpperCase();
    
    var games = loadInterBBSGames();
    
    if (resp === "A") {
        var acceptPacket = {
            type: "accept",
            game_id: challenge.game_id,
            from: {
                bbs: getLocalBBS("name"),
                address: getLocalBBS("address"),
                user: user.alias
            },
            to: challenge.players.white,
            created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
        };
        
        var fname = format("chess_ibbs_accept_%s.json", challenge.game_id.replace(/[^A-Za-z0-9_]/g, ""));
        var path = INTERBBS_OUT_DIR + fname;
        var f = new File(path);
        if (f.open("w+")) {
            f.write(JSON.stringify(acceptPacket, null, 2));
            f.close();
            console.print("\r\n\x01h\x01gChallenge accepted!\x01n\r\n");
        }
        
        // Update game status
        for (var i = 0; i < games.length; i++) {
            if (games[i].game_id === challenge.game_id) {
                games[i].status = "active";
                break;
            }
        }
        saveInterBBSGames(games);
        
        // Add challenger to player database
        addPlayerToDB(challenge.players.white.address, challenge.players.white.user, strftime("%Y-%m-%d", time()));
        
    } else if (resp === "D") {
        var declinePacket = {
            type: "decline",
            game_id: challenge.game_id,
            from: {
                bbs: getLocalBBS("name"),
                address: getLocalBBS("address"),
                user: user.alias
            },
            to: challenge.players.white,
            reason: "Declined by user",
            created: strftime("%Y-%m-%dT%H:%M:%SZ", time())
        };
        
        var fname = format("chess_ibbs_decline_%s.json", challenge.game_id.replace(/[^A-Za-z0-9_]/g, ""));
        var path = INTERBBS_OUT_DIR + fname;
        var f = new File(path);
        if (f.open("w+")) {
            f.write(JSON.stringify(declinePacket, null, 2));
            f.close();
            console.print("\r\n\x01h\x01rChallenge declined.\x01n\r\n");
        }
        
        // Remove game from list
        games = games.filter(function (g) { return g.game_id !== challenge.game_id; });
        saveInterBBSGames(games);
    } else {
        console.print("\r\nInvalid choice.\r\n");
    }

    console.print("[Press any key]");
    console.getkey();
}

function showAchessNotificationsInteractive() {
    var notes = readAchessNotifications();
    var myNotes = notes.filter(function(n) {
        return typeof n.to === "string" && n.to.toLowerCase() === user.alias.toLowerCase();
    });
    
    if (!myNotes.length) {
        console.print("\r\nNo Achess notifications found.\r\n");
        console.print("Press any key to continue...\r\n");
        console.getkey();
        return;
    }
    
    var currentPage = 0;
    var notesPerPage = 5;
    var totalPages = Math.ceil(myNotes.length / notesPerPage);
    var selectedNotes = []; // Array to track selected notifications
    
    // Helper function to check if a value exists in an array (instead of using includes())
    function isInArray(arr, value) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] === value) {
                return true;
            }
        }
        return false;
    }
    
    while (bbs.online && !js.terminated) {
        console.clear();
        console.print("\r\n\x01h\x01c--- Achess Notifications ---\x01n\r\n");
        
        // Display notifications for current page
        var startIdx = currentPage * notesPerPage;
        var endIdx = Math.min(startIdx + notesPerPage, myNotes.length);
        
        for (var i = startIdx; i < endIdx; i++) {
            var n = myNotes[i];
            var unread = n.read ? "" : " \x01h\x01r(UNREAD)\x01n";
            var selected = isInArray(selectedNotes, i) ? " \x01h\x01g[X]\x01n" : " \x01h\x01w[ ]\x01n";
            
            console.print(format("\x01h\x01g[%d]%s%s \x01w\x01hSubject: \x01n%s  Date: %s\r\n", 
                i+1, selected, unread, n.subject || "No subject", n.time || ""));
            
            // Safely truncate body text to prevent errors
            var bodyText = n.body || "";
            if (bodyText.length > 60) {
                bodyText = bodyText.substring(0, 60) + "...";
            }
            console.print(bodyText + "\r\n");
            
            console.print("\x01b--------------------------------------------------\x01n\r\n");
        }
        
        // Show navigation and selection instructions
        console.print("\r\n\x01h\x01wPage " + (currentPage + 1) + " of " + totalPages + 
                     " - " + selectedNotes.length + " note(s) selected\x01n\r\n");
        console.print("\x01h\x01c[N]\x01n Next page  \x01h\x01c[P]\x01n Previous page  " + 
                     "\x01h\x01c[#]\x01n Select notification  \x01h\x01c[Q]\x01n Quit\r\n");
        console.print("\x01h\x01c[S#]\x01n Select/Deselect #  \x01h\x01c[A]\x01n Select All  " + 
                     "\x01h\x01c[C]\x01n Clear All Selections\r\n");
        console.print("\x01h\x01c[D]\x01n Delete Selected  \x01h\x01c[DA]\x01n Delete All\r\n");
        console.print("Enter your choice: ");
        
        var input = console.getstr(5).toUpperCase();
        if (input === "Q") {
            return;
        } else if (input === "N") {
            if (currentPage < totalPages - 1) currentPage++;
        } else if (input === "P") {
            if (currentPage > 0) currentPage--;
        } else if (input === "A") {
            // Select all notifications
            selectedNotes = [];
            for (var i = 0; i < myNotes.length; i++) {
                selectedNotes.push(i);
            }
            console.print("\r\n\x01h\x01gAll notifications selected.\x01n");
            console.print("\r\nPress any key to continue...");
            console.getkey();
        } else if (input === "C") {
            // Clear all selections
            selectedNotes = [];
            console.print("\r\n\x01h\x01yAll selections cleared.\x01n");
            console.print("\r\nPress any key to continue...");
            console.getkey();
        } else if (input === "D") {
            // Delete selected notifications
            if (selectedNotes.length === 0) {
                console.print("\r\n\x01h\x01yNo notifications selected.\x01n");
                console.print("\r\nPress any key to continue...");
                console.getkey();
                continue;
            }
            
            console.print("\r\n\x01h\x01yDelete " + selectedNotes.length + " selected notification(s)? (Y/N): \x01n");
            var confirm = console.getkey().toUpperCase();
            
            if (confirm === "Y") {
                // Sort in descending order to avoid index shifting during removal
                selectedNotes.sort(function(a, b) { return b - a; });
                
                // Create indices map between myNotes and the original notes array
                var noteIndices = [];
                var myNoteIndex = 0;
                
                for (var i = 0; i < notes.length; i++) {
                    if (typeof notes[i].to === "string" && notes[i].to.toLowerCase() === user.alias.toLowerCase()) {
                        noteIndices[myNoteIndex] = i;
                        myNoteIndex++;
                    }
                }
                
                // Remove from the original array
                for (var i = 0; i < selectedNotes.length; i++) {
                    var myNoteIdx = selectedNotes[i];
                    var origNoteIdx = noteIndices[myNoteIdx];
                    
                    // Skip if index is out of range (safety check)
                    if (origNoteIdx === undefined || origNoteIdx < 0 || origNoteIdx >= notes.length) {
                        continue;
                    }
                    
                    notes.splice(origNoteIdx, 1);
                    
                    // Update indices for remaining notes (they shift down after removal)
                    for (var j = 0; j < noteIndices.length; j++) {
                        if (noteIndices[j] > origNoteIdx) {
                            noteIndices[j]--;
                        }
                    }
                }
                
                writeAchessNotifications(notes);
                
                console.print("\r\n\x01h\x01gSelected notifications deleted.\x01n");
                console.print("\r\nPress any key to continue...");
                console.getkey();
                
                // Refresh the list
                notes = readAchessNotifications();
                myNotes = notes.filter(function(n) {
                    return typeof n.to === "string" && n.to.toLowerCase() === user.alias.toLowerCase();
                });
                
                if (myNotes.length === 0) {
                    console.print("\r\n\x01h\x01gNo more notifications.\x01n");
                    console.print("\r\nPress any key to continue...");
                    console.getkey();
                    return;
                }
                
                // Reset selections and recalculate pages
                selectedNotes = [];
                totalPages = Math.ceil(myNotes.length / notesPerPage);
                if (currentPage >= totalPages) {
                    currentPage = totalPages - 1;
                }
            }
        } else if (input === "DA") {
            // Delete all notifications
            console.print("\r\n\x01h\x01yAre you sure you want to delete ALL your notifications? (Y/N): \x01n");
            var confirm = console.getkey().toUpperCase();
            
            if (confirm === "Y") {
                // Remove all of the current user's notifications
                var newNotes = [];
                for (var i = 0; i < notes.length; i++) {
                    var note = notes[i];
                    if (!(typeof note.to === "string" && note.to.toLowerCase() === user.alias.toLowerCase())) {
                        newNotes.push(note);
                    }
                }
                
                writeAchessNotifications(newNotes);
                
                console.print("\r\n\x01h\x01gAll your notifications have been deleted.\x01n");
                console.print("\r\nPress any key to continue...");
                console.getkey();
                return;
            }
        } else if (input.substring(0, 1) === "S" && input.length > 1) {
            // Select/deselect a specific notification
            var noteNum = parseInt(input.substring(1)) - 1;
            if (!isNaN(noteNum) && noteNum >= 0 && noteNum < myNotes.length) {
                var found = false;
                var foundIndex = -1;
                
                // Find the note in the selected array
                for (var i = 0; i < selectedNotes.length; i++) {
                    if (selectedNotes[i] === noteNum) {
                        found = true;
                        foundIndex = i;
                        break;
                    }
                }
                
                if (!found) {
                    // Select the notification
                    selectedNotes.push(noteNum);
                    console.print("\r\n\x01h\x01gNotification " + (noteNum + 1) + " selected.\x01n");
                } else {
                    // Deselect the notification
                    selectedNotes.splice(foundIndex, 1);
                    console.print("\r\n\x01h\x01yNotification " + (noteNum + 1) + " deselected.\x01n");
                }
                console.print("\r\nPress any key to continue...");
                console.getkey();
            }
        } else {
            // Check if it's a number for notification selection
            var noteNum = parseInt(input);
            if (!isNaN(noteNum) && noteNum >= 1 && noteNum <= myNotes.length) {
                var changed = handleNotificationActions(notes, myNotes, noteNum - 1); // Zero-based index
                if (changed) {
                    // Refresh the list if notifications were deleted
                    notes = readAchessNotifications();
                    myNotes = notes.filter(function(n) {
                        return typeof n.to === "string" && n.to.toLowerCase() === user.alias.toLowerCase();
                    });
                    
                    if (myNotes.length === 0) {
                        console.print("\r\n\x01h\x01gNo more notifications.\x01n");
                        console.print("\r\nPress any key to continue...");
                        console.getkey();
                        return;
                    }
                    
                    // Recalculate pages
                    selectedNotes = [];
                    totalPages = Math.ceil(myNotes.length / notesPerPage);
                    if (currentPage >= totalPages) {
                        currentPage = totalPages - 1;
                    }
                }
            }
        }
    }
}

function handleNotificationActions(allNotes, myNotes, index) {
    var note = myNotes[index];
    var changed = false;
    
    while (bbs.online && !js.terminated) {
        console.clear();
        console.print("\r\n\x01h\x01c--- Notification Details ---\x01n\r\n\r\n");
        
        console.print(format("\x01h\x01wNotification %d of %d\x01n\r\n", index + 1, myNotes.length));
        console.print(format("\x01h\x01wDate: \x01n%s\r\n", note.time || "Unknown"));
        console.print(format("\x01h\x01wSubject: \x01n%s\r\n\r\n", note.subject || "No subject"));
        console.print((note.body || "") + "\r\n\r\n");
        
        var readStatus = note.read ? "\x01g(Read)\x01n" : "\x01r(Unread)\x01n";
        console.print(format("\x01h\x01wStatus: \x01n%s\r\n\r\n", readStatus));
        
        console.print("\x01h\x01g[K]\x01n Keep (mark as read)  \x01h\x01c[R]\x01n Reply  \x01h\x01r[D]\x01n Delete  \x01h\x01w[Q]\x01n Back to notifications\r\n");
        console.print("Enter your choice: ");
        
        var choice = console.getkey().toUpperCase();
        
        if (choice === "Q") {
            return changed;
        } else if (choice === "K") {
            // Mark as read and keep
            note.read = true;
            writeAchessNotifications(allNotes);
            console.print("\r\n\x01h\x01gNotification marked as read.\x01n");
            console.print("\r\nPress any key to continue...");
            console.getkey();
            return changed;
        } else if (choice === "R") {
            replyToNotification(note);
            // Mark original as read after replying
            note.read = true;
            writeAchessNotifications(allNotes);
            return changed;
        } else if (choice === "D") {
            if (confirmDeleteNotification()) {
                // Find and remove this notification from the main array
                for (var i = 0; i < allNotes.length; i++) {
                    if (allNotes[i] === note) {
                        allNotes.splice(i, 1);
                        break;
                    }
                }
                writeAchessNotifications(allNotes);
                console.print("\r\n\x01h\x01gNotification deleted successfully.\x01n");
                console.print("\r\nPress any key to continue...");
                console.getkey();
                return true; // Indicate that changes were made
            }
        }
    }
    return changed;
}

function replyToNotification(originalNote) {
    console.clear();
    console.print("\r\n\x01h\x01c--- Reply to Notification ---\x01n\r\n\r\n");
    
    // Extract sender from the notification (if available)
    // For game invitations and challenges, we might need to parse the body
    var replyTo = extractSenderFromNotification(originalNote);
    
    if (!replyTo) {
        console.print("\x01h\x01rCannot determine sender for this notification. Reply canceled.\x01n\r\n");
        console.print("Press any key to continue...");
        console.getkey();
        return;
    }
    
    // Create reply subject
    var subject = originalNote.subject || "No subject";
    if (subject.indexOf("Re:") !== 0) {
        subject = "Re: " + subject;
    }
    
    console.print("\x01h\x01wTo: \x01n" + replyTo + "\r\n");
    console.print("\x01h\x01wSubject: \x01n" + subject + "\r\n\r\n");
    console.print("Enter your reply message (end with a single dot '.'): \r\n");
    
    var body = "";
    while (true) {
        var line = console.getstr(80);
        if (line === ".") break;
        body += line + "\r\n";
    }
    
    if (body.trim()) {
        // Send the reply as a new Achess notification
        sendAchessNotification(replyTo, subject, body);
        console.print("\r\n\x01h\x01gReply sent successfully!\x01n\r\n");
    } else {
        console.print("\r\n\x01h\x01yReply canceled (empty message).\x01n\r\n");
    }
    
    console.print("Press any key to continue...");
    console.getkey();
}

function extractSenderFromNotification(note) {
    // Try to extract sender information from the notification
    // This function attempts to parse common notification formats
    
    var body = note.body || "";
    var subject = note.subject || "";
    
    // Check for game invitation pattern
    var inviteMatch = body.match(/(\w+) has invited you to a Chess match/);
    if (inviteMatch) {
        return inviteMatch[1];
    }
    
    // Check for challenge pattern
    var challengeMatch = body.match(/Challenge from (\w+)/);
    if (challengeMatch) {
        return challengeMatch[1];
    }
    
    // Check for move notification pattern
    var moveMatch = body.match(/(\w+) has made a move/);
    if (moveMatch) {
        return moveMatch[1];
    }
    
    // Check subject for sender patterns
    var subjectMatch = subject.match(/from (\w+)/i);
    if (subjectMatch) {
        return subjectMatch[1];
    }
    
    // If we can't determine the sender, ask the user
    console.print("\r\nCannot automatically determine reply recipient.\r\n");
    console.print("Enter recipient username (or press Enter to cancel): ");
    var manualRecipient = console.getstr(30);
    return manualRecipient.trim() || null;
}

function confirmDeleteNotification() {
    console.print("\r\n\x01h\x01yAre you sure you want to delete this notification? (Y/N): \x01n");
    var confirm = console.getkey().toUpperCase();
    return confirm === "Y";
}

function interbbsListGamesAndMove() {
    var games = getMyInterBBSGames();
    if (!games || games.length === 0) {
        console.print("\x01r\x01hNo active InterBBS games.\x01n\r\n");
        console.print("Press any key to return to the menu...\r\n");
        console.getkey();
        return;
    }
    
    console.clear();
    console.print("\r\n\x01h\x01cActive InterBBS Games:\x01n\r\n");
    console.print("\x01b" + repeatChar("=", 60) + "\x01n\r\n");
    
    for (var i = 0; i < games.length; i++) {
        var g = games[i];
        var opponent = (g.players.white.user === user.alias) ? g.players.black.user : g.players.white.user;
        var opponentBBS = (g.players.white.user === user.alias) ? g.players.black.bbs : g.players.white.bbs;
        var myColor = (g.players.white.user === user.alias) ? "White" : "Black";
        var turnIndicator = (g.turn === myColor.toLowerCase()) ? "\x01g[YOUR TURN]\x01n" : "\x01r[Waiting]\x01n";
        
        console.print(format("[%d] vs %s @ %s  %s\r\n",
            i + 1, opponent, opponentBBS, turnIndicator));
        console.print(format("     Game ID: %s\r\n", g.game_id));
        console.print(format("     Your color: %s  Current turn: %s\r\n", 
            myColor, g.turn === "white" ? "White" : "Black"));
        console.print("\r\n");
    }
    
    console.print("Select game number to view/move (or Q to quit): ");
    var sel = console.getstr(2);
    if (!sel || sel.toUpperCase() === "Q") return;
    
    var idx = parseInt(sel);
    if (isNaN(idx) || idx < 1 || idx > games.length) {
        console.print("Invalid selection.\r\n");
        console.print("[Press any key]");
        console.getkey();
        return;
    }
    
    var game = games[idx - 1];
    var myColor = (game.players.white.user === user.alias) ? "white" : "black";
    
    // Load the actual game position and replay move history for proper display
    var chess = new Chess();
    
    // If we have stored move history, replay it to get proper chess.history() and position
    if (game.move_history && game.move_history.length > 0) {
        for (var h = 0; h < game.move_history.length; h++) {
            try {
                chess.move(game.move_history[h]);
            } catch (e) {
                // If move fails, fall back to FEN position
                chess = new Chess(game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
                break;
            }
        }
    } else {
        // No move history, use FEN position
        chess = new Chess(game.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }
    
    // Clear screen and show current board position
    console.clear();
    
    var playerNames = game.players.white.user + " vs " + game.players.black.user;
    var turnText = "";
    var checkText = "";
    
    if (chess.in_check && chess.in_check()) {
        checkText = (chess.turn() === "w" ? "White" : "Black") + " is in check!";
    }
    
    if (game.turn !== myColor) {
        turnText = "Waiting for " + (game.turn === "white" ? game.players.white.user : game.players.black.user) + " to move";
        drawChessBoard(chess, turnText, checkText, playerNames);
        
        console.gotoxy(1, 23);
        console.cleartoeol();
        console.print("It's not your turn in this game.");
        console.gotoxy(1, 24);
        console.print("Press any key to return to menu...");
        console.getkey();
        return;
    }
    
    // It's the player's turn
    turnText = "Your move (" + myColor + ")";
    drawChessBoard(chess, turnText, checkText, playerNames);
    
    // Check if game is over
    if (chess.in_checkmate() || chess.in_stalemate() || chess.in_draw()) {
        console.gotoxy(1, 23);
        console.cleartoeol();
        if (chess.in_checkmate()) {
            console.print("Game Over - Checkmate!");
        } else {
            console.print("Game Over - Draw!");
        }
        console.gotoxy(1, 24);
        console.print("Press any key to return to menu...");
        console.getkey();
        return;
    }
    
    // Get player's move - Clear multiple lines to ensure clean display
    for (var clearY = 20; clearY <= 25; clearY++) {
        console.gotoxy(1, clearY);
        console.cleartoeol();
    }

    console.gotoxy(1, 23);
    console.print("Material: " + getMaterialScore(getCapturedPieces(chess, 'w'), getCapturedPieces(chess, 'b')));

    console.gotoxy(1, 24);
    console.print("Enter your move (try: e2e4, Nf3, or d4): ");

    var move = console.getstr(8);
    
    if (!move || move.toUpperCase() === "Q") {
        return;
    }
    
    // Try to make the move - Enhanced with multiple formats
    var moveObj = null;
    var files = "ABCDEFGH";
    var ranks = "12345678";
    
    // Try different move formats
    if (move.length === 4 &&
        files.indexOf(move[0].toUpperCase()) >= 0 &&
        ranks.indexOf(move[1]) >= 0 &&
        files.indexOf(move[2].toUpperCase()) >= 0 &&
        ranks.indexOf(move[3]) >= 0) {
        // Try coordinate notation (e2e4)
        moveObj = chess.move({
            from: move.substr(0,2).toLowerCase(),
            to: move.substr(2,2).toLowerCase(),
            promotion: "q"
        });
    }
    
    if (!moveObj) {
        // Try algebraic notation (Nf3, e4, etc.)
        try {
            moveObj = chess.move(move);
        } catch(e) {}
    }
    
    if (!moveObj) {
        // Try with sloppy flag for more lenient parsing
        try {
            moveObj = chess.move(move, { sloppy: true });
        } catch(e) {}
    }
    
    if (!moveObj) {
        console.gotoxy(1, 25);
        console.cleartoeol();
        console.print("Illegal move! Valid moves: e2e4, d2d4, Nf3, Ng1f3... Press any key");
        console.getkey();
        // Recursive call to try again
        interbbsListGamesAndMove();
        return;
    }
    
    // Update game state
    game.fen = chess.fen();
    if (!game.move_history) game.move_history = [];
    game.move_history.push(moveObj.san || move); // Use SAN notation if available
    game.turn = (game.turn === "white" ? "black" : "white");
    game.last_update = strftime("%Y-%m-%dT%H:%M:%SZ", time());
    
    // Save updated game state
    var allGames = loadInterBBSGames();
    for (var i = 0; i < allGames.length; i++) {
        if (allGames[i].game_id === game.game_id) {
            allGames[i] = game;
            break;
        }
    }
    saveInterBBSGames(allGames);
    
    // Create move packet using configured outbound directory
    var movePacket = {
        type: "move",
        game_id: game.game_id,
        from: {
            bbs: getLocalBBS("name"),
            address: getLocalBBS("address"),
            user: user.alias
        },
        to: (game.players.white.user === user.alias) ? game.players.black : game.players.white,
        move: moveObj.san || move,
        fen: game.fen,
        move_history: game.move_history,
        created: game.last_update
    };
    
    var fname = format("chess_ibbs_move_%s.json", game.game_id.replace(/[^A-Za-z0-9_]/g, ""));
    var path = INTERBBS_OUT_DIR + fname;
    var f = new File(path);
    if (f.open("w+")) {
        f.write(JSON.stringify(movePacket, null, 2));
        f.close();
    }
    
    // Show success message
    console.gotoxy(1, 25);
    console.cleartoeol();
    console.print("Move sent successfully! Press any key to continue...");
    console.getkey();
}

function sendInterBBSMessage() {
    var nodes = readNodes();
    if (!nodes.length) {
        console.print("\r\nNo InterBBS node file found or no nodes listed.\r\n");
        return;
    }
    console.print("\r\nAvailable BBSes:\r\n");
    for (var i=0; i<nodes.length; i++) {
        console.print(format("%2d. %-25s Address: %-15s\r\n", i+1, nodes[i].name||"", nodes[i].address||""));
    }
    console.print("Enter destination BBS number: ");
    var idx = parseInt(console.getstr(2));
    if (isNaN(idx) || idx < 1 || idx > nodes.length) {
        console.print("Invalid choice.\r\n");
        return;
    }
    var node = nodes[idx-1];
    
    var toUser = "";
    
    // Show available players on that BBS (if we have them)
    var players = getPlayersForNode(node.address);
    if (players.length > 0) {
        console.print("\r\nKnown players on " + node.name + ":\r\n");
        for (var i=0; i<players.length; i++) {
            console.print(format("%2d. %s (Last seen: %s)\r\n", i+1, players[i].username, players[i].lastSeen || "Unknown"));
        }
        console.print(format("%2d. Enter custom username\r\n", players.length+1));
        console.print(format("%2d. Send to all users (broadcast)\r\n", players.length+2));
        console.print("Select recipient: ");
        var pidx = parseInt(console.getstr(2));
        if (!isNaN(pidx) && pidx >= 1 && pidx <= players.length) {
            toUser = players[pidx-1].username;
        } else if (pidx === players.length + 1) {
            console.print("Enter recipient's username: ");
            toUser = console.getstr(30);
        } else if (pidx === players.length + 2) {
            toUser = ""; // Broadcast to all users
        } else {
            console.print("Invalid choice.\r\n");
            return;
        }
    } else {
        console.print("No known players on " + node.name + ".\r\n");
        console.print("Enter recipient's username (or leave blank for broadcast): ");
        toUser = console.getstr(30);
    }
    
    console.print("Subject: ");
    var subject = console.getstr(40);
    console.print("Message (end with a single dot '.'): \r\n");
    var body = "";
    while (true) {
        var line = console.getstr(80);
        if (line === ".") break;
        body += line + "\r\n";
    }
    
    var msg = {
        type: "message",
        bbs: getLocalBBS("name"),
        address: getLocalBBS("address"),
        to_bbs: node.name,
        to_addr: node.address,
        to_user: toUser, // Make sure this is set to the selected alias, NOT blank unless intended for broadcast
        from_user: user.alias,
        subject: subject,
        body: body,
        created: strftime("%Y-%m-%d %H:%M:%S", time())
    };
    
    var fname = format("chess_messagepacket_%s_%s.json", 
        node.address.replace(/[:\/]/g,"_"), 
        strftime("%Y%m%d_%H%M%S", time()));
    var path = INTERBBS_OUT_DIR + fname;
    var f = new File(path);
    if (f.open("w+")) {
        f.write(JSON.stringify(msg, null, 2));
        f.close();
        if (toUser) {
            console.print("Message sent to " + toUser + " at " + node.name + "\r\n");
        } else {
            console.print("Broadcast message sent to all users at " + node.name + "\r\n");
        }
        console.print("Packet saved to: " + path + "\r\n");
    }
    console.print("[Press any key]");
    console.getkey();
}

function readMessages() {
    if (!file_exists(MESSAGES_FILE)) return [];
    var f = new File(MESSAGES_FILE);
    if (!f.open("r")) return [];
    var arr = JSON.parse(f.readAll().join(""));
    f.close();
    return arr;
}

function writeMessages(msgs) {
    var f = new File(MESSAGES_FILE);
    if (f.open("w+")) {
        f.write(JSON.stringify(msgs, null, 2));
        f.close();
    }
}

function readNodes() {
    var nodes = [];
    if (!file_exists(NODE_FILE)) return nodes;
    var f = new File(NODE_FILE);
    if (!f.open("r")) return nodes;
    var lines = f.readAll();
    f.close();
    var current = null;
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line[0] == "#") continue;
        
        if (line[0] == "[") {
            // Save previous node if exists
            if (current && current.name && current.address) {
                nodes.push(current);
            }
            current = {};
        } else if (current) {
            var m = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (m) {
                current[m[1]] = m[2].trim();
            }
        }
    }
    
    if (current && current.name && current.address) {
        nodes.push(current);
    }
    
    return nodes;
}

function showMessages() {
    var msgs = readMessages();
    if (!msgs.length) {
        console.print("No messages received.\r\n");
        console.print("Press any key to continue...\r\n");
        console.getkey();
        return;
    }
    
    var currentPage = 0;
    var messagesPerPage = 5;
    var totalPages = Math.ceil(msgs.length / messagesPerPage);
    
    while (bbs.online && !js.terminated) {
        console.clear();
        console.print("\r\n\x01h\x01c--- InterBBS Chess Messages ---\x01n\r\n");
        
        // Display messages for current page
        var startIdx = currentPage * messagesPerPage;
        var endIdx = Math.min(startIdx + messagesPerPage, msgs.length);
        
        for (var i = startIdx; i < endIdx; i++) {
            var m = msgs[i];
            var unread = m.read ? "" : " \x01h\x01r(UNREAD)\x01n";
            console.print(format("\x01h\x01g[%d]%s \x01w\x01hFrom: \x01n%s (\x01h%s\x01n)  Date: %s\r\n", 
                i+1, unread, m.from_bbs, m.from_user||"", m.created));
            console.print(format("\x01h\x01wSubject: \x01n%s\r\n", m.subject));
            console.print(m.body + "\r\n");
            console.print("\x01b--------------------------------------------------\x01n\r\n");
            
            // Mark as read
            msgs[i].read = true;
        }
        
        // Save the read status
        writeMessages(msgs);
        
        // Show navigation instructions
        console.print("\r\n\x01h\x01wPage " + (currentPage + 1) + " of " + totalPages + "\x01n\r\n");
        console.print("\x01h\x01c[N]\x01n Next page  \x01h\x01c[P]\x01n Previous page  \x01h\x01c[#]\x01n Select message  \x01h\x01c[Q]\x01n Quit\r\n");
        console.print("Enter your choice: ");
        
        var input = console.getstr(5).toUpperCase();
        if (input === "Q") {
            return;
        } else if (input === "N") {
            if (currentPage < totalPages - 1) currentPage++;
        } else if (input === "P") {
            if (currentPage > 0) currentPage--;
        } else {
            // Check if it's a number for message selection
            var msgNum = parseInt(input);
            if (!isNaN(msgNum) && msgNum >= 1 && msgNum <= msgs.length) {
                handleMessageActions(msgs, msgNum - 1); // Zero-based index
            }
        }
    }
}

function handleMessageActions(msgs, index) {
    var msg = msgs[index];
    
    while (bbs.online && !js.terminated) {
        console.clear();
        console.print("\r\n\x01h\x01c--- Message Details ---\x01n\r\n\r\n");
        
        console.print(format("\x01h\x01wFrom: \x01n%s (\x01h%s\x01n)\r\n", msg.from_bbs, msg.from_user||""));
        console.print(format("\x01h\x01wDate: \x01n%s\r\n", msg.created));
        console.print(format("\x01h\x01wSubject: \x01n%s\r\n\r\n", msg.subject));
        console.print(msg.body + "\r\n\r\n");
        
        console.print("\x01h\x01c[R]\x01n Reply  \x01h\x01c[D]\x01n Delete  \x01h\x01c[Q]\x01n Back to messages\r\n");
        console.print("Enter your choice: ");
        
        var choice = console.getkey().toUpperCase();
        
        if (choice === "Q") {
            return;
        } else if (choice === "R") {
            replyToMessage(msg);
            return;
        } else if (choice === "D") {
            if (confirmDelete()) {
                // Remove the message
                msgs.splice(index, 1);
                writeMessages(msgs);
                console.print("\r\n\x01h\x01gMessage deleted successfully.\x01n\r\n");
                console.print("Press any key to continue...");
                console.getkey();
                return;
            }
        }
    }
}

function replyToMessage(originalMsg) {
    console.clear();
    console.print("\r\n\x01h\x01c--- Reply to Message ---\x01n\r\n\r\n");
    
    // Determine recipient and destination
    var recipient = originalMsg.from_user || "";
    var destBbs = originalMsg.from_bbs || "";
    var destAddr = originalMsg.from_addr || "";
    
    // Find the node that matches the destination BBS
    var nodes = readNodes();
    var targetNode = null;
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].name === destBbs) {
            targetNode = nodes[i];
            break;
        }
    }
    
    if (!targetNode) {
        console.print("\x01h\x01rCannot determine destination BBS. Reply canceled.\x01n\r\n");
        console.print("Press any key to continue...");
        console.getkey();
        return;
    }
    
    // Create reply subject
    var subject = originalMsg.subject;
    if (subject.indexOf("Re:") !== 0) {
        subject = "Re: " + subject;
    }
    
    console.print("\x01h\x01wTo: \x01n" + recipient + " @ " + destBbs + "\r\n");
    console.print("\x01h\x01wSubject: \x01n" + subject + "\r\n\r\n");
    console.print("Enter your message (end with a single dot '.'): \r\n");
    
    var body = "";
    while (true) {
        var line = console.getstr(80);
        if (line === ".") break;
        body += line + "\r\n";
    }
    
    // Prepare the message packet
    var msg = {
        type: "message",
        bbs: getLocalBBS("name"),
        address: getLocalBBS("address"),
        to_bbs: destBbs,
        to_addr: destAddr,
        to_user: recipient,
        from_user: user.alias,
        subject: subject,
        body: body,
        created: strftime("%Y-%m-%d %H:%M:%S", time())
    };
    
    // Generate unique filename
    var fname = format("chess_messagepacket_%s_%s.json", 
        destAddr.replace(/[:\/]/g,"_"), 
        strftime("%Y%m%d_%H%M%S", time()));
    var path = INTERBBS_OUT_DIR + fname;
    
    // Save the message file
    var f = new File(path);
    if (f.open("w+")) {
        f.write(JSON.stringify(msg, null, 2));
        f.close();
        console.print("\r\n\x01h\x01gMessage sent successfully!\x01n\r\n");
    } else {
        console.print("\r\n\x01h\x01rError saving message file.\x01n\r\n");
    }
    
    console.print("Press any key to continue...");
    console.getkey();
}

function confirmDelete() {
    console.print("\r\n\x01h\x01yAre you sure you want to delete this message? (Y/N): \x01n");
    var confirm = console.getkey().toUpperCase();
    return confirm === "Y";
}

function notifyUnreadMessages() {
    var msgs = readMessages();
    var unread = 0;
    for (var i=0; i<msgs.length; i++)
        if (!msgs[i].read) unread++;
    if (unread)
        console.print("\r\n\x01h\x01cYou have " + unread + " new InterBBS message(s)! Select '7' to read.\x01n\r\n");
}

function writeScoresASC() {
    var scoresObj = chess_readScores();
    var scores = [];
    for (var name in scoresObj) {
        var s = scoresObj[name];
        scores.push({name:name, wins:s.wins, losses:s.losses, draws:s.draws});
    }
    scores.sort(function(a,b){
        if (b.wins != a.wins) return b.wins - a.wins;
        if (b.draws != a.draws) return b.draws - a.draws;
        return a.name.localeCompare(b.name);
    });

    var f = new File(SCORES_ASC);
    if (f.open("w+")) {
        f.writeln("A-Net Synchronet Chess High Scores");
        f.writeln("===============================================");
        f.writeln("User                 Wins   Losses   Draws");
        f.writeln("-----------------------------------------------");
        if (scores.length === 0) {
            f.writeln("Computer (Easy)        5        2       3");
            f.writeln("Computer (Medium)      3        5       2");
            f.writeln("Computer (Hard)        0        8       2");
        } else {
            for (var i=0; i<scores.length; i++) {
                var s = scores[i];
                f.writeln(
                    format("%-20s %5d   %6d   %5d",
                        s.name, s.wins, s.losses, s.draws)
                );
            }
        }
        f.writeln("===============================================");
        f.close();
    }
}

function writeScoresANS() {
    var scoresObj = chess_readScores();
    var scores = [];
    for (var name in scoresObj) {
        var s = scoresObj[name];
        scores.push({name:name, wins:s.wins, losses:s.losses, draws:s.draws});
    }
    scores.sort(function(a,b){
        if (b.wins != a.wins) return b.wins - a.wins;
        if (b.draws != a.draws) return b.draws - a.draws;
        return a.name.localeCompare(b.name);
    });

    var f = new File(SCORES_ANS);
    if (f.open("w+")) {
        f.writeln("\x01c\x01hA-Net Synchronet Chess High Scores\x01n");
        f.writeln("\x01b\x01h===============================================\x01n");
        f.writeln("\x01w\x01hUser                \x01gWins   \x01rLosses   \x01yDraws\x01n");
        f.writeln("\x01b-----------------------------------------------\x01n");
        if (scores.length === 0) {
            f.writeln("\x01wComputer (Easy)      \x01g   5   \x01r     2   \x01y   3\x01n");
            f.writeln("\x01wComputer (Medium)    \x01g   3   \x01r     5   \x01y   2\x01n");
            f.writeln("\x01wComputer (Hard)      \x01g   0   \x01r     8   \x01y   2\x01n");
        } else {
            for (var i=0; i<scores.length; i++) {
                var s = scores[i];
                f.writeln(
                    format("\x01w%-20s \x01g%5d   \x01r%6d   \x01y%5d\x01n",
                        s.name, s.wins, s.losses, s.draws)
                );
            }
        }
        f.writeln("\x01b===============================================\x01n");
        f.close();
    }
}

function updateScoreFiles() {
    writeScoresANS();
    writeScoresASC();
    convertScoresAnsToAnsi();
}
updateScoreFiles();

function ensureSaveDir() {
    if (!file_exists(SAVE_DIR))
        mkdir(SAVE_DIR);
}
function getGameFileName(usernum) {
    return SAVE_DIR + "chess_" + usernum + ".json";
}
function saveGame(usernum, game) {
    ensureSaveDir();
    // Save only serializable state; NEVER expect or use game.board here!
    var obj = {
        mode: game.mode,
        fen: game.fen,              // Already precomputed, not game.board.fen()
        turn: game.turn,
        moves: game.moves,
        white: game.white,
        black: game.black,
        playerColor: game.playerColor, // Only present for vs-computer; harmless for vs-player
        difficulty: game.difficulty || "easy" // Make sure difficulty is always saved
    };
    var fname = getGameFileName(usernum);
    var f = new File(fname);
    if (f.open("w+")) {
        f.write(JSON.stringify(obj));
        f.close();
        return true; // Return success
    }
    return false; // Return failure
}
function loadGame(usernum) {
    var fname = getGameFileName(usernum);
    if (!file_exists(fname)) return null;
    var f = new File(fname);
    if (!f.open("r")) return null;
    var obj = JSON.parse(f.readAll().join(""));
    f.close();
    
    // Ensure difficulty is set for backward compatibility
    if (obj.mode === "computer" && !obj.difficulty) {
        obj.difficulty = "easy"; // Default for old saves
    }
    
    return obj;
}
function deleteGame(usernum) {
    var fname = getGameFileName(usernum);
    if (file_exists(fname)) file_remove(fname);
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
function safeAddScore(username, result, vs) {
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
    try {
        // Only run if in main program, not during includes
        if (typeof(runInterBBSScoreUpdate) === "function") {
            runInterBBSScoreUpdate();
        }
    } catch(e) {
        // Silently ignore if function not available
    }
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
function chess_readScores() {
    if (!file_exists(SCORES_SUMMARY)) return {};
    var f = new File(SCORES_SUMMARY);
    if (!f.open("r")) return {};
    var obj = JSON.parse(f.readAll().join(""));
    f.close();
    return obj;
}
function chess_showScores() {
    updateScoreFiles();
    if (file_exists(SCORES_ANS)) {
        console.printfile(SCORES_ANS);
        console.getkey();
    } else {
        console.print("\r\n[No high scores yet! Press any key]");
        console.getkey();
    }
}
function renderScoresAnsi() {
    updateScoreFiles();
    if (file_exists(SCORES_ANS)) {
        console.printfile(SCORES_ANS);
        return;
    }
    console.print("\r\n[No high scores yet! Press any key]");
    console.getkey();
}
function renderScoresAsc() {
    updateScoreFiles();
    if (file_exists(SCORES_ASC)) {
        console.printfile(SCORES_ASC);
        return;
    }
    console.print("\r\n[No high scores yet! Press any key]");
    console.getkey();
}

function drawChessBoard(chess, turnText, checkText, playerNames, savedMoves) {
    // Ensure savedMoves is always defined
    if (!savedMoves) {
        savedMoves = [];
    }
    
    console.clear();
    console.print("\x01n");

    // Draw the board as before...
    if (file_exists(js.exec_dir + "cboard.ans")) {
        console.gotoxy(1, 1);
        console.printfile(js.exec_dir + "cboard.ans");
    } else {
        console.print("\r\n[Missing cboard.ans ANSI board file!]\r\n");
    }

    // Draw chess pieces on the board - MODIFIED TO SHOW BLACK PIECES IN RED
    for (var r = 0; r < 8; r++) {
        console.gotoxy(startX - 2, startY + r * squareH + centerOffsetY + 2);
        console.print(ranks[r]);
        console.gotoxy(startX + 8 * squareW + 1, startY + r * squareH + centerOffsetY + 2);
        console.print(ranks[r]);
        for (var f = 0; f < 8; f++) {
            var square = files[f] + ranks[r];
            var piece = chess.get(square.toLowerCase());
            var coords = squareCoords[square];
            if (coords && piece) {
                console.gotoxy(coords.x, coords.y + 2);
                var symbol = piece.type.toUpperCase();
                if (piece.color === "b") {
                    // Apply red color to black pieces
                    console.print("\x01r\x01h" + symbol.toLowerCase() + "\x01n");
                } else {
                    // White pieces in bright white
                    console.print("\x01w\x01h" + symbol + "\x01n");
                }
            }
        }
    }

    // --- Player info sidebar ---
    var leftName = "", rightName = "", leftColor = "", rightColor = "";
    if (playerNames) {
        var parts = playerNames.split(" vs ");
        
        // Extract clean player names without color indicators
        leftName = (parts[0] ? String(parts[0]).trim() : "");
        rightName = (parts[1] ? String(parts[1]).trim() : "");
        
        // Remove color indicators from names like "You (White)" -> "You"
        leftName = leftName.replace(/\s*\([Ww]hite\)|\s*\([Bb]lack\)\s*$/, "");
        rightName = rightName.replace(/\s*\([Ww]hite\)|\s*\([Bb]lack\)\s*$/, "");
        
        // Determine colors based on the original names (before we removed the indicators)
        var whiteRE = /\bwhite\b/i, blackRE = /\bblack\b/i;
        if (whiteRE.test(parts[0])) {
            leftColor = "white";
            rightColor = "black";
        } else if (blackRE.test(parts[0])) {
            leftColor = "black";
            rightColor = "white";
        } else {
            leftColor = "white";
            rightColor = "black";
        }
    }
    var infoX = startX + 8 * squareW + 7;
    var infoYBase = startY + 4;
    var namePad = 16;

    var turnName = "";
    if (turnText) {
        if (turnText.indexOf("'s move") !== -1)
            turnName = turnText.split("'s move")[0];
    }

    var y = infoYBase;

    // Left player (top of sidebar)
    if (leftName) {
        console.gotoxy(infoX, y++);
        console.print(padRight(leftName, namePad));
        console.gotoxy(infoX, y++);
        if (leftColor === "white")
            console.print("\x01w(white)\x01n");
        else if (leftColor === "black")
            console.print("\x01k(black)\x01n");
        y++; // blank line after player
    }

    // Right player (below left player)
    if (rightName) {
        console.gotoxy(infoX, y++);
        console.print(padRight(rightName, namePad));
        console.gotoxy(infoX, y++);
        if (rightColor === "white")
            console.print("\x01w(white)\x01n");
        else if (rightColor === "black")
            console.print("\x01k(black)\x01n");
        y++; // blank line after player
    }

    // Game info below
    var capturedWhite = getCapturedPieces(chess, 'w');
    var capturedBlack = getCapturedPieces(chess, 'b');
    var material = getMaterialScore(capturedWhite, capturedBlack);

    console.gotoxy(infoX, y++);
    console.print("\x01yMaterial:\x01n " + material);
    y++; // Add some space before move history

    // **NEW: Move History Display - Suggestion from C64Vette_ski :)**
    console.gotoxy(infoX, y++);
    console.print("\x01cMove History:\x01n");
    
    var moveHistory = getMoveHistoryDisplay(chess, savedMoves);
    if (moveHistory.length > 0) {
        for (var i = 0; i < moveHistory.length; i++) {
            console.gotoxy(infoX, y++);
            console.print("\x01w" + moveHistory[i] + "\x01n");
        }
    } else {
        console.gotoxy(infoX, y++);
        console.print("\x01k(No moves yet)\x01n");
    }

    if (checkText) {
        console.gotoxy(infoX, y++);
        console.print("\x01c\x01h" + checkText + "\x01n");
    }
}

function padRight(str, len) {
    str = str || "";
    if (str.length > len) return str.substr(0, len);
    while (str.length < len) str += " ";
    return str;
}

var PVP_GAMES_FILE = js.exec_dir + "games/pvp_games.json";
function ensureGamesDir() {
    var dir = js.exec_dir + "games";
    if (!file_exists(dir)) mkdir(dir);
}
function ensurePvPGamesFileIsArray() {
    ensureGamesDir();
    if (!file_exists(PVP_GAMES_FILE)) {
        var file = new File(PVP_GAMES_FILE);
        if (file.open("w+")) {
            file.write("[]");
            file.close();
        }
        return;
    }
    var file = new File(PVP_GAMES_FILE);
    if (!file.open("r+")) return;
    var data;
    try { data = JSON.parse(file.readAll().join("")); } catch (e) { data = []; }
    if (!Array.isArray(data)) {
        file.rewind();
        file.truncate();
        file.write(JSON.stringify([], null, 2));
    }
    file.close();
}
ensurePvPGamesFileIsArray();
ensureComputerGamesFileIsArray();

function getAllPvPGames() {
    ensurePvPGamesFileIsArray();
    var file = new File(PVP_GAMES_FILE);
    if (!file.open("r")) return [];
    var games;
    try {
        var raw = file.readAll().join("");
        games = JSON.parse(raw);
        if (!Array.isArray(games)) games = [];
    } catch (e) {
        games = [];
    } finally { file.close(); }
    return games;
}

function saveAllPvPGames(games) {
    ensureGamesDir();
    if (!Array.isArray(games)) games = [];
    var file = new File(PVP_GAMES_FILE);
    if (file.open("w")) {
        file.write(JSON.stringify(games, null, 2));
        file.close();
    }
}

function arrayFindIndex(arr, predicate) {
    if (!Array.isArray(arr)) return -1;
    for (var i = 0; i < arr.length; i++) {
        if (predicate(arr[i], i, arr)) return i;
    }
    return -1;
}

function savePvPGame(game) {
    var games = getAllPvPGames();
    if (!Array.isArray(games)) games = [];
    var idx = arrayFindIndex(games, function(g) { return g.id === game.id; });
    var saveGame = {
        id: game.id,
        mode: game.mode,
        fen: game.fen,
        turn: game.turn,
        moves: game.moves,
        white: game.white,
        black: game.black,
        realTime: !!game.realTime,
        finished: !!game.finished
    };
    if (idx >= 0) games[idx] = saveGame;
    else games.push(saveGame);
    saveAllPvPGames(games);
}

function getUserPvPGames(username) {
    var games = getAllPvPGames();
    if (!Array.isArray(games)) games = [];
    return games.filter(function(g) {
        return (g.white === username || g.black === username) && !g.finished;
    });
}

function getPvPGameById(id) {
    var games = getAllPvPGames();
    if (!Array.isArray(games)) games = [];
    // Use a for-loop for robust matching even if games is not a native array
    for (var i = 0; i < games.length; i++) {
        var g = games[i];
        if (typeof g.id === "string" && typeof id === "string" && g.id.trim() === id.trim()) {
            return g;
        }
    }
    return undefined;
}

function deletePvPGame(id) {
    var games = getAllPvPGames();
    if (!Array.isArray(games)) games = [];
    games = games.filter(function(g) { return g.id !== id; });
    saveAllPvPGames(games);
}

function generatePvPGameId(white, black) {
    return white + "_vs_" + black + "_" + (new Date().getTime());
}
// --- END: PvP Game file helpers ---

// === MENU AND UI HELPERS ===

function showScrollerMenu(items, title, getDisplayText) {
    var WIDTH = 60, HEIGHT = Math.min(20, console.screen_rows-6);
    var menu = new DDLightbarMenu(4, 6, WIDTH, HEIGHT);
    for (var i = 0; i < items.length; i++) {
        menu.Add(getDisplayText(items[i], i), i.toString());
    }
    menu.colors.itemColor = "\x01k\x01h";
    menu.colors.selectedItemColor = "\x01g\x01h";
    menu.colors.borderColor = "\x01g";
    menu.colors.scrollbarBGColor = "\x01g";
    menu.colors.scrollbarFGColor = "\x01w";
    menu.borderEnabled = true;
    menu.scrollbarEnabled = true;
    menu.AddAdditionalQuitKeys("qQ\x1b");
    console.clear();
    if (title) {
        console.gotoxy(4, 4);
        console.print("\x01w\x01h" + title + "\x01n");
    }
    var selected = menu.GetVal();
    if (typeof selected !== "string") return null;
    var idx = parseInt(selected, 10);
    if (isNaN(idx) || idx < 0 || idx >= items.length) return null;
    return items[idx];
}

// === CHESS GAME MENU AND LOGIC ===

function chess_menu() {
    load("sbbsdefs.js");
    require("dd_lightbar_menu.js", "DDLightbarMenu");

    var WIDTH = console.screen_columns;
    var HEIGHT = console.screen_rows;

    function showIntroScreen() {
        var introFile = js.exec_dir + "achess.ans";
        if (file_exists(introFile)) {
            console.clear();
            console.printfile(introFile);
            console.print("\r\n\x01w\x01hPress any key to continue...\x01n\r\n");
            console.getkey();
        }
    }

    function repeatSpace(n) {
        var s = "";
        while (n-- > 0) s += " ";
        return s;
    }

    function padMenuText(text, width) {
        var stripped = text.replace(/\x01.\x01./g, '').replace(/\x01./g, '');
        var padLength = width - stripped.length;
        return text + (padLength > 0 ? repeatSpace(padLength) : '');
    }

    function showHeader() {
        console.gotoxy(1, 2);
        console.print("\x01w\x01h   A-NET Synchronet Chess v.21\r\n\r\n");
        console.print("\x01w    Logged in as: " + user.alias + " (user #" + user.number + ")\r\n\r\n");
    }

    function showStatusMessage(message) {
        console.clear();
        showHeader();
        console.print("\x01r\x01h" + message + "\x01n\r\n\r\n");
        console.print("Press any key to return to the menu...\r\n");
        console.getkey();
    }

    function showBoard(chess, playerNames, turnText, checkText) {
        drawChessBoard(chess, turnText, checkText, playerNames);
    }

    // --- PvP Start/Resume/Join ---
    function startNewPvPGame() {
        var localPlayers = getLocalPlayerList();
        if (!localPlayers.length) {
            showStatusMessage("No other local players found. Try playing against the Computer!");
            return;
        }
        var opp = selectLocalOpponent(localPlayers);
        if (!opp) {
            showStatusMessage("No opponent selected. Returning to menu.");
            return;
        }
        var playerWhite = user.alias;
        var playerBlack = opp.alias;

        // --- Prepare invitation message ---
        var gameID = generatePvPGameId(playerWhite, playerBlack);
        var subj = "Chess Game Invitation from " + playerWhite;
        var body = 
            "Hi " + opp.alias + ",\r\n\r\n" +
            playerWhite + " has invited you to a Chess match on this BBS!\r\n" +
            "Game ID: " + gameID + "\r\n" +
            "To join or resume the match, go to the Chess door\r\n" +
            "and select 'Join/Resume Ongoing Match'.\r\n\r\n" +
            "Good luck!\r\n\r\n" +
            "(This is an automated message.)";

        // --- Send Achess notification instead of BBS email ---
        sendAchessNotification(opp.alias, subj, body);

        // --- Now clear the screen and display the confirmation! ---
        console.clear();
        showHeader(); // Optional: if you want the header
        console.print("\r\nChess invitation sent to " + opp.alias + " via Achess notification.\r\n");

        // --- Ask if player wants to play real-time or take turns ---
        console.print("\r\nPlay real-time (Y) or take turns (N)? [N]: ");
        var resp = console.getkey().toUpperCase();
        var realTime = (resp === "Y");

        var board = getNewBoard();
        var game = {
            id: gameID,
            mode: "player",
            fen: board.fen(),
            turn: "white",
            moves: [],
            white: playerWhite,
            black: playerBlack,
            realTime: realTime,
            finished: false
        };

        savePvPGame(game);
        playVsPlayer(true, game);
    }

    function joinOrResumePvPMatch() {
        var games = getUserPvPGames(user.alias);
        if (!games.length) {
            showStatusMessage("You have no ongoing matches.");
            return;
        }
        var chosen = showScrollerMenu(games, "Select a Match to Join/Resume", function(g, i) {
            var opp = (g.white === user.alias) ? g.black : g.white;
            return format("[%d] %s vs %s | %s | Turn: %s", i+1, g.white, g.black, g.realTime ? "Real-Time " : "Take-Turns", (g.turn === "white" ? g.white : g.black));
        });
        if (!chosen) return;
        playVsPlayer(true, chosen);
    }

// Helper for sleep in ms for polling loop
function sleepMS(ms) {
    var end = (new Date()).getTime() + ms;
    while ((new Date()).getTime() < end && bbs.online && !js.terminated)
        mswait(50);
}

// === PvP Play Function (real-time aware) ===
function playVsPlayer(resume, saveObj) {
    var game;
    var playerWhite, playerBlack, realTime;
    var savedMoves = [];
    
    if (resume && saveObj) {
        if (!saveObj.fen) {
            showStatusMessage("This saved game is from an old version and cannot be loaded.");
            return;
        }
        
        // IMPORTANT: Replay moves to restore chess.history() functionality
        var chess = new Chess();
        if (saveObj.moves && saveObj.moves.length > 0) {
            for (var i = 0; i < saveObj.moves.length; i++) {
                try {
                    chess.move(saveObj.moves[i]);
                } catch(e) {
                    // If replay fails, fall back to FEN position
                    chess = new Chess(saveObj.fen);
                    break;
                }
            }
            // Validate that replay worked correctly
            if (chess.history().length !== saveObj.moves.length) {
                chess = new Chess(saveObj.fen);
            }
        } else {
            chess = new Chess(saveObj.fen);
        }
        
        game = {
            id: saveObj.id,
            mode: saveObj.mode,
            board: chess,
            fen: saveObj.fen,
            turn: saveObj.turn,
            moves: saveObj.moves || [],
            white: saveObj.white,
            black: saveObj.black,
            realTime: !!saveObj.realTime,
            finished: !!saveObj.finished
        };
        playerWhite = game.white;
        playerBlack = game.black;
        realTime = game.realTime;
        savedMoves = game.moves || [];
    } else {
        showStatusMessage("Error: New PvP games should be started via startNewPvPGame.");
        return;
    }

    var files = "ABCDEFGH";
    var ranks = "12345678";
    var done = false;
    
    while (!done && bbs.online && !js.terminated) {
        // Always update savedMoves from current chess state
        if (game.board.history) {
            savedMoves = game.board.history();
        }
        
        var playerNames = playerWhite + " vs " + playerBlack;
        var turnText = (game.turn === "white" ? playerWhite : playerBlack) + "'s move (" + game.turn + ")";
        var checkText = "";
        if (game.board.in_check && game.board.in_check()) checkText = "Check!";

        showBoard(game.board, playerNames, turnText, checkText, savedMoves);

        var myAlias = user.alias;
        var myColor = (playerWhite === myAlias) ? "white" : "black";
        if (game.turn !== myColor) {
            if (realTime) {
                // Poll for opponent's move
                var waitMsg = "Waiting for " + (game.turn === "white" ? playerWhite : playerBlack) + " to move...";
                var promptY = 23;
                
                while (bbs.online && !js.terminated) {
                    console.gotoxy(1, promptY - 1);
                    console.cleartoeol();
                    console.gotoxy(1, promptY);
                    console.cleartoeol();
                    console.print(waitMsg + " (Q to quit)");
                    
                    var key;
                    for (var t = 0; t < 20; t++) {
                        key = console.inkey(0.1);
                        if (key && key.toUpperCase() === "Q") {
                            showStatusMessage("You exited the real-time game. You can resume from the menu.");
                            return;
                        }
                        sleepMS(100);
                    }
                    var updated = getPvPGameById(game.id);
                    if (!updated || updated.finished) {
                        showStatusMessage("Game ended or deleted.");
                        return;
                    }
                    if (updated.turn === myColor || updated.finished) {
                        // Rebuild chess instance with move history
                        var newChess = new Chess();
                        if (updated.moves && updated.moves.length > 0) {
                            for (var i = 0; i < updated.moves.length; i++) {
                                try {
                                    newChess.move(updated.moves[i]);
                                } catch(e) {
                                    newChess = new Chess(updated.fen);
                                    break;
                                }
                            }
                        } else {
                            newChess = new Chess(updated.fen);
                        }
                        
                        game = {
                            id: updated.id,
                            mode: updated.mode,
                            board: newChess,
                            fen: updated.fen,
                            turn: updated.turn,
                            moves: updated.moves || [],
                            white: updated.white,
                            black: updated.black,
                            realTime: !!updated.realTime,
                            finished: !!updated.finished
                        };
                        savedMoves = game.moves || [];
                        break;
                    }
                }
                continue;
            } else {
                var waitMsg = "It's not your turn in this game.";
                var promptY = 23;
                
                while (bbs.online && !js.terminated) {
                    console.gotoxy(1, promptY - 1);
                    console.cleartoeol();
                    console.gotoxy(1, promptY);
                    console.cleartoeol();
                    console.print(waitMsg + " (Q to quit)");
                    
                    var key = console.inkey(0.1);
                    if (key && key.toUpperCase() === "Q") {
                        showStatusMessage("You exited the game. You can resume from the menu.");
                        return;
                    }
                    sleepMS(1000);
                    var updated = getPvPGameById(game.id);
                    if (!updated || updated.finished) {
                        showStatusMessage("Game ended or deleted.");
                        return;
                    }
                    if (updated.turn === myColor || updated.finished) {
                        // Rebuild chess instance with move history
                        var newChess = new Chess();
                        if (updated.moves && updated.moves.length > 0) {
                            for (var i = 0; i < updated.moves.length; i++) {
                                try {
                                    newChess.move(updated.moves[i]);
                                } catch(e) {
                                    newChess = new Chess(updated.fen);
                                    break;
                                }
                            }
                        } else {
                            newChess = new Chess(updated.fen);
                        }
                        
                        game = {
                            id: updated.id,
                            mode: updated.mode,
                            board: newChess,
                            fen: updated.fen,
                            turn: updated.turn,
                            moves: updated.moves || [],
                            white: updated.white,
                            black: updated.black,
                            realTime: !!updated.realTime,
                            finished: !!updated.finished
                        };
                        savedMoves = game.moves || [];
                        break;
                    }
                }
                continue;
            }
        }

        var promptY = 23; 
        var moveLine = turnText; 
        console.gotoxy(1, promptY-1);
        console.cleartoeol();
        console.print("\x01w\x01h" + moveLine + "\x01n");
        console.gotoxy(1, promptY);
        console.cleartoeol();
        console.print("\x01w\x01hEnter move (e.g. E2E4, Nf3, Q=quit, S=save): \x01n");
        var move = console.getstr(8);
        if (!move) continue;
        if (move.toUpperCase() === "Q" || move.toUpperCase() === "S") {
            showStatusMessage("Game saved. You can resume from the menu.");
            game.fen = game.board.fen();
            game.moves = game.board.history ? game.board.history() : savedMoves;
            savePvPGame(game);
            return;
        }

        var moveObj = null;
        if (
            move.length === 4 &&
            files.indexOf(move[0].toUpperCase()) >= 0 &&
            ranks.indexOf(move[1]) >= 0 &&
            files.indexOf(move[2].toUpperCase()) >= 0 &&
            ranks.indexOf(move[3]) >= 0
        ) {
            moveObj = game.board.move({
                from: move.substr(0,2).toLowerCase(),
                to: move.substr(2,2).toLowerCase(),
                promotion: "q"
            });
        } else {
            moveObj = game.board.move(move, { sloppy: true });
        }

        if (!moveObj) {
            showStatusMessage("Invalid move. Try again.");
            continue;
        }

        game.moves = game.board.history ? game.board.history() : [];
        savedMoves = game.moves;
        game.fen = game.board.fen();

        if (game.board.game_over && game.board.game_over()) {
            showBoard(game.board, playerNames, turnText, checkText, savedMoves);
            
            console.gotoxy(11, 20);
            console.print("\x01h\x01w" + repeatChar("-", 40) + "\x01n");
            console.gotoxy(11, 21);
            
            var gameResult = "";
            var victoryMessage = "";
            
            if (game.board.in_checkmate && game.board.in_checkmate()) {
                var loserColor = game.board.turn();
                var winnerColor = (loserColor === "w") ? "b" : "w";
                var winnerName = (winnerColor === "w") ? game.white : game.black;
                var loserName = (loserColor === "w") ? game.white : game.black;
                
                if (winnerName === user.alias) {
                    gameResult = "\x01h\x01g*** VICTORY! ***\x01n";
                    victoryMessage = "\x01h\x01gCongratulations! You defeated " + loserName + "!\x01n";
                } else {
                    gameResult = "\x01h\x01r*** DEFEAT! ***\x01n";
                    victoryMessage = "\x01h\x01rYou have been defeated by " + winnerName + ".\x01n";
                }
                
                safeAddScore(winnerName, "Win", loserName);
                safeAddScore(loserName, "Loss", winnerName);
            } else if (
                (game.board.in_draw && game.board.in_draw()) ||
                (game.board.in_stalemate && game.board.in_stalemate())
            ) {
                gameResult = "\x01h\x01y*** DRAW! ***\x01n";
                victoryMessage = "\x01h\x01yThe game ended in a draw between you and your opponent.\x01n";
                
                safeAddScore(game.white, "Draw", game.black);
                safeAddScore(game.black, "Draw", game.white);
            }
            
            var padLen = Math.floor((40 - gameResult.replace(/\x01./g, "").length) / 2);
            console.print(repeatChar(" ", padLen) + gameResult);
            
            console.gotoxy(11, 22);
            console.print(victoryMessage);
            
            console.gotoxy(11, 23);
            console.print("\x01h\x01w" + repeatChar("-", 40) + "\x01n");
            
            game.finished = true;
            savePvPGame(game);
            deletePvPGame(game.id);
            
            console.gotoxy(11, 25);
            console.print("\x01h\x01cPress any key to return to the menu...\x01n");
            console.getkey();
            done = true;
        } else {
            game.turn = (game.turn === "white") ? "black" : "white";
            savePvPGame(game);
        }
    }
}

function showBoard(chess, playerNames, turnText, checkText, savedMoves) {
    drawChessBoard(chess, turnText, checkText, playerNames, savedMoves);
}

    // --- MAIN MENU ---
    showIntroScreen();

    // Menu items based on InterBBS availability
    var menu_items = [
        "\x01hNew Game vs Computer",
        "\x01hNew Game vs Player",
        "\x01hJoin/Resume Ongoing Match", 
        "\x01hLoad Saved Game",
        "\x01hView High Scores",
        "\x01hRead Notifications"
    ];

    // Add InterBBS options only if enabled
    if (isInterBBSEnabled()) {
        menu_items.push("\x01hRead InterBBS Messages");
        menu_items.push("\x01hSend InterBBS Message");
        menu_items.push("\x01hChallenge Remote Player (InterBBS)");
        menu_items.push("\x01hView/Move in My InterBBS Games");
    }

    menu_items.push("\x01hQuit");

    var menu_width = 44;
    var menu_x = 2;
    var menu_y = 7;
    var max_height = HEIGHT - menu_y - 2;
    var menu_height = Math.min(menu_items.length + 2, max_height);

    function formatAlertLine(text, width) {
        var clean = text.replace(/\x01.\x01./g, '').replace(/\x01./g, '');
        if (clean.length > width) {
            clean = clean.substring(0, width - 3) + "...";
        }
        return clean + repeatSpace(width - clean.length);
    }

    var running = true;
    var lastRefresh = time();
    while (bbs.online && running && !js.terminated) {
        console.clear();
        showHeader();

        var unreadNotes = getMyUnreadAchessNotifications();
        if (unreadNotes.length) {
            var alertLine = formatAlertLine(
                "You have " + unreadNotes.length + " new notification(s)!",
                menu_width - 4
            );
            
            var flashChar = (Math.floor(time() * 2) % 2 === 0) ? "\x01r\x01h*\x01n" : "\x01r*\x01n";
            
            console.print("\x01h\x01c" + alertLine + " " + flashChar + flashChar + "\x01n\r\n");
        } else {
            console.print(repeatSpace(menu_width) + "\r\n");
        }

        var menu = new DDLightbarMenu(menu_x, menu_y, menu_width + 4, menu_height);

        for (var i = 0; i < menu_items.length; i++) {
            menu.Add(padMenuText(menu_items[i], menu_width), i.toString());
        }
        menu.colors.itemColor = "\x01k\x01h";
        menu.colors.selectedItemColor = "\x01g\x01h";
        menu.colors.borderColor = "\x01g";
        menu.colors.scrollbarBGColor = "\x01g";
        menu.colors.scrollbarFGColor = "\x01w";
        menu.borderEnabled = true;
        menu.scrollbarEnabled = true;
        menu.AddAdditionalQuitKeys("qQ\x1b");

        var selected = menu.GetVal(true, 1000);
        
        if (typeof selected !== "string") {
            var currentTime = time();
            if (currentTime - lastRefresh < 2) {
                running = false;
                continue;
            } else {
                lastRefresh = currentTime;
                continue;
            }
        }

        lastRefresh = time();

        // Create menu actions based on current menu structure
        var menuActions = [
            "computer",     // 0 - New Game vs Computer
            "player",       // 1 - New Game vs Player  
            "join",         // 2 - Join/Resume Ongoing Match
            "load",         // 3 - Load Saved Game
            "scores",       // 4 - View High Scores
            "notifications" // 5 - Read Notifications
        ];

        // Add InterBBS actions only if enabled (must match menu_items order)
        if (isInterBBSEnabled()) {
            menuActions.push("ibbs_messages");    // 6 - Read InterBBS Messages
            menuActions.push("ibbs_send");        // 7 - Send InterBBS Message  
            menuActions.push("ibbs_challenge");   // 8 - Challenge Remote Player
            menuActions.push("ibbs_games");       // 9 - View/Move in My InterBBS Games
        }

        menuActions.push("quit");  // Last item - Quit

        // Handle menu selection using the selected value from menu.GetVal()
        var selectedIndex = parseInt(selected);
        if (selectedIndex >= 0 && selectedIndex < menuActions.length) {
            var action = menuActions[selectedIndex];
            
            switch(action) {
                case "computer":
                    console.clear();
                    showHeader();
                    deleteGame(user.number);
                    playVsComputer(false, null);
                    break;
                case "player":
                    console.clear();
                    showHeader();
                    startNewPvPGame();
                    break;
                case "join":
                    console.clear(); 
                    showHeader();
                    joinOrResumePvPMatch();
                    break;
                case "load":
                    console.clear();
                    showHeader();
                    
                    var computerGames = getUserComputerGames(user.number);
                    var pvpGames = getUserPvPGames(user.alias);
                    
                    // Also check for legacy single-save
                    var legacySave = loadGame(user.number);
                    if (legacySave) {
                        // Convert legacy save to new format if needed
                        legacySave.id = "legacy_" + user.number + "_" + (new Date().getTime());
                        saveComputerGame(legacySave);
                        deleteGame(user.number);
                        computerGames = getUserComputerGames(user.number); // Refresh the list
                    }
                    
                    // Combine all games for display
                    var allGames = [];
                    for (var i = 0; i < computerGames.length; i++) {
                        allGames.push({
                            type: "computer",
                            game: computerGames[i]
                        });
                    }
                    for (var i = 0; i < pvpGames.length; i++) {
                        allGames.push({
                            type: "pvp",
                            game: pvpGames[i]
                        });
                    }
                    
                    if (allGames.length === 0) {
                        showStatusMessage("No saved games found.");
                        break;
                    }
                    
                    // Sort games by timestamp if available
                    allGames.sort(function(a, b) {
                        var timeA = a.game.timestamp || 0;
                        var timeB = b.game.timestamp || 0;
                        return timeB - timeA; // Newest first
                    });
                    
                    // Show games with load/delete options
                    while (true) {
                        var chosen = showScrollerMenu(allGames, "Select a Saved Game (L=Load, D=Delete, Q=Quit)", function(item, i) {
                            var g = item.game;
                            var gameType = "";
                            
                            if (item.type === "computer") {
                                var diffText = g.difficulty ? g.difficulty.charAt(0).toUpperCase() + g.difficulty.slice(1) : "Easy";
                                gameType = "vs Computer (" + diffText + ")";
                            } else {
                                gameType = g.white + " vs " + g.black;
                            }
                            
                            var datePart = "";
                            if (g.timestamp) {
                                var d = new Date(g.timestamp);
                                datePart = " | " + d.toLocaleDateString() + " " + d.toLocaleTimeString();
                            }
                            
                            return format("[%d] %s%s", i + 1, gameType, datePart);
                        });
                        
                        if (!chosen) break; // User quit
                        
                        // Ask what to do with selected game
                        console.clear();
                        showHeader();
                        
                        var g = chosen.game;
                        var gameType = "";
                        if (chosen.type === "computer") {
                            var diffText = g.difficulty ? g.difficulty.charAt(0).toUpperCase() + g.difficulty.slice(1) : "Easy";
                            gameType = "vs Computer (" + diffText + ")";
                        } else {
                            gameType = g.white + " vs " + g.black;
                        }
                        
                        console.print("\r\n\x01h\x01cSelected Game: \x01w" + gameType + "\x01n\r\n");
                        if (g.timestamp) {
                            var d = new Date(g.timestamp);
                            console.print("\x01cSaved: \x01w" + d.toLocaleDateString() + " " + d.toLocaleTimeString() + "\x01n\r\n");
                        }
                        
                        console.print("\r\n\x01h\x01g[L]\x01n Load Game");
                        console.print("  \x01h\x01r[D]\x01n Delete Game");
                        console.print("  \x01h\x01c[B]\x01n Back to List");
                        console.print("  \x01h\x01w[Q]\x01n Quit\r\n\r\n");
                        console.print("Choose an option: ");
                        
                        var action = console.getkey().toUpperCase();
                        
                        if (action === "Q") {
                            break; // Exit to main menu
                        } else if (action === "B") {
                            continue; // Back to game list
                        } else if (action === "D") {
                            // Confirm deletion
                            console.print("\r\n\r\n\x01h\x01rAre you sure you want to delete this saved game? (Y/N): \x01n");
                            var confirm = console.getkey().toUpperCase();
                            
                            if (confirm === "Y") {
                                // Delete the game
                                if (chosen.type === "computer") {
                                    deleteComputerGame(g.id);
                                } else {
                                    deletePvPGame(g.id);
                                }
                                
                                // Remove from our local array
                                for (var i = 0; i < allGames.length; i++) {
                                    if (allGames[i].game.id === g.id) {
                                        allGames.splice(i, 1);
                                        break;
                                    }
                                }
                                
                                console.print("\r\n\x01h\x01gGame deleted successfully!\x01n");
                                console.print("\r\nPress any key to continue...");
                                console.getkey();
                                
                                // If no games left, exit
                                if (allGames.length === 0) {
                                    showStatusMessage("No more saved games.");
                                    break;
                                }
                                continue; // Back to game list
                            } else {
                                console.print("\r\n\x01cDeletion cancelled.\x01n");
                                console.print("\r\nPress any key to continue...");
                                console.getkey();
                                continue; // Back to action menu for same game
                            }
                        } else if (action === "L") {
                            // Load the game - Pass raw saved game data
                            var selectedGame = chosen.game;
                            if (!selectedGame || !selectedGame.fen) {
                                showStatusMessage("This saved game cannot be loaded.");
                                break;
                            }
                            
                            console.clear();
                            showHeader();
                            
                            if (chosen.type === "computer") {
                                playVsComputer(true, selectedGame);
                            } else {
                                playVsPlayer(true, selectedGame);
                            }
                            break; // Exit after playing
                        }
                    }
                    break;
                case "scores":
                    console.clear();
                    showHeader();
                    renderScoresAnsi();
                    console.print("\r\nPress any key to return to the menu...\r\n");
                    console.getkey();
                    break;
                case "notifications":
                    console.clear();
                    showHeader();
                    showAchessNotificationsInteractive();
                    break;
                case "ibbs_messages":
                    console.clear();
                    showHeader();
                    showMessages();
                    break;
                case "ibbs_send":
                    console.clear();
                    showHeader();
                    sendInterBBSMessage();
                    break;
                case "ibbs_challenge":
                    console.clear();
                    showHeader();
                    interbbsChallenge();
                    break;
                case "ibbs_games":
                    console.clear();
                    showHeader();
                    interbbsListGamesAndMove();
                    break;
                case "quit":
                    running = false;
                    break;
            }
        }
    }
}

function readRegKey(filePath) {
    if (!file_exists(filePath)) return {};
    var reg = {};
    var f = new File(filePath);
    if (f.open('r')) {
        var lines = f.readAll();
        f.close();
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/^\s+|\s+$/g, ''); 
            if (line === '' || line[0] === ';' || line[0] === '#') continue; 
            var m = line.match(/^(\w+)\s*=\s*(.+)$/);
            if (m) reg[m[1]] = m[2];
        }
    }
    return reg;
}

function showSignoff() {
    console.clear();
    console.print("\r\n");
    console.print("\x01n\x01w\x01h    Thanks for playing  - \x01r\x01h A-Net Synchronet Chess!\r\n");
    console.print("\x01g\x01h\r\n\x01n");
    console.print("\x01g     Brought to you by: \x01rSting\x01bRay\x01n - \x01hA-Net Online BBS\x01n\r\n");
    console.print("\x01g\x01h\r\n\x01n");
    console.print("\x01g\x01h\r\n\x01n");
    console.print("\x01g\x01h\r\n\x01n");
    console.print("\x01n\x01w\x01h                  Shout out to Cozmo!\r\n\x01n");
    console.print("\x01g     Ansi Artwork By; Cozmo of Lunatics Unleashed BBS\x01h\r\n\x01n");
    console.print("\x01g\x01h         Telnet:lunaticsunleashed.ddns.net:2333\r\n\x01n");

    var reg = readRegKey(js.exec_dir + "reg.key");
    if (reg.BBS || reg.Sysop) {
        console.print("\r\n\r\n");
        console.print("\x01c\x01hNow returning you to:\x01n\r\n");
        console.print("\x01c\x01h\x01n\r\n");
        if (reg.BBS)
            console.print("\x01g\x01hBBS:\x01w " + reg.BBS + "\x01n\r\n");
        if (reg.Sysop)
            console.print("\x01g\x01hSysop:\x01w " + reg.Sysop + "\x01n\r\n");
        console.print("\r\n");
    }

    console.print("\x01w\x01hPress any key to continue...\x01n\r\n");
    console.getkey();
}

chess_menu();
showSignoff();
