import { OpenAiHandler } from "./openai"
import { deepSeekModels, deepSeekDefaultModelId } from "../../shared/api"
export class DeepSeekHandler extends OpenAiHandler {
	constructor(options) {
		if (!options.deepSeekApiKey) {
			throw new Error("DeepSeek API key is required. Please provide it in the settings.")
		}
		super({
			...options,
			openAiApiKey: options.deepSeekApiKey,
			openAiModelId: options.apiModelId ?? deepSeekDefaultModelId,
			openAiBaseUrl: options.deepSeekBaseUrl ?? "https://api.deepseek.com/v1",
			openAiStreamingEnabled: true,
			includeMaxTokens: true,
		})
	}
	getModel() {
		const modelId = this.options.apiModelId ?? deepSeekDefaultModelId
		return {
			id: modelId,
			info: deepSeekModels[modelId] || deepSeekModels[deepSeekDefaultModelId],
		}
	}
}
//# sourceMappingURL=deepseek.js.map
