import { NemoAPIConfig } from "../config/types.js"
import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers"

export class NemoAPI {
	private config: NemoAPIConfig
	private model: FeatureExtractionPipeline | null = null
	private embeddingDimension: number = 384 // all-MiniLM-L6-v2 dimension
	private maxSequenceLength: number = 512
	private initializationPromise: Promise<void> | null = null

	constructor(config: NemoAPIConfig) {
		this.config = config
		this.initializationPromise = this.initialize()
	}

	private async initialize(): Promise<void> {
		try {
			// Initialize embedding model
			this.model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
				quantized: false, // Use full precision for better quality
			})

			console.log("Model loaded successfully")
		} catch (error) {
			console.error("Failed to initialize model:", error)
			throw error
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initializationPromise) {
			await this.initializationPromise
		}
		if (!this.model) {
			throw new Error("Model not initialized")
		}
	}

	async generateEmbedding(text: string): Promise<number[]> {
		await this.ensureInitialized()

		try {
			// Preprocess text
			const processedText = this.preprocessText(text)

			// Generate embedding
			const output = await this.model!(processedText, {
				pooling: "mean",
				normalize: false,
			})

			// Convert to array and normalize
			const embedding = Array.from(output.data)
			const normalizedEmbedding = this.normalizeEmbedding(embedding)

			// Pad or truncate to match expected dimension
			const paddedEmbedding = this.padEmbedding(normalizedEmbedding, this.config.embeddingDimension)

			return paddedEmbedding
		} catch (error) {
			console.error("Failed to generate embedding:", error)
			throw error
		}
	}

	private padEmbedding(embedding: number[], targetDimension: number): number[] {
		if (embedding.length === targetDimension) {
			return embedding
		}

		// If embedding is shorter, pad with zeros
		if (embedding.length < targetDimension) {
			return [...embedding, ...Array(targetDimension - embedding.length).fill(0)]
		}

		// If embedding is longer, truncate
		return embedding.slice(0, targetDimension)
	}

	private preprocessText(text: string): string {
		// Split into words and limit to max sequence length
		const words = text.split(/\s+/)
		const truncatedWords = words.slice(0, this.maxSequenceLength)
		return truncatedWords.join(" ")
	}

	private normalizeEmbedding(embedding: number[]): number[] {
		// Calculate magnitude
		const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

		// Normalize each component
		return embedding.map((val) => val / magnitude)
	}

	async cleanup(): Promise<void> {
		try {
			// Clear model reference
			this.model = null
			this.initializationPromise = null
			console.log("Model cleanup complete")
		} catch (error) {
			console.error("Failed to cleanup model:", error)
			throw error
		}
	}

	async getModelInfo(): Promise<{
		modelSize: number
		memoryInfo: { numTensors: number; numBytes: number }
		deviceInfo: string
	}> {
		await this.ensureInitialized()

		return {
			modelSize: this.config.embeddingDimension,
			memoryInfo: {
				numTensors: 1,
				numBytes: this.config.embeddingDimension * 4, // 4 bytes per float32
			},
			deviceInfo: "ONNX Runtime (CPU/GPU)",
		}
	}

	async warmup(): Promise<void> {
		await this.ensureInitialized()
		const warmupText = "Warmup text for model initialization."
		await this.generateEmbedding(warmupText)
	}
}
