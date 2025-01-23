import { MemoryManager } from "./dist/models/memory-manager.js"
import { NemoAPI } from "./dist/models/nemo-api.js"

const testMemory = {
	content: "Test memory content",
	embedding: new Array(1024).fill(0).map((_, i) => Math.sin(i)), // Create a test embedding
	context: {
		type: "test",
		timestamp: new Date().toISOString(),
	},
}

async function test() {
	try {
		// Initialize NemoAPI
		const nemoApi = new NemoAPI({
			modelPath: process.env.TITAN_MODEL_PATH || "/models/titan",
			cutlassConfig: {
				tensorCoreEnabled: true,
				computeCapability: "89",
				memoryLimit: parseInt(process.env.TITAN_MAX_MEMORY_MB || "20000"),
			},
			embeddingDimension: parseInt(process.env.TITAN_EMBEDDING_DIM || "1024"),
		})

		// Wait for NemoAPI initialization
		await nemoApi.warmup()

		// Generate embedding
		console.log("Generating embedding...")
		const embedding = await nemoApi.generateEmbedding(testMemory.content)
		console.log("Embedding generated:", embedding.length)

		// Initialize MemoryManager
		const manager = new MemoryManager({
			maxMemoryMB: parseInt(process.env.TITAN_MAX_MEMORY_MB || "20000"),
			persistencePath: process.env.TITAN_PERSISTENCE_PATH || "/data/memories",
			embeddingDimension: parseInt(process.env.TITAN_EMBEDDING_DIM || "1024"),
		})

		// Store memory with generated embedding
		console.log("Storing memory...")
		const result = await manager.storeMemory({
			content: testMemory.content,
			embedding,
			context: testMemory.context,
		})

		console.log("Memory stored:", result)
	} catch (error) {
		console.error("Failed to store memory:", error)
	}
}

test().catch(console.error)
