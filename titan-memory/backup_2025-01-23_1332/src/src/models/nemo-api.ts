import { NemoAPIConfig } from "../config/types.js"
import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers"

export class NemoAPI {
	private config: NemoAPIConfig
	private model: FeatureExtractionPipeline | null = null
	private baseEmbeddingDimension: number = 384 // all-MiniLM-L6-v2 dimension
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

			console.log("[NemoAPI] Model loaded successfully")
		} catch (error) {
			console.error("[NemoAPI.initialize] Failed:", error)
			throw new Error(
				`[NemoAPI] Failed to initialize model: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private async ensureInitialized(): Promise<void> {
		if (this.initializationPromise) {
			await this.initializationPromise
		}
		if (!this.model) {
			throw new Error("[NemoAPI] Model not initialized")
		}
	}

	async generateEmbedding(text: string): Promise<number[]> {
		await this.ensureInitialized()

		try {
			// Preprocess text
			const processedText = this.preprocessText(text)

			// Generate base embedding
			const output = await this.model!(processedText, {
				pooling: "mean",
				normalize: true,
			})

			// Convert to array
			const baseEmbedding = Array.from(output.data)
			console.log("[NemoAPI] Base embedding length:", baseEmbedding.length)

			// Create repeated pattern to reach target dimension
			const targetDimension = this.config.embeddingDimension
			const repeats = Math.ceil(targetDimension / baseEmbedding.length)

			console.log("[NemoAPI] Padding embedding:", {
				baseLength: baseEmbedding.length,
				targetDimension,
				repeatsNeeded: repeats,
			})

			// Build padded embedding with alternating signs
			let paddedEmbedding: number[] = []
			for (let i = 0; i < repeats; i++) {
				const sign = i % 2 === 0 ? 1 : -1
				paddedEmbedding = paddedEmbedding.concat(baseEmbedding.map((x) => x * sign))
			}

			// Truncate to exact dimension
			paddedEmbedding = paddedEmbedding.slice(0, targetDimension)

			console.log("[NemoAPI] Padded embedding:", {
				originalLength: baseEmbedding.length,
				paddedLength: paddedEmbedding.length,
				targetDimension: targetDimension,
			})

			// Verify dimension
			if (paddedEmbedding.length !== targetDimension) {
				throw new Error(
					`[NemoAPI] Failed to pad embedding to target dimension. Got ${paddedEmbedding.length}, expected ${targetDimension}`,
				)
			}

			// Normalize the padded embedding
			const normalizedEmbedding = this.normalizeEmbedding(paddedEmbedding)

			// Final verification
			if (normalizedEmbedding.length !== targetDimension) {
				throw new Error(
					`[NemoAPI] Embedding dimension mismatch after normalization. Got ${normalizedEmbedding.length}, expected ${targetDimension}`,
				)
			}

			return normalizedEmbedding
		} catch (error) {
			console.error("[NemoAPI.generateEmbedding] Failed:", error)
			throw new Error(
				`[NemoAPI] Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private preprocessText(text: string): string {
		try {
			// Split into words and limit to max sequence length
			const words = text.split(/\s+/)
			const truncatedWords = words.slice(0, this.maxSequenceLength)
			return truncatedWords.join(" ")
		} catch (error) {
			console.error("[NemoAPI.preprocessText] Failed:", error)
			throw new Error(
				`[NemoAPI] Failed to preprocess text: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private normalizeEmbedding(embedding: number[]): number[] {
		try {
			// Calculate magnitude
			const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

			if (magnitude === 0) {
				console.error("[NemoAPI.normalizeEmbedding] Zero magnitude encountered")
				throw new Error("[NemoAPI] Cannot normalize zero vector")
			}

			// Normalize each component
			return embedding.map((val) => val / magnitude)
		} catch (error) {
			console.error("[NemoAPI.normalizeEmbedding] Failed:", error)
			throw new Error(
				`[NemoAPI] Failed to normalize embedding: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async cleanup(): Promise<void> {
		try {
			// Clear model reference
			this.model = null
			this.initializationPromise = null
			console.log("[NemoAPI] Model cleanup complete")
		} catch (error) {
			console.error("[NemoAPI.cleanup] Failed:", error)
			throw new Error(
				`[NemoAPI] Failed to cleanup model: ${error instanceof Error ? error.message : String(error)}`,
			)
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
