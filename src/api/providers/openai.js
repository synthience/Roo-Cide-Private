import OpenAI, { AzureOpenAI } from "openai"
import { azureOpenAiDefaultApiVersion, openAiModelInfoSaneDefaults } from "../../shared/api"
import { convertToOpenAiMessages } from "../transform/openai-format"
export class OpenAiHandler {
	options
	client
	constructor(options) {
		this.options = options
		// Azure API shape slightly differs from the core API shape: https://github.com/openai/openai-node?tab=readme-ov-file#microsoft-azure-openai
		const urlHost = new URL(this.options.openAiBaseUrl ?? "").host
		if (urlHost === "azure.com" || urlHost.endsWith(".azure.com")) {
			this.client = new AzureOpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
				apiVersion: this.options.azureApiVersion || azureOpenAiDefaultApiVersion,
			})
		} else {
			this.client = new OpenAI({
				baseURL: this.options.openAiBaseUrl,
				apiKey: this.options.openAiApiKey,
			})
		}
	}
	async *createMessage(systemPrompt, messages) {
		const modelInfo = this.getModel().info
		const modelId = this.options.openAiModelId ?? ""
		const deepseekReasoner = modelId.includes("deepseek-reasoner")
		if (!deepseekReasoner && (this.options.openAiStreamingEnabled ?? true)) {
			const systemMessage = {
				role: "system",
				content: systemPrompt,
			}
			const requestOptions = {
				model: modelId,
				temperature: 0,
				messages: [systemMessage, ...convertToOpenAiMessages(messages)],
				stream: true,
				stream_options: { include_usage: true },
			}
			if (this.options.includeMaxTokens) {
				requestOptions.max_tokens = modelInfo.maxTokens
			}
			const stream = await this.client.chat.completions.create(requestOptions)
			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta
				if (delta?.content) {
					yield {
						type: "text",
						text: delta.content,
					}
				}
				if (chunk.usage) {
					yield {
						type: "usage",
						inputTokens: chunk.usage.prompt_tokens || 0,
						outputTokens: chunk.usage.completion_tokens || 0,
					}
				}
			}
		} else {
			let systemMessage
			// o1 for instance doesnt support streaming, non-1 temp, or system prompt
			// deepseek reasoner supports system prompt
			systemMessage = deepseekReasoner
				? {
						role: "system",
						content: systemPrompt,
					}
				: {
						role: "user",
						content: systemPrompt,
					}
			const requestOptions = {
				model: modelId,
				messages: [systemMessage, ...convertToOpenAiMessages(messages)],
			}
			const response = await this.client.chat.completions.create(requestOptions)
			yield {
				type: "text",
				text: response.choices[0]?.message.content || "",
			}
			yield {
				type: "usage",
				inputTokens: response.usage?.prompt_tokens || 0,
				outputTokens: response.usage?.completion_tokens || 0,
			}
		}
	}
	getModel() {
		return {
			id: this.options.openAiModelId ?? "",
			info: this.options.openAiCustomModelInfo ?? openAiModelInfoSaneDefaults,
		}
	}
	async completePrompt(prompt) {
		try {
			const requestOptions = {
				model: this.getModel().id,
				messages: [{ role: "user", content: prompt }],
			}
			const response = await this.client.chat.completions.create(requestOptions)
			return response.choices[0]?.message.content || ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`OpenAI completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=openai.js.map
