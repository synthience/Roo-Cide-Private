declare module "node-llama-cpp" {
	export interface LlamaModelOptions {
		modelPath: string
		gpuLayers?: number
		contextSize?: number
		batchSize?: number
		threads?: number
		useMlock?: boolean
		embedding?: boolean
		seed?: number
		f16Memory?: boolean
		logitsAll?: boolean
		vocabOnly?: boolean
		loraBase?: string
		loraPath?: string
		tensorSplit?: string
		rope_freq_base?: number
		rope_freq_scale?: number
	}

	export interface LlamaContextOptions {
		model: LlamaModel
		contextSize?: number
		batchSize?: number
		threads?: number
	}

	export interface CompletionOptions {
		prompt?: string
		maxTokens?: number
		temperature?: number
		topP?: number
		echo?: boolean
		stop?: string[]
		frequency_penalty?: number
		presence_penalty?: number
		repeat_penalty?: number
		top_k?: number
		tfs_z?: number
		stream?: boolean
		logitBias?: Record<string, number>
	}

	export interface CompletionResult {
		text: string
		usage: {
			prompt_tokens: number
			completion_tokens: number
			total_tokens: number
		}
		embedding?: number[]
	}

	export class LlamaModel {
		constructor(options: LlamaModelOptions)
		tokenize(text: string): Promise<number[]>
		detokenize(tokens: number[]): Promise<string>
	}

	export class LlamaContext {
		constructor(options: LlamaContextOptions)
		evaluate(tokens: number[]): Promise<number[]>
		getEmbedding(text: string): Promise<number[]>
		complete(options: CompletionOptions): Promise<CompletionResult>
	}
}
