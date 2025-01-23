// Base configuration for Titan Memory System
export interface TitanConfig {
	modelPath: string
	maxMemoryMB: number
	persistencePath: string
	embeddingDimension: number
}

// Configuration for Memory Manager
export interface MemoryManagerConfig {
	maxMemoryMB: number
	persistencePath: string
	embeddingDimension: number
}

// Memory structure
export interface Memory {
	id?: string
	content: string
	embedding: number[]
	context?: Record<string, any>
	timestamp?: string
	similarity?: number
}

// NEMO API Configuration
export interface NemoAPIConfig {
	modelPath: string
	cutlassConfig: CutlassConfig
	embeddingDimension: number
}

// CUTLASS Configuration for RTX 4090
export interface CutlassConfig {
	tensorCoreEnabled: boolean
	computeCapability: string
	memoryLimit: number
}

// Memory Query Result
export interface MemoryQueryResult {
	memory: Memory
	similarity: number
}

// Memory Store Result
export interface MemoryStoreResult {
	success: boolean
	id?: string
	error?: string
}

// Memory Batch Operation Result
export interface MemoryBatchResult {
	successful: number
	failed: number
	errors: Array<{
		id?: string
		error: string
	}>
}

// Memory Statistics
export interface MemoryStats {
	totalMemories: number
	totalSize: number
	averageEmbeddingSize: number
	oldestMemory: string
	newestMemory: string
}

// Memory Context Types
export type ContextValue = string | number | boolean | null | Record<string, any>

export interface MemoryContext {
	[key: string]: ContextValue
}

// Memory Search Options
export interface SearchOptions {
	limit?: number
	minSimilarity?: number
	contextFilter?: Record<string, any>
	timeRange?: {
		start?: string
		end?: string
	}
}

// Memory Index Configuration
export interface IndexConfig {
	indexType: "flat" | "hnsw"
	dimensions: number
	metric: "cosine" | "euclidean"
	hnswConfig?: {
		M: number
		efConstruction: number
		efSearch: number
	}
}

// Memory Persistence Options
export interface PersistenceOptions {
	format: "json" | "binary"
	compression?: boolean
	backupInterval?: number
	maxBackups?: number
}

// Memory Operation Options
export interface OperationOptions {
	batchSize?: number
	timeout?: number
	retryAttempts?: number
	retryDelay?: number
}

// Export a dummy object to ensure the module is treated as a value module
export const Types = {
	createTitanConfig: (config: Partial<TitanConfig> = {}): TitanConfig => ({
		modelPath: config.modelPath || "/models/titan",
		maxMemoryMB: config.maxMemoryMB || 20000,
		persistencePath: config.persistencePath || "/data/memories",
		embeddingDimension: config.embeddingDimension || 1024,
	}),
}
