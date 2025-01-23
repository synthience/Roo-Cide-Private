import { SchemaType } from "@google/generative-ai"
export function convertAnthropicContentToGemini(content) {
	if (typeof content === "string") {
		return [{ text: content }]
	}
	return content.flatMap((block) => {
		switch (block.type) {
			case "text":
				return { text: block.text }
			case "image":
				if (block.source.type !== "base64") {
					throw new Error("Unsupported image source type")
				}
				return {
					inlineData: {
						data: block.source.data,
						mimeType: block.source.media_type,
					},
				}
			case "tool_use":
				return {
					functionCall: {
						name: block.name,
						args: block.input,
					},
				}
			case "tool_result":
				const name = block.tool_use_id.split("-")[0]
				if (!block.content) {
					return []
				}
				if (typeof block.content === "string") {
					return {
						functionResponse: {
							name,
							response: {
								name,
								content: block.content,
							},
						},
					}
				} else {
					// The only case when tool_result could be array is when the tool failed and we're providing ie user feedback potentially with images
					const textParts = block.content.filter((part) => part.type === "text")
					const imageParts = block.content.filter((part) => part.type === "image")
					const text = textParts.length > 0 ? textParts.map((part) => part.text).join("\n\n") : ""
					const imageText = imageParts.length > 0 ? "\n\n(See next part for image)" : ""
					return [
						{
							functionResponse: {
								name,
								response: {
									name,
									content: text + imageText,
								},
							},
						},
						...imageParts.map((part) => ({
							inlineData: {
								data: part.source.data,
								mimeType: part.source.media_type,
							},
						})),
					]
				}
			default:
				throw new Error(`Unsupported content block type: ${block.type}`)
		}
	})
}
export function convertAnthropicMessageToGemini(message) {
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGemini(message.content),
	}
}
export function convertAnthropicToolToGemini(tool) {
	return {
		name: tool.name,
		description: tool.description || "",
		parameters: {
			type: SchemaType.OBJECT,
			properties: Object.fromEntries(
				Object.entries(tool.input_schema.properties || {}).map(([key, value]) => [
					key,
					{
						type: value.type.toUpperCase(),
						description: value.description || "",
					},
				]),
			),
			required: tool.input_schema.required || [],
		},
	}
}
/*
It looks like gemini likes to double escape certain characters when writing file contents: https://discuss.ai.google.dev/t/function-call-string-property-is-double-escaped/37867
*/
export function unescapeGeminiContent(content) {
	return content
		.replace(/\\n/g, "\n")
		.replace(/\\'/g, "'")
		.replace(/\\"/g, '"')
		.replace(/\\r/g, "\r")
		.replace(/\\t/g, "\t")
}
export function convertGeminiResponseToAnthropic(response) {
	const content = []
	// Add the main text response
	const text = response.text()
	if (text) {
		content.push({ type: "text", text })
	}
	// Add function calls as tool_use blocks
	const functionCalls = response.functionCalls()
	if (functionCalls) {
		functionCalls.forEach((call, index) => {
			if ("content" in call.args && typeof call.args.content === "string") {
				call.args.content = unescapeGeminiContent(call.args.content)
			}
			content.push({
				type: "tool_use",
				id: `${call.name}-${index}-${Date.now()}`,
				name: call.name,
				input: call.args,
			})
		})
	}
	// Determine stop reason
	let stop_reason = null
	const finishReason = response.candidates?.[0]?.finishReason
	if (finishReason) {
		switch (finishReason) {
			case "STOP":
				stop_reason = "end_turn"
				break
			case "MAX_TOKENS":
				stop_reason = "max_tokens"
				break
			case "SAFETY":
			case "RECITATION":
			case "OTHER":
				stop_reason = "stop_sequence"
				break
			// Add more cases if needed
		}
	}
	return {
		id: `msg_${Date.now()}`, // Generate a unique ID
		type: "message",
		role: "assistant",
		content,
		model: "",
		stop_reason,
		stop_sequence: null, // Gemini doesn't provide this information
		usage: {
			input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
			output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
		},
	}
}
//# sourceMappingURL=gemini-format.js.map
