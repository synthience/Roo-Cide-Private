import { GoogleGenerativeAI } from "@google/generative-ai"
import { geminiDefaultModelId, geminiModels } from "../../shared/api"
import { convertAnthropicMessageToGemini } from "../transform/gemini-format"
export class GeminiHandler {
	options
	client
	constructor(options) {
		if (!options.geminiApiKey) {
			throw new Error("API key is required for Google Gemini")
		}
		this.options = options
		this.client = new GoogleGenerativeAI(options.geminiApiKey)
	}
	async *createMessage(systemPrompt, messages) {
		const model = this.client.getGenerativeModel({
			model: this.getModel().id,
			systemInstruction: systemPrompt,
		})
		const result = await model.generateContentStream({
			contents: messages.map(convertAnthropicMessageToGemini),
			generationConfig: {
				// maxOutputTokens: this.getModel().info.maxTokens,
				temperature: 0,
			},
		})
		for await (const chunk of result.stream) {
			yield {
				type: "text",
				text: chunk.text(),
			}
		}
		const response = await result.response
		yield {
			type: "usage",
			inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
			outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}
	async completePrompt(prompt) {
		try {
			const model = this.client.getGenerativeModel({
				model: this.getModel().id,
			})
			const result = await model.generateContent({
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				generationConfig: {
					temperature: 0,
				},
			})
			return result.response.text()
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Gemini completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=gemini.js.map
