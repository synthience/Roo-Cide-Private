declare module "@llama-node/core" {
	export interface ModelConfig {
		modelPath: string
		gpuLayers?: number
		contextSize?: number
		batchSize?: number
		threads?: number
		f16Memory?: boolean
		useMlock?: boolean
		embedding?: boolean
	}

	export interface ContextConfig {
		maxTokens: number
		temperature: number
		topP: number
		repeatPenalty: number
	}

	export interface LLamaModelInstance {
		createContext: (config: ContextConfig) => Promise<LLamaContextInstance>
		destroy: () => Promise<void>
	}

	export interface LLamaContextInstance {
		createInstance: () => Promise<LLamaInstanceInstance>
		destroy: () => Promise<void>
	}

	export interface LLamaInstanceInstance {
		embed: (text: string) => Promise<number[]>
		destroy: () => Promise<void>
	}

	export const LLamaModel: {
		create: (config: ModelConfig) => Promise<LLamaModelInstance>
	}

	export default {
		LLamaModel,
	}
}
