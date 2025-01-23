import { writeFile } from "./dist/utils/fs.js"
import path from "path"

async function test() {
	try {
		const basePath = path.resolve("./data/memories")
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
		const id = `memory_${timestamp}_test`
		const testFile = path.join(basePath, `${id}.json`)
		const content = JSON.stringify({ test: "content" }, null, 2)

		console.log("Writing to:", testFile)
		await writeFile(testFile, content)
		console.log("Write successful")
	} catch (error) {
		console.error("Write failed:", error)
	}
}

test().catch(console.error)
