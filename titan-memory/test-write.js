import { promises as fs } from "fs"
import path from "path"

async function testWrite() {
	try {
		const dirPath = "data/memories"
		const filePath = path.join(dirPath, "test.json")
		const content = JSON.stringify({ test: "data" }, null, 2)

		console.log("Current working directory:", process.cwd())
		console.log("Writing to:", filePath)

		// Ensure directory exists
		await fs.mkdir(dirPath, { recursive: true })

		// Check directory permissions
		const dirStats = await fs.stat(dirPath)
		console.log("Directory stats:", dirStats)

		// Write test file
		await fs.writeFile(filePath, content, { encoding: "utf8" })
		console.log("File written successfully")

		// Verify content
		const readContent = await fs.readFile(filePath, "utf8")
		console.log("File content verified:", readContent === content)

		// Clean up
		await fs.unlink(filePath)
		console.log("Test complete")
	} catch (error) {
		console.error("Test failed:", error)
		process.exit(1)
	}
}

testWrite().catch(console.error)
