import { NemoAPIConfig } from "../config/types.js"
import { pipeline, FeatureExtractionPipeline } from "@xenova/transformers"
import { logger } from "../utils/logger.js"

export class NemoAPI {
	private config: NemoAPIConfig
	private model: FeatureExtractionPipeline | null = null
	private baseEmbeddingDimension: number = 384 // all-MiniLM-L6-v2 dimension
	private maxSequenceLength: number = 512
	private initializationPromise: Promise<void> | null = null
	private isWarmedUp: boolean = false

	constructor(config: NemoAPIConfig) {
		this.config = config
	}

	async initialize(): Promise<void> {
		try {
			logger.log("NemoAPI", "Starting initialization")

			// Initialize embedding model
			this.model = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
				quantized: false, // Use full precision for better quality
			})

			logger.log("NemoAPI", "Model loaded successfully")

			// Run warmup
			await this.warmup()
		} catch (error) {
			logger.log("NemoAPI", "Initialization failed", error)
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
		if (!this.isWarmedUp) {
			await this.warmup()
		}
	}

	async generateEmbedding(text: string): Promise<number[]> {
		await this.ensureInitialized()

		try {
			logger.log("NemoAPI", "Generating embedding", { textLength: text.length })

			// Preprocess text
			const processedText = this.preprocessText(text)
			logger.log("NemoAPI", "Text preprocessed", {
				originalLength: text.length,
				processedLength: processedText.length,
				text: processedText,
			})

			// Generate base embedding
			logger.log("NemoAPI", "Calling model for embedding generation")
			const output = await this.model!(processedText, {
				pooling: "mean",
				normalize: true,
			})

			logger.log("NemoAPI", "Model output received", {
				output: output,
				hasData: !!output?.data,
				dataType: output?.data ? typeof output.data : "undefined",
			})

			if (!output || !output.data) {
				throw new Error("[NemoAPI] Model output is invalid")
			}

			// Convert to array
			const baseEmbedding = Array.from(output.data)
			logger.log("NemoAPI", "Base embedding generated", {
				length: baseEmbedding.length,
				isArray: Array.isArray(baseEmbedding),
				sampleValues: baseEmbedding.slice(0, 3),
			})

			// Create repeated pattern to reach target dimension
			const targetDimension = this.config.embeddingDimension
			const repeats = Math.ceil(targetDimension / this.baseEmbeddingDimension)

			logger.log("NemoAPI", "Padding embedding", {
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

			logger.log("NemoAPI", "Padded embedding", {
				originalLength: baseEmbedding.length,
				paddedLength: paddedEmbedding.length,
				targetDimension: targetDimension,
				sampleValues: paddedEmbedding.slice(0, 3),
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

			logger.log("NemoAPI", "Embedding generation complete", {
				finalLength: normalizedEmbedding.length,
				sampleValues: normalizedEmbedding.slice(0, 3),
			})

			return normalizedEmbedding
		} catch (error) {
			logger.log("NemoAPI", "Failed to generate embedding", error)
			throw new Error(
				`[NemoAPI] Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private preprocessText(text: string): string {
		if (!text) {
			throw new Error("[NemoAPI] Input text is empty or undefined")
		}

		try {
			logger.log("NemoAPI", "Preprocessing text", { inputLength: text.length })

			// Split into words and limit to max sequence length
			const words = text.split(/\s+/)
			const truncatedWords = words.slice(0, this.maxSequenceLength)
			const result = truncatedWords.join(" ")

			logger.log("NemoAPI", "Text preprocessing complete", {
				originalWords: words.length,
				truncatedWords: truncatedWords.length,
				resultLength: result.length,
				result: result,
			})

			return result
		} catch (error) {
			logger.log("NemoAPI", "Text preprocessing failed", error)
			throw new Error(
				`[NemoAPI] Failed to preprocess text: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	private normalizeEmbedding(embedding: number[]): number[] {
		try {
			logger.log("NemoAPI", "Normalizing embedding", {
				length: embedding.length,
				sampleValues: embedding.slice(0, 3),
			})

			// Calculate magnitude
			const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))

			if (magnitude === 0) {
				logger.log("NemoAPI", "Zero magnitude encountered")
				throw new Error("[NemoAPI] Cannot normalize zero vector")
			}

			// Normalize each component
			const normalized = embedding.map((val) => val / magnitude)

			logger.log("NemoAPI", "Embedding normalization complete", {
				inputLength: embedding.length,
				outputLength: normalized.length,
				magnitude,
				sampleValues: normalized.slice(0, 3),
			})

			return normalized
		} catch (error) {
			logger.log("NemoAPI", "Embedding normalization failed", error)
			throw new Error(
				`[NemoAPI] Failed to normalize embedding: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	async cleanup(): Promise<void> {
		try {
			logger.log("NemoAPI", "Starting cleanup")

			// Clear model reference
			this.model = null
			this.initializationPromise = null
			this.isWarmedUp = false

			logger.log("NemoAPI", "Model cleanup complete")
		} catch (error) {
			logger.log("NemoAPI", "Cleanup failed", error)
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

	private async warmup(): Promise<void> {
		try {
			logger.log("NemoAPI", "Starting warmup")

			if (!this.model) {
				throw new Error("[NemoAPI] Model not initialized")
			}

			const warmupText = "Warmup text for model initialization."
			logger.log("NemoAPI", "Generating warmup embedding")

			const output = await this.model(warmupText, {
				pooling: "mean",
				normalize: true,
			})

			if (!output || !output.data) {
				throw new Error("[NemoAPI] Warmup failed: Invalid model output")
			}

			const baseEmbedding = Array.from(output.data)
			logger.log("NemoAPI", "Warmup embedding generated", {
				length: baseEmbedding.length,
				sampleValues: baseEmbedding.slice(0, 3),
			})

			this.isWarmedUp = true
			logger.log("NemoAPI", "Warmup complete")
		} catch (error) {
			logger.log("NemoAPI", "Warmup failed", error)
			throw new Error(
				`[NemoAPI] Failed to warmup model: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
}
