import { constants } from "fs"
import path from "path"
import { Memory, MemoryManagerConfig } from "../config/types.js"
import { logger } from "../utils/logger.js"
import { ensureDirectory, writeFile, readFile, listFiles, fileExists, deleteFile } from "../utils/fs.js"

export class MemoryManager {
	private memories: Memory[] = []
	private config: MemoryManagerConfig
	private initialized: boolean = false
	private initializationPromise: Promise<void>
	private basePath: string

	constructor(config: MemoryManagerConfig) {
		this.config = config
		// Normalize path for Windows
		this.basePath = path.resolve(config.persistencePath)

		logger.log("MemoryManager", "Resolved base path", {
			original: config.persistencePath,
			resolved: this.basePath,
		})

		this.initializationPromise = this.initialize()
	}

	private async initialize() {
		if (this.initialized) return

		try {
			logger.log("MemoryManager", "Starting initialization")

			// Create persistence directory if it doesn't exist
			await this.ensureDirectory()

			// Load existing memories
			await this.loadMemories()

			this.initialized = true
			logger.log("MemoryManager", "Initialization complete")
		} catch (error) {
			logger.log("MemoryManager", "Initialization failed", error)
			throw new Error(
				`[MemoryManager] Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async ensureDirectory() {
		try {
			logger.log("MemoryManager", "Ensuring directory exists", { path: this.basePath })
			await ensureDirectory(this.basePath)

			// Test write permissions with a temporary file
			const testFile = path.join(this.basePath, ".write-test")
			logger.log("MemoryManager", "Testing write permissions", { testFile })

			await writeFile(testFile, "test")
			await deleteFile(testFile)
			logger.log("MemoryManager", "Write test successful")
		} catch (error: any) {
			logger.log("MemoryManager", "Directory setup failed", error)
			throw new Error(`[MemoryManager] Failed to create/verify directory: ${error?.message || String(error)}`)
		}
	}

	private validateMemory(memory: any): memory is Memory {
		if (!memory || typeof memory !== "object") {
			logger.log("MemoryManager", "Invalid memory format", { memory })
			return false
		}

		if (!memory.id || typeof memory.id !== "string") {
			logger.log("MemoryManager", "Missing or invalid id", { id: memory.id })
			return false
		}

		if (!memory.content || typeof memory.content !== "string") {
			logger.log("MemoryManager", "Missing or invalid content", { id: memory.id })
			return false
		}

		if (!memory.embedding || !Array.isArray(memory.embedding)) {
			logger.log("MemoryManager", "Missing or invalid embedding", { id: memory.id })
			return false
		}

		if (memory.embedding.length !== this.config.embeddingDimension) {
			logger.log("MemoryManager", "Invalid embedding dimension", {
				id: memory.id,
				expected: this.config.embeddingDimension,
				actual: memory.embedding.length,
			})
			return false
		}

		if (!memory.timestamp || typeof memory.timestamp !== "string") {
			logger.log("MemoryManager", "Missing or invalid timestamp", { id: memory.id })
			return false
		}

		return true
	}

	private async loadMemories() {
		try {
			logger.log("MemoryManager", "Loading existing memories")
			const files = await listFiles(this.basePath)

			for (const file of files) {
				if (file.endsWith(".json") && !file.startsWith(".") && file !== "test.json") {
					const filePath = path.join(this.basePath, file)
					logger.log("MemoryManager", "Loading memory file", { file: filePath })

					try {
						const content = await readFile(filePath)
						const memory = JSON.parse(content)

						if (this.validateMemory(memory)) {
							this.memories.push(memory)
							logger.log("MemoryManager", "Memory loaded successfully", {
								id: memory.id,
								timestamp: memory.timestamp,
							})
						} else {
							logger.log("MemoryManager", "Skipping invalid memory file", { file: filePath })
						}
					} catch (error) {
						logger.log("MemoryManager", "Failed to load memory file", {
							file: filePath,
							error: error instanceof Error ? error.message : String(error),
						})
					}
				}
			}

			logger.log("MemoryManager", "Memory loading complete", {
				totalLoaded: this.memories.length,
			})
		} catch (error) {
			logger.log("MemoryManager", "Failed to load memories", error)
			throw new Error(
				`[MemoryManager] Failed to load memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async storeMemory(memory: Omit<Memory, "id" | "timestamp">): Promise<Memory> {
		await this.initializationPromise

		try {
			logger.log("MemoryManager", "Storing new memory", { content: memory.content })

			// Validate embedding dimension
			if (!memory.embedding || !Array.isArray(memory.embedding)) {
				logger.log("MemoryManager", "No embedding provided, generating default")
				memory.embedding = new Array(this.config.embeddingDimension).fill(0).map((_, i) => Math.sin(i))
			}

			if (memory.embedding.length !== this.config.embeddingDimension) {
				logger.log("MemoryManager", "Embedding dimension mismatch", {
					received: memory.embedding.length,
					expected: this.config.embeddingDimension,
				})
				throw new Error(
					`[MemoryManager] Invalid embedding dimension. Expected ${this.config.embeddingDimension}, got ${memory.embedding.length}`,
				)
			}

			// Add timestamp and ID
			const timestamp = new Date().toISOString()
			// Create a safe filename by replacing colons and dots with hyphens
			const safeTimestamp = timestamp.replace(/[:.]/g, "-")
			const id = `memory_${safeTimestamp}_${Math.random().toString(36).substr(2, 9)}`
			const memoryWithMetadata: Memory = {
				...memory,
				id,
				timestamp,
			}

			logger.log("MemoryManager", "Created memory metadata", { id, timestamp })

			// Store in memory
			this.memories.push(memoryWithMetadata)

			// Persist to disk
			const filePath = path.join(this.basePath, `${id}.json`)
			const content = JSON.stringify(memoryWithMetadata, null, 2)

			await writeFile(filePath, content)

			logger.log("MemoryManager", "Memory stored successfully", {
				id,
				filePath,
				contentLength: memory.content.length,
			})

			// Check memory limit and prune if needed
			await this.pruneMemoriesIfNeeded()

			return memoryWithMetadata
		} catch (error) {
			logger.log("MemoryManager", "Failed to store memory", error)
			throw new Error(
				`[MemoryManager] Failed to store memory: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async queryMemories(queryEmbedding: number[], limit: number = 5): Promise<Memory[]> {
		await this.initializationPromise

		try {
			logger.log("MemoryManager", "Querying memories", {
				limit,
				totalMemories: this.memories.length,
				queryEmbeddingLength: queryEmbedding?.length,
			})

			// Validate query embedding dimension
			if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
				logger.log("MemoryManager", "Invalid query embedding format", {
					type: typeof queryEmbedding,
				})
				throw new Error("[MemoryManager] Invalid query embedding: Expected array")
			}

			if (queryEmbedding.length !== this.config.embeddingDimension) {
				logger.log("MemoryManager", "Query dimension mismatch", {
					received: queryEmbedding.length,
					expected: this.config.embeddingDimension,
				})
				throw new Error(
					`[MemoryManager] Invalid query embedding dimension. Expected ${this.config.embeddingDimension}, got ${queryEmbedding.length}`,
				)
			}

			// Calculate cosine similarity with all memories
			const memoriesWithSimilarity = this.memories.map((memory) => {
				if (!memory.embedding || !Array.isArray(memory.embedding)) {
					logger.log("MemoryManager", "Invalid memory embedding", { id: memory.id })
					return { ...memory, similarity: 0 }
				}

				const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding)
				logger.log("MemoryManager", "Calculated similarity", {
					memoryId: memory.id,
					similarity,
				})
				return {
					...memory,
					similarity,
				}
			})

			// Sort by similarity and return top results
			const results = memoriesWithSimilarity
				.sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
				.slice(0, limit)
				.map(({ similarity, ...memory }) => memory)

			logger.log("MemoryManager", "Query complete", {
				resultsCount: results.length,
				topSimilarity: memoriesWithSimilarity[0]?.similarity,
			})

			return results
		} catch (error) {
			logger.log("MemoryManager", "Query failed", error)
			throw new Error(
				`[MemoryManager] Failed to query memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		try {
			// Ensure vectors have the same dimension
			if (a.length !== b.length) {
				logger.log("MemoryManager", "Vector dimension mismatch", {
					vectorA: a.length,
					vectorB: b.length,
				})
				throw new Error(`[MemoryManager] Vector dimensions do not match: ${a.length} vs ${b.length}`)
			}

			const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
			const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
			const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

			if (magnitudeA === 0 || magnitudeB === 0) {
				logger.log("MemoryManager", "Zero magnitude encountered", {
					magnitudeA,
					magnitudeB,
				})
				return 0
			}

			const similarity = dotProduct / (magnitudeA * magnitudeB)

			logger.log("MemoryManager", "Cosine similarity calculated", {
				dotProduct,
				magnitudeA,
				magnitudeB,
				similarity,
			})

			return similarity
		} catch (error) {
			logger.log("MemoryManager", "Failed to calculate cosine similarity", error)
			throw error
		}
	}

	private async pruneMemoriesIfNeeded(): Promise<void> {
		try {
			const totalMemories = this.memories.length
			const memoryLimit = Math.floor((this.config.maxMemoryMB * 1024 * 1024) / 1000)

			logger.log("MemoryManager", "Checking memory limits", {
				current: totalMemories,
				limit: memoryLimit,
			})

			if (totalMemories > memoryLimit) {
				logger.log("MemoryManager", "Pruning excess memories")

				// Sort by timestamp and keep most recent
				this.memories.sort((a, b) => {
					const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0
					const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0
					return timeB - timeA
				})

				const memoriesToRemove = this.memories.slice(memoryLimit)
				this.memories = this.memories.slice(0, memoryLimit)

				// Remove files for pruned memories
				for (const memory of memoriesToRemove) {
					if (memory.id) {
						const filePath = path.join(this.basePath, `${memory.id}.json`)
						logger.log("MemoryManager", "Removing pruned memory file", {
							id: memory.id,
							file: filePath,
						})
						await deleteFile(filePath)
					}
				}

				logger.log("MemoryManager", "Memory pruning complete", {
					removed: memoriesToRemove.length,
					remaining: this.memories.length,
				})
			}
		} catch (error) {
			logger.log("MemoryManager", "Failed to prune memories", error)
			throw new Error(
				`[MemoryManager] Failed to prune memories: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async cleanup(): Promise<void> {
		await this.initializationPromise

		try {
			logger.log("MemoryManager", "Starting cleanup")

			// Ensure all memories are persisted
			for (const memory of this.memories) {
				if (memory.id) {
					const filePath = path.join(this.basePath, `${memory.id}.json`)
					const content = JSON.stringify(memory, null, 2)
					logger.log("MemoryManager", "Persisting memory", {
						id: memory.id,
						file: filePath,
					})
					await writeFile(filePath, content)
				}
			}

			logger.log("MemoryManager", "Cleanup complete")
		} catch (error) {
			logger.log("MemoryManager", "Cleanup failed", error)
			throw new Error(
				`[MemoryManager] Failed to cleanup: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}
