var ACHESS_NOTIFY_FILE = js.exec_dir + "achess_notify.json";
function cleanupNotifications() {
    if (!file_exists(ACHESS_NOTIFY_FILE)) return;
    var file = new File(ACHESS_NOTIFY_FILE);
    if (!file.open("r+")) return;
    var arr = [];
    try { arr = JSON.parse(file.readAll().join("")); } catch(e) {}
    arr = arr.filter(function(n) {
        return typeof n.to === "string";
    });
    file.rewind();
    file.truncate();
    file.write(JSON.stringify(arr, null, 2));
    file.close();
    print("Cleaned up achess_notify.json!");
}
cleanupNotifications();