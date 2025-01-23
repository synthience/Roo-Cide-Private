declare module "@tensorflow/tfjs" {
	export interface Memory {
		numTensors: number
		numBytes: number
		unreliable?: boolean
	}

	export interface LayersModel {
		predict(inputs: Tensor): Tensor
		compile(config: ModelCompileConfig): void
		dispose(): void
		layers: Layer[]
	}

	export interface Layer {
		setWeights(weights: Tensor[]): void
	}

	export interface ModelCompileConfig {
		optimizer: Optimizer
		loss: string
	}

	export interface Tensor {
		dataSync(): Float32Array
		dispose(): void
	}

	export interface Optimizer {}

	export interface LayerConfig {
		inputDim?: number
		outputDim?: number
		inputLength?: number
	}

	export interface TensorData {
		values: number[] | Float32Array
		shape: number[]
	}

	export namespace layers {
		export function embedding(config: LayerConfig): Layer
		export function globalAveragePooling1d(): Layer
	}

	export namespace train {
		export function adam(config?: any): Optimizer
	}

	export function loadLayersModel(path: string): Promise<LayersModel>
	export function tensor2d(values: number[] | Float32Array | number[][], shape?: [number, number]): Tensor
	export function sequential(config?: { layers: Layer[] }): LayersModel
	export function memory(): Memory
	export function getBackend(): string
	export function setBackend(backendName: string): Promise<boolean>
	export function engine(): {
		startScope(): void
		endScope(): void
		dispose(): Promise<void>
	}
	export function disposeVariables(): void
	export function dispose(): Promise<void>
	export function tidy<T>(fn: () => T): T
	export function ready(): Promise<void>
}
