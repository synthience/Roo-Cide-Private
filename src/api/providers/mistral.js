import { Mistral } from "@mistralai/mistralai"
import { mistralDefaultModelId, mistralModels } from "../../shared/api"
import { convertToMistralMessages } from "../transform/mistral-format"
export class MistralHandler {
	options
	client
	constructor(options) {
		this.options = options
		this.client = new Mistral({
			serverURL: "https://codestral.mistral.ai",
			apiKey: this.options.mistralApiKey,
		})
	}
	async *createMessage(systemPrompt, messages) {
		const stream = await this.client.chat.stream({
			model: this.getModel().id,
			// max_completion_tokens: this.getModel().info.maxTokens,
			temperature: 0,
			messages: [{ role: "system", content: systemPrompt }, ...convertToMistralMessages(messages)],
			stream: true,
		})
		for await (const chunk of stream) {
			const delta = chunk.data.choices[0]?.delta
			if (delta?.content) {
				let content = ""
				if (typeof delta.content === "string") {
					content = delta.content
				} else if (Array.isArray(delta.content)) {
					content = delta.content.map((c) => (c.type === "text" ? c.text : "")).join("")
				}
				yield {
					type: "text",
					text: content,
				}
			}
			if (chunk.data.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.data.usage.promptTokens || 0,
					outputTokens: chunk.data.usage.completionTokens || 0,
				}
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in mistralModels) {
			const id = modelId
			return { id, info: mistralModels[id] }
		}
		return {
			id: mistralDefaultModelId,
			info: mistralModels[mistralDefaultModelId],
		}
	}
}
//# sourceMappingURL=mistral.js.map
