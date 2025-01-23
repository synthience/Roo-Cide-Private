import { writeFile } from "./dist/utils/fs.js"
import path from "path"

async function test() {
	try {
		const basePath = path.resolve("./data/memories")
		const testFile = path.join(basePath, "test.json")
		const content = JSON.stringify({ test: "content" }, null, 2)

		console.log("Writing to:", testFile)
		await writeFile(testFile, content)
		console.log("Write successful")
	} catch (error) {
		console.error("Write failed:", error)
	}
}

test().catch(console.error)
