import { promises as fs, constants } from "fs"
import path from "path"
import { Memory, MemoryManagerConfig } from "../config/types.js"

export class MemoryManager {
	private memories: Memory[] = []
	private config: MemoryManagerConfig
	private initialized: boolean = false
	private initializationPromise: Promise<void>
	private basePath: string

	constructor(config: MemoryManagerConfig) {
		this.config = config
		// Resolve the base path relative to current working directory
		this.basePath = path.resolve(process.cwd(), this.config.persistencePath)
		this.initializationPromise = this.initialize()
	}

	private async initialize() {
		if (this.initialized) return

		try {
			console.log("[MemoryManager] Using persistence path:", this.basePath)

			// Create persistence directory if it doesn't exist
			await this.ensureDirectory()

			// Load existing memories
			await this.loadMemories()

			this.initialized = true
		} catch (error) {
			console.error("[MemoryManager.initialize] Failed:", error)
			throw new Error(
				`[MemoryManager] Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async ensureDirectory() {
		try {
			// Create directory if it doesn't exist
			await fs.mkdir(this.basePath, { recursive: true })

			// Check directory permissions
			try {
				await fs.access(this.basePath, constants.R_OK | constants.W_OK)
			} catch (error: any) {
				throw new Error(`Directory exists but is not accessible: ${error?.message || String(error)}`)
			}

			// Test write permissions with a temporary file
			const testFile = path.join(this.basePath, ".write-test")
			await fs.writeFile(testFile, "test")
			await fs.unlink(testFile)

			console.log("[MemoryManager] Directory verified and writable:", this.basePath)
		} catch (error: any) {
			console.error("[MemoryManager.ensureDirectory] Failed:", error)
			throw new Error(`[MemoryManager] Failed to create/verify directory: ${error?.message || String(error)}`)
		}
	}

	private async loadMemories() {
		try {
			const files = await fs.readdir(this.basePath)
			for (const file of files) {
				if (file.endsWith(".json") && !file.startsWith(".") && file !== "test.json") {
					const content = await fs.readFile(path.join(this.basePath, file), "utf-8")
					const memory = JSON.parse(content) as Memory
					this.memories.push(memory)
				}
			}
			console.log("[MemoryManager] Loaded memories:", this.memories.length)
		} catch (error) {
			console.error("[MemoryManager.loadMemories] Failed:", error)
			throw new Error(
				`[MemoryManager] Failed to load memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async storeMemory(memory: Omit<Memory, "id" | "timestamp">): Promise<Memory> {
		await this.initializationPromise

		try {
			// Ensure directory exists and is writable
			await this.ensureDirectory()

			// Validate embedding dimension
			if (!memory.embedding || !Array.isArray(memory.embedding)) {
				console.error("[MemoryManager.storeMemory] Invalid embedding format:", {
					type: typeof memory.embedding,
					value: memory.embedding,
				})
				throw new Error("[MemoryManager] Invalid embedding: Expected array")
			}

			if (memory.embedding.length !== this.config.embeddingDimension) {
				console.error("[MemoryManager.storeMemory] Dimension mismatch:", {
					received: memory.embedding.length,
					expected: this.config.embeddingDimension,
					config: this.config,
				})
				throw new Error(
					`[MemoryManager] Invalid embedding dimension. Expected ${this.config.embeddingDimension}, got ${memory.embedding.length}`,
				)
			}

			// Add timestamp and ID
			const timestamp = new Date().toISOString()
			const id = `memory_${timestamp.replace(/[:.]/g, "-")}_${Math.random().toString(36).substr(2, 9)}`
			const memoryWithMetadata: Memory = {
				...memory,
				id,
				timestamp,
			}

			// Store in memory
			this.memories.push(memoryWithMetadata)

			// Persist to disk
			const filePath = path.join(this.basePath, `${id}.json`)
			console.log("[MemoryManager] Writing to file:", filePath)

			const content = JSON.stringify(memoryWithMetadata, null, 2)

			try {
				// Write the file
				await fs.writeFile(filePath, content, { encoding: "utf8", flag: "w" })

				// Verify the file was written correctly
				const writtenContent = await fs.readFile(filePath, "utf8")
				if (writtenContent !== content) {
					throw new Error("File content verification failed")
				}

				console.log("[MemoryManager] Memory stored successfully:", {
					id,
					filePath,
					contentLength: memory.content.length,
				})
			} catch (writeError: any) {
				console.error("[MemoryManager.storeMemory] Write failed:", writeError)
				// Try to clean up the file if it was partially written
				try {
					await fs.unlink(filePath)
				} catch (unlinkError) {
					console.error("[MemoryManager.storeMemory] Cleanup failed:", unlinkError)
				}
				throw writeError
			}

			// Check memory limit and prune if needed
			await this.pruneMemoriesIfNeeded()

			return memoryWithMetadata
		} catch (error) {
			console.error("[MemoryManager.storeMemory] Failed:", error)
			throw new Error(
				`[MemoryManager] Failed to store memory: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async queryMemories(queryEmbedding: number[], limit: number = 5): Promise<Memory[]> {
		await this.initializationPromise

		try {
			// Validate query embedding dimension
			if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
				console.error("[MemoryManager.queryMemories] Invalid query embedding format:", {
					type: typeof queryEmbedding,
					value: queryEmbedding,
				})
				throw new Error("[MemoryManager] Invalid query embedding: Expected array")
			}

			if (queryEmbedding.length !== this.config.embeddingDimension) {
				console.error("[MemoryManager.queryMemories] Query dimension mismatch:", {
					received: queryEmbedding.length,
					expected: this.config.embeddingDimension,
					config: this.config,
				})
				throw new Error(
					`[MemoryManager] Invalid query embedding dimension. Expected ${this.config.embeddingDimension}, got ${queryEmbedding.length}`,
				)
			}

			// Calculate cosine similarity with all memories
			const memoriesWithSimilarity = this.memories.map((memory) => ({
				...memory,
				similarity: this.cosineSimilarity(queryEmbedding, memory.embedding),
			}))

			// Sort by similarity and return top results
			return memoriesWithSimilarity
				.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
				.slice(0, limit)
				.map(({ similarity, ...memory }) => memory)
		} catch (error) {
			console.error("[MemoryManager.queryMemories] Failed:", error)
			throw new Error(
				`[MemoryManager] Failed to query memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		// Ensure vectors have the same dimension
		if (a.length !== b.length) {
			console.error("[MemoryManager.cosineSimilarity] Vector dimension mismatch:", {
				vectorA: a.length,
				vectorB: b.length,
			})
			throw new Error(`[MemoryManager] Vector dimensions do not match: ${a.length} vs ${b.length}`)
		}

		const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
		const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
		const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
		return dotProduct / (magnitudeA * magnitudeB)
	}

	private async pruneMemoriesIfNeeded(): Promise<void> {
		try {
			const totalMemories = this.memories.length
			const memoryLimit = Math.floor((this.config.maxMemoryMB * 1024 * 1024) / 1000) // Rough estimate of memory per item

			if (totalMemories > memoryLimit) {
				// Sort by timestamp and keep most recent
				this.memories.sort((a, b) => {
					const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
					const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
					return timeB - timeA
				})

				const memoriesToRemove = this.memories.slice(memoryLimit)
				this.memories = this.memories.slice(0, memoryLimit)

				// Remove files for pruned memories
				await Promise.all(
					memoriesToRemove.map((memory) => {
						if (memory.id) {
							return fs.unlink(path.join(this.basePath, `${memory.id}.json`))
						}
						return Promise.resolve()
					}),
				)
			}
		} catch (error) {
			console.error("[MemoryManager.pruneMemoriesIfNeeded] Failed:", error)
			throw new Error(
				`[MemoryManager] Failed to prune memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async cleanup(): Promise<void> {
		await this.initializationPromise

		try {
			// Ensure all memories are persisted
			await Promise.all(
				this.memories.map((memory) => {
					if (memory.id) {
						return fs.writeFile(
							path.join(this.basePath, `${memory.id}.json`),
							JSON.stringify(memory, null, 2),
						)
					}
					return Promise.resolve()
				}),
			)
		} catch (error) {
			console.error("[MemoryManager.cleanup] Failed:", error)
			throw new Error(
				`[MemoryManager] Failed to cleanup: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}
