export interface NemoAPIConfig {
	modelPath: string
	embeddingDimension: number
	cutlassConfig: {
		tensorCoreEnabled: boolean
		computeCapability: string
		memoryLimit: number
	}
}

export interface MemoryManagerConfig {
	persistencePath: string
	maxMemoryMB: number
	embeddingDimension: number
}

export interface Memory {
	id: string
	content: string
	embedding: number[]
	timestamp: string
	context?: Record<string, any>
}
