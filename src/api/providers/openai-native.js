import OpenAI from "openai"
import { openAiNativeDefaultModelId, openAiNativeModels } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
export class OpenAiNativeHandler {
	options
	client
	constructor(options) {
		this.options = options
		this.client = new OpenAI({
			apiKey: this.options.openAiNativeApiKey,
		})
	}
	async *createMessage(systemPrompt, messages) {
		const modelId = this.getModel().id
		switch (modelId) {
			case "o1":
			case "o1-preview":
			case "o1-mini": {
				// o1-preview and o1-mini don't support streaming, non-1 temp, or system prompt
				// o1 doesnt support streaming or non-1 temp but does support a developer prompt
				const response = await this.client.chat.completions.create({
					model: modelId,
					messages: [
						{ role: modelId === "o1" ? "developer" : "user", content: systemPrompt },
						...convertToOpenAiMessages(messages),
					],
				})
				yield {
					type: "text",
					text: response.choices[0]?.message.content || "",
				}
				yield {
					type: "usage",
					inputTokens: response.usage?.prompt_tokens || 0,
					outputTokens: response.usage?.completion_tokens || 0,
				}
				break
			}
			default: {
				const stream = await this.client.chat.completions.create({
					model: this.getModel().id,
					// max_completion_tokens: this.getModel().info.maxTokens,
					temperature: 0,
					messages: [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)],
					stream: true,
					stream_options: { include_usage: true },
				})
				for await (const chunk of stream) {
					const delta = chunk.choices[0]?.delta
					if (delta?.content) {
						yield {
							type: "text",
							text: delta.content,
						}
					}
					// contains a null value except for the last chunk which contains the token usage statistics for the entire request
					if (chunk.usage) {
						yield {
							type: "usage",
							inputTokens: chunk.usage.prompt_tokens || 0,
							outputTokens: chunk.usage.completion_tokens || 0,
						}
					}
				}
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in openAiNativeModels) {
			const id = modelId
			return { id, info: openAiNativeModels[id] }
		}
		return { id: openAiNativeDefaultModelId, info: openAiNativeModels[openAiNativeDefaultModelId] }
	}
	async completePrompt(prompt) {
		try {
			const modelId = this.getModel().id
			let requestOptions
			switch (modelId) {
				case "o1":
				case "o1-preview":
				case "o1-mini":
					// o1 doesn't support non-1 temp
					requestOptions = {
						model: modelId,
						messages: [{ role: "user", content: prompt }],
					}
					break
				default:
					requestOptions = {
						model: modelId,
						messages: [{ role: "user", content: prompt }],
						temperature: 0,
					}
			}
			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI Native completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=openai-native.js.map
