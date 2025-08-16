// Chess Score Update Wrapper
// This script safely handles score updates without Windows errors

try {
    // Check if we're in a proper Synchronet environment
    if (typeof(load) === 'function' && typeof(js) !== 'undefined') {
        // We're in Synchronet - run the proper update
        load(js.exec_dir + "achess_ibbs.js");
        if (typeof(argv) !== 'undefined' && argv.length > 0) {
            print("Running with command: " + argv[0]);
        }
    } else {
        // We're not in Synchronet - this script was likely called directly from Windows
        print("This script must be run within the Synchronet JavaScript environment.");
    }
} catch(e) {
    // Log error but don't let it crash anything
    if (typeof(log) === 'function') {
        log("ERROR: " + e.toString());
    }
}