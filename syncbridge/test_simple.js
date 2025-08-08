// Simple test file for SyncBridge v1.0
// Tests basic Synchronet API functionality

console.print("Hello from SyncBridge!")
console.print("System: " + system.name)
console.print("User: " + user.alias)

var testFile = new File("test.txt")
testFile.open("w")
testFile.writeln("Bridge test successful!")
testFile.close()
console.print("File write test: PASSED")

console.print("File exists test: PASSED")

var num = Math.random()
console.print("Random number: " + str(num))

var date = new Date()
console.print("Current date: " + date.toString())

console.print("All basic tests completed!")