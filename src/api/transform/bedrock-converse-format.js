/**
 * Convert Anthropic messages to Bedrock Converse format
 */
export function convertToBedrockConverseMessages(anthropicMessages) {
	return anthropicMessages.map((anthropicMessage) => {
		// Map Anthropic roles to Bedrock roles
		const role = anthropicMessage.role === "assistant" ? "assistant" : "user"
		if (typeof anthropicMessage.content === "string") {
			return {
				role,
				content: [
					{
						text: anthropicMessage.content,
					},
				],
			}
		}
		// Process complex content types
		const content = anthropicMessage.content.map((block) => {
			const messageBlock = block
			if (messageBlock.type === "text") {
				return {
					text: messageBlock.text || "",
				}
			}
			if (messageBlock.type === "image" && messageBlock.source) {
				// Convert base64 string to byte array if needed
				let byteArray
				if (typeof messageBlock.source.data === "string") {
					const binaryString = atob(messageBlock.source.data)
					byteArray = new Uint8Array(binaryString.length)
					for (let i = 0; i < binaryString.length; i++) {
						byteArray[i] = binaryString.charCodeAt(i)
					}
				} else {
					byteArray = messageBlock.source.data
				}
				// Extract format from media_type (e.g., "image/jpeg" -> "jpeg")
				const format = messageBlock.source.media_type.split("/")[1]
				if (!["png", "jpeg", "gif", "webp"].includes(format)) {
					throw new Error(`Unsupported image format: ${format}`)
				}
				return {
					image: {
						format: format,
						source: {
							bytes: byteArray,
						},
					},
				}
			}
			if (messageBlock.type === "tool_use") {
				// Convert tool use to XML format
				const toolParams = Object.entries(messageBlock.input || {})
					.map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
					.join("\n")
				return {
					toolUse: {
						toolUseId: messageBlock.id || "",
						name: messageBlock.name || "",
						input: `<${messageBlock.name}>\n${toolParams}\n</${messageBlock.name}>`,
					},
				}
			}
			if (messageBlock.type === "tool_result") {
				// First try to use content if available
				if (messageBlock.content && Array.isArray(messageBlock.content)) {
					return {
						toolResult: {
							toolUseId: messageBlock.tool_use_id || "",
							content: messageBlock.content.map((item) => ({
								text: item.text,
							})),
							status: "success",
						},
					}
				}
				// Fall back to output handling if content is not available
				if (messageBlock.output && typeof messageBlock.output === "string") {
					return {
						toolResult: {
							toolUseId: messageBlock.tool_use_id || "",
							content: [
								{
									text: messageBlock.output,
								},
							],
							status: "success",
						},
					}
				}
				// Handle array of content blocks if output is an array
				if (Array.isArray(messageBlock.output)) {
					return {
						toolResult: {
							toolUseId: messageBlock.tool_use_id || "",
							content: messageBlock.output.map((part) => {
								if (typeof part === "object" && "text" in part) {
									return { text: part.text }
								}
								// Skip images in tool results as they're handled separately
								if (typeof part === "object" && "type" in part && part.type === "image") {
									return { text: "(see following message for image)" }
								}
								return { text: String(part) }
							}),
							status: "success",
						},
					}
				}
				// Default case
				return {
					toolResult: {
						toolUseId: messageBlock.tool_use_id || "",
						content: [
							{
								text: String(messageBlock.output || ""),
							},
						],
						status: "success",
					},
				}
			}
			if (messageBlock.type === "video") {
				const videoContent = messageBlock.s3Location
					? {
							s3Location: {
								uri: messageBlock.s3Location.uri,
								bucketOwner: messageBlock.s3Location.bucketOwner,
							},
						}
					: messageBlock.source
				return {
					video: {
						format: "mp4", // Default to mp4, adjust based on actual format if needed
						source: videoContent,
					},
				}
			}
			// Default case for unknown block types
			return {
				text: "[Unknown Block Type]",
			}
		})
		return {
			role,
			content,
		}
	})
}
/**
 * Convert Bedrock Converse stream events to Anthropic message format
 */
export function convertToAnthropicMessage(streamEvent, modelId) {
	// Handle metadata events
	if (streamEvent.metadata?.usage) {
		return {
			id: "", // Bedrock doesn't provide message IDs
			type: "message",
			role: "assistant",
			model: modelId,
			usage: {
				input_tokens: streamEvent.metadata.usage.inputTokens || 0,
				output_tokens: streamEvent.metadata.usage.outputTokens || 0,
			},
		}
	}
	// Handle content blocks
	const text = streamEvent.contentBlockStart?.start?.text || streamEvent.contentBlockDelta?.delta?.text
	if (text !== undefined) {
		return {
			type: "message",
			role: "assistant",
			content: [{ type: "text", text: text }],
			model: modelId,
		}
	}
	// Handle message stop
	if (streamEvent.messageStop) {
		return {
			type: "message",
			role: "assistant",
			stop_reason: streamEvent.messageStop.stopReason || null,
			stop_sequence: null,
			model: modelId,
		}
	}
	return {}
}
//# sourceMappingURL=bedrock-converse-format.js.map
