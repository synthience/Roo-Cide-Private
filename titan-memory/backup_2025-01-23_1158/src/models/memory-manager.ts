import { promises as fs } from "fs"
import path from "path"
import { Memory, MemoryManagerConfig, Types } from "../config/types.js"

export class MemoryManager {
	private memories: Memory[] = []
	private config: MemoryManagerConfig

	constructor(config: MemoryManagerConfig) {
		this.config = config
		this.initialize()
	}

	private async initialize() {
		try {
			// Create persistence directory if it doesn't exist
			await fs.mkdir(this.config.persistencePath, { recursive: true })

			// Load existing memories
			await this.loadMemories()
		} catch (error) {
			console.error("Failed to initialize MemoryManager:", error)
			throw error
		}
	}

	private async loadMemories() {
		try {
			const files = await fs.readdir(this.config.persistencePath)
			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await fs.readFile(path.join(this.config.persistencePath, file), "utf-8")
					const memory = JSON.parse(content) as Memory
					this.memories.push(memory)
				}
			}
		} catch (error) {
			console.error("Failed to load memories:", error)
			throw error
		}
	}

	async storeMemory(memory: Omit<Memory, "id" | "timestamp">): Promise<Memory> {
		try {
			// Validate memory size
			if (memory.embedding.length !== this.config.embeddingDimension) {
				throw new Error(
					`Invalid embedding dimension. Expected ${this.config.embeddingDimension}, got ${memory.embedding.length}`,
				)
			}

			// Add timestamp and ID
			const timestamp = new Date().toISOString()
			const id = `memory_${timestamp}_${Math.random().toString(36).substr(2, 9)}`
			const memoryWithMetadata: Memory = {
				...memory,
				id,
				timestamp,
			}

			// Store in memory
			this.memories.push(memoryWithMetadata)

			// Persist to disk
			await fs.writeFile(
				path.join(this.config.persistencePath, `${id}.json`),
				JSON.stringify(memoryWithMetadata, null, 2),
			)

			// Check memory limit and prune if needed
			await this.pruneMemoriesIfNeeded()

			return memoryWithMetadata
		} catch (error) {
			console.error("Failed to store memory:", error)
			throw error
		}
	}

	async queryMemories(queryEmbedding: number[], limit: number = 5): Promise<Memory[]> {
		try {
			// Validate query embedding
			if (queryEmbedding.length !== this.config.embeddingDimension) {
				throw new Error(
					`Invalid query embedding dimension. Expected ${this.config.embeddingDimension}, got ${queryEmbedding.length}`,
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
			console.error("Failed to query memories:", error)
			throw error
		}
	}

	private cosineSimilarity(a: number[], b: number[]): number {
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
							return fs.unlink(path.join(this.config.persistencePath, `${memory.id}.json`))
						}
						return Promise.resolve()
					}),
				)
			}
		} catch (error) {
			console.error("Failed to prune memories:", error)
			throw error
		}
	}

	async cleanup(): Promise<void> {
		try {
			// Ensure all memories are persisted
			await Promise.all(
				this.memories.map((memory) => {
					if (memory.id) {
						return fs.writeFile(
							path.join(this.config.persistencePath, `${memory.id}.json`),
							JSON.stringify(memory, null, 2),
						)
					}
					return Promise.resolve()
				}),
			)
		} catch (error) {
			console.error("Failed to cleanup MemoryManager:", error)
			throw error
		}
	}
}
