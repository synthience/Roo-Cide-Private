import { promises as fs } from "fs"
import path from "path"
import { logger } from "./dist/utils/logger.js"
import { ensureDirectory, writeFile } from "./dist/utils/fs.js"

async function testPath() {
	try {
		const basePath = path.resolve("data/memories")
		logger.log("Test", "Base path", { path: basePath })

		// Create test file
		const testFile = path.join(basePath, "test.json")
		logger.log("Test", "Test file path", { path: testFile })

		// Ensure directory exists
		await ensureDirectory(basePath)
		logger.log("Test", "Directory created")

		// Write test file
		const content = JSON.stringify({ test: "data" }, null, 2)
		await writeFile(testFile, content)
		logger.log("Test", "File written successfully")

		// Read file back
		const readContent = await fs.readFile(testFile, "utf8")
		logger.log("Test", "File content verified", {
			matches: readContent === content,
		})

		// Clean up
		await fs.unlink(testFile)
		logger.log("Test", "Test complete")
	} catch (error) {
		logger.error("Test", "Test failed", error)
		process.exit(1)
	}
}

testPath().catch(console.error)
