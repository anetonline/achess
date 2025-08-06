// Synchronet BBS color code to ANSI color code converter

// Mapping Synchronet codes to ANSI
var SBBS_TO_ANSI = {
    n: "\x1b[0m",    // Normal/reset
    h: "\x1b[1m",    // High intensity (bold)
    b: "\x1b[34m",   // Blue
    c: "\x1b[36m",   // Cyan
    g: "\x1b[32m",   // Green
    r: "\x1b[31m",   // Red
    w: "\x1b[37m",   // White
    y: "\x1b[33m",   // Yellow
    // Add more colors if needed
};

function convertSyncAnsi(text) {

    return text.replace(/(?:\x01|\u263A)([a-z])/g, function(match, code) {
        return SBBS_TO_ANSI[code] || '';
    });
}

function main() {

    if (argc < 2) {
        print("Usage: jsexec syncansi.js inputfile [outputfile]");
        exit(1);
    }
    var infile = argv[1];
    var outfile = argc > 2 ? argv[2] : null;

    var file = new File(infile);
    if (!file.open("r")) {
        print("Could not open " + infile);
        exit(1);
    }
    var text = file.readAll().join('\n');
    file.close();

    var converted = convertSyncAnsi(text);

    if (outfile) {
        var outf = new File(outfile);
        if (!outf.open("w")) {
            print("Could not open " + outfile + " for writing.");
            exit(1);
        }
        outf.write(converted);
        outf.close();
    } else {
        print(converted);
    }
}

main();
