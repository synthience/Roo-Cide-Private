import { promises as fs, constants } from "fs"
import path from "path"

async function testWrite() {
	try {
		// Use a simpler test path
		const dirPath = path.join(process.cwd(), "data", "memories")
		const filePath = path.join(dirPath, "test.json")
		const content = JSON.stringify(
			{
				id: "test",
				timestamp: new Date().toISOString(),
				content: "Test content",
				embedding: new Array(1024).fill(0).map((_, i) => Math.sin(i)),
				context: { type: "test" },
			},
			null,
			2,
		)

		// Log paths
		console.log("Current working directory:", process.cwd())
		console.log("Directory path:", dirPath)
		console.log("File path:", filePath)

		// Create directory if it doesn't exist
		console.log("Creating directory...")
		await fs.mkdir(dirPath, { recursive: true })

		// Verify directory exists
		const dirStats = await fs.stat(dirPath)
		console.log("Directory exists:", dirStats)

		// Write file
		console.log("Writing file...")
		await fs.writeFile(filePath, content, { encoding: "utf8" })
		console.log("File written")

		// Verify file was written
		console.log("Verifying file...")
		const writtenContent = await fs.readFile(filePath, "utf8")
		console.log("Written content matches:", writtenContent === content)

		// Clean up
		console.log("Cleaning up...")
		await fs.unlink(filePath)
		console.log("Test successful")
	} catch (error) {
		console.error("Test failed:", error)
		console.error("Error details:", {
			name: error.name,
			message: error.message,
			code: error.code,
			stack: error.stack,
		})
	}
}

testWrite().catch(console.error)
