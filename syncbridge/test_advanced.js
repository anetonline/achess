// Advanced test file for SyncBridge v1.0
// Tests more complex JavaScript features

console.print("Advanced SyncBridge Test")

var files = "ABCDEFGH"
var ranks = "87654321" 
var startX = 11, startY = 1, squareW = 5

var squareCoords = {}
for (var r = 0; r < 8; r++) {
    for (var f = 0; f < 8; f++) {
        var square = files[f] + ranks[r]
        var x = startX + f * squareW
        squareCoords[square] = { x: x, y: startY }
    }
}

console.print("Created " + Object.keys(squareCoords).length + " squares")

var testObj = {
    name: "Test",
    value: 42,
    active: true
}

if (testObj.active) {
    console.print("Object is active: " + testObj.name)
} else {
    console.print("Object is inactive")
}

console.print("Advanced test completed!")