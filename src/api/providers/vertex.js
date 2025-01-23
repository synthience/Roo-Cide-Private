import { AnthropicVertex } from "@anthropic-ai/vertex-sdk"
import { vertexDefaultModelId, vertexModels } from "../../shared/api"
// https://docs.anthropic.com/en/api/claude-on-vertex-ai
export class VertexHandler {
	options
	client
	constructor(options) {
		this.options = options
		this.client = new AnthropicVertex({
			projectId: this.options.vertexProjectId,
			// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude#regions
			region: this.options.vertexRegion,
		})
	}
	async *createMessage(systemPrompt, messages) {
		const stream = await this.client.messages.create({
			model: this.getModel().id,
			max_tokens: this.getModel().info.maxTokens || 8192,
			temperature: 0,
			system: systemPrompt,
			messages,
			stream: true,
		})
		for await (const chunk of stream) {
			switch (chunk.type) {
				case "message_start":
					const usage = chunk.message.usage
					yield {
						type: "usage",
						inputTokens: usage.input_tokens || 0,
						outputTokens: usage.output_tokens || 0,
					}
					break
				case "message_delta":
					yield {
						type: "usage",
						inputTokens: 0,
						outputTokens: chunk.usage.output_tokens || 0,
					}
					break
				case "content_block_start":
					switch (chunk.content_block.type) {
						case "text":
							if (chunk.index > 0) {
								yield {
									type: "text",
									text: "\n",
								}
							}
							yield {
								type: "text",
								text: chunk.content_block.text,
							}
							break
					}
					break
				case "content_block_delta":
					switch (chunk.delta.type) {
						case "text_delta":
							yield {
								type: "text",
								text: chunk.delta.text,
							}
							break
					}
					break
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in vertexModels) {
			const id = modelId
			return { id, info: vertexModels[id] }
		}
		return { id: vertexDefaultModelId, info: vertexModels[vertexDefaultModelId] }
	}
	async completePrompt(prompt) {
		try {
			const response = await this.client.messages.create({
				model: this.getModel().id,
				max_tokens: this.getModel().info.maxTokens || 8192,
				temperature: 0,
				messages: [{ role: "user", content: prompt }],
				stream: false,
			})
			const content = response.content[0]
			if (content.type === "text") {
				return content.text
			}
			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Vertex completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=vertex.js.map
