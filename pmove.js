// pmove.js - Packet mover for Synchronet A-Chess InterBBS packets
// Usage: jsexec pmove.js outbound /path/to/targetdir
//        jsexec pmove.js inbound  /path/to/targetdir

var OUTBOUND_DIR = "/sbbs/xtrn/achess/outbound/";
var INBOUND_DIR  = "/sbbs/xtrn/achess/inbound/";

if (argc < 3) {
    print("Usage: jsexec pmove.js outbound|inbound /path/to/targetdir\r\n");
    exit(1);
}

var direction = argv[1].toLowerCase();
var targetDir = argv[2];

// Ensure targetDir ends with /
if (targetDir.substr(-1) !== "/" && targetDir.substr(-1) !== "\\")
    targetDir += "/";

var sourceDir;
if (direction === "outbound") {
    sourceDir = OUTBOUND_DIR;
} else if (direction === "inbound") {
    sourceDir = INBOUND_DIR;
} else {
    print("First argument must be 'outbound' or 'inbound'.\r\n");
    exit(1);
}

// Get list of files to move
var files = directory(sourceDir + "*");
if (!files.length) {
    print("No files found in " + sourceDir + "\r\n");
    exit(0);
}

// Make sure target directory exists
if (!file_exists(targetDir)) {
    if (!mkdir(targetDir)) {
        print("Could not create target directory: " + targetDir + "\r\n");
        exit(1);
    }
}

var moved = 0, failed = 0;
for (var i = 0; i < files.length; i++) {
    var fname = files[i].split('/').pop();
    var dest = targetDir + fname;
    if (file_copy(files[i], dest)) {
        if (file_remove(files[i])) {
            print("Moved: " + fname + " -> " + dest + "\r\n");
            moved++;
        } else {
            print("Copied but could not delete: " + fname + "\r\n");
            failed++;
        }
    } else {
        print("Failed to copy: " + fname + "\r\n");
        failed++;
    }
}

print("Done. " + moved + " file(s) moved, " + failed + " file(s) failed.\r\n");