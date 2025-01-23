declare module "@xenova/transformers" {
	export type PipelineType = "feature-extraction"

	export interface PipelineOptions {
		quantized?: boolean
		revision?: string
	}

	export interface EmbeddingOutput {
		data: Float32Array
		dims: number[]
	}

	export interface GenerationOptions {
		pooling?: string
		normalize?: boolean
	}

	export type FeatureExtractionPipeline = {
		(text: string, options?: GenerationOptions): Promise<EmbeddingOutput>
	}

	export function pipeline(
		task: PipelineType,
		model: string,
		options?: PipelineOptions,
	): Promise<FeatureExtractionPipeline>
}
