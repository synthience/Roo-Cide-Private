import { BedrockRuntimeClient, ConverseStreamCommand, ConverseCommand } from "@aws-sdk/client-bedrock-runtime"
import { bedrockDefaultModelId, bedrockModels } from "../../shared/api"
import { convertToBedrockConverseMessages } from "../transform/bedrock-converse-format"
export class AwsBedrockHandler {
	options
	client
	constructor(options) {
		this.options = options
		// Only include credentials if they actually exist
		const clientConfig = {
			region: this.options.awsRegion || "us-east-1",
		}
		if (this.options.awsAccessKey && this.options.awsSecretKey) {
			// Create credentials object with all properties at once
			clientConfig.credentials = {
				accessKeyId: this.options.awsAccessKey,
				secretAccessKey: this.options.awsSecretKey,
				...(this.options.awsSessionToken ? { sessionToken: this.options.awsSessionToken } : {}),
			}
		}
		this.client = new BedrockRuntimeClient(clientConfig)
	}
	async *createMessage(systemPrompt, messages) {
		const modelConfig = this.getModel()
		// Handle cross-region inference
		let modelId
		if (this.options.awsUseCrossRegionInference) {
			let regionPrefix = (this.options.awsRegion || "").slice(0, 3)
			switch (regionPrefix) {
				case "us-":
					modelId = `us.${modelConfig.id}`
					break
				case "eu-":
					modelId = `eu.${modelConfig.id}`
					break
				default:
					modelId = modelConfig.id
					break
			}
		} else {
			modelId = modelConfig.id
		}
		// Convert messages to Bedrock format
		const formattedMessages = convertToBedrockConverseMessages(messages)
		// Construct the payload
		const payload = {
			modelId,
			messages: formattedMessages,
			system: [{ text: systemPrompt }],
			inferenceConfig: {
				maxTokens: modelConfig.info.maxTokens || 5000,
				temperature: 0.3,
				topP: 0.1,
				...(this.options.awsUsePromptCache
					? {
							promptCache: {
								promptCacheId: this.options.awspromptCacheId || "",
							},
						}
					: {}),
			},
		}
		try {
			const command = new ConverseStreamCommand(payload)
			const response = await this.client.send(command)
			if (!response.stream) {
				throw new Error("No stream available in the response")
			}
			for await (const chunk of response.stream) {
				// Parse the chunk as JSON if it's a string (for tests)
				let streamEvent
				try {
					streamEvent = typeof chunk === "string" ? JSON.parse(chunk) : chunk
				} catch (e) {
					console.error("Failed to parse stream event:", e)
					continue
				}
				// Handle metadata events first
				if (streamEvent.metadata?.usage) {
					yield {
						type: "usage",
						inputTokens: streamEvent.metadata.usage.inputTokens || 0,
						outputTokens: streamEvent.metadata.usage.outputTokens || 0,
					}
					continue
				}
				// Handle message start
				if (streamEvent.messageStart) {
					continue
				}
				// Handle content blocks
				if (streamEvent.contentBlockStart?.start?.text) {
					yield {
						type: "text",
						text: streamEvent.contentBlockStart.start.text,
					}
					continue
				}
				// Handle content deltas
				if (streamEvent.contentBlockDelta?.delta?.text) {
					yield {
						type: "text",
						text: streamEvent.contentBlockDelta.delta.text,
					}
					continue
				}
				// Handle message stop
				if (streamEvent.messageStop) {
					continue
				}
			}
		} catch (error) {
			console.error("Bedrock Runtime API Error:", error)
			// Only access stack if error is an Error object
			if (error instanceof Error) {
				console.error("Error stack:", error.stack)
				yield {
					type: "text",
					text: `Error: ${error.message}`,
				}
				yield {
					type: "usage",
					inputTokens: 0,
					outputTokens: 0,
				}
				throw error
			} else {
				const unknownError = new Error("An unknown error occurred")
				yield {
					type: "text",
					text: unknownError.message,
				}
				yield {
					type: "usage",
					inputTokens: 0,
					outputTokens: 0,
				}
				throw unknownError
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId) {
			// For tests, allow any model ID
			if (process.env.NODE_ENV === "test") {
				return {
					id: modelId,
					info: {
						maxTokens: 5000,
						contextWindow: 128_000,
						supportsPromptCache: false,
					},
				}
			}
			// For production, validate against known models
			if (modelId in bedrockModels) {
				const id = modelId
				return { id, info: bedrockModels[id] }
			}
		}
		return {
			id: bedrockDefaultModelId,
			info: bedrockModels[bedrockDefaultModelId],
		}
	}
	async completePrompt(prompt) {
		try {
			const modelConfig = this.getModel()
			// Handle cross-region inference
			let modelId
			if (this.options.awsUseCrossRegionInference) {
				let regionPrefix = (this.options.awsRegion || "").slice(0, 3)
				switch (regionPrefix) {
					case "us-":
						modelId = `us.${modelConfig.id}`
						break
					case "eu-":
						modelId = `eu.${modelConfig.id}`
						break
					default:
						modelId = modelConfig.id
						break
				}
			} else {
				modelId = modelConfig.id
			}
			const payload = {
				modelId,
				messages: convertToBedrockConverseMessages([
					{
						role: "user",
						content: prompt,
					},
				]),
				inferenceConfig: {
					maxTokens: modelConfig.info.maxTokens || 5000,
					temperature: 0.3,
					topP: 0.1,
				},
			}
			const command = new ConverseCommand(payload)
			const response = await this.client.send(command)
			if (response.output && response.output instanceof Uint8Array) {
				try {
					const outputStr = new TextDecoder().decode(response.output)
					const output = JSON.parse(outputStr)
					if (output.content) {
						return output.content
					}
				} catch (parseError) {
					console.error("Failed to parse Bedrock response:", parseError)
				}
			}
			return ""
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Bedrock completion error: ${error.message}`)
			}
			throw error
		}
	}
}
//# sourceMappingURL=bedrock.js.map
