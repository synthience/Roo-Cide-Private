import { OpenRouterHandler } from "../openrouter"
import OpenAI from "openai"
import axios from "axios"
// Mock dependencies
jest.mock("openai")
jest.mock("axios")
jest.mock("delay", () => jest.fn(() => Promise.resolve()))
describe("OpenRouterHandler", () => {
	const mockOptions = {
		openRouterApiKey: "test-key",
		openRouterModelId: "test-model",
		openRouterModelInfo: {
			name: "Test Model",
			description: "Test Description",
			maxTokens: 1000,
			contextWindow: 2000,
			supportsPromptCache: true,
			inputPrice: 0.01,
			outputPrice: 0.02,
		},
	}
	beforeEach(() => {
		jest.clearAllMocks()
	})
	test("constructor initializes with correct options", () => {
		const handler = new OpenRouterHandler(mockOptions)
		expect(handler).toBeInstanceOf(OpenRouterHandler)
		expect(OpenAI).toHaveBeenCalledWith({
			baseURL: "https://openrouter.ai/api/v1",
			apiKey: mockOptions.openRouterApiKey,
			defaultHeaders: {
				"HTTP-Referer": "https://github.com/RooVetGit/Roo-Cline",
				"X-Title": "Roo-Code",
			},
		})
	})
	test("getModel returns correct model info when options are provided", () => {
		const handler = new OpenRouterHandler(mockOptions)
		const result = handler.getModel()
		expect(result).toEqual({
			id: mockOptions.openRouterModelId,
			info: mockOptions.openRouterModelInfo,
		})
	})
	test("getModel returns default model info when options are not provided", () => {
		const handler = new OpenRouterHandler({})
		const result = handler.getModel()
		expect(result.id).toBe("anthropic/claude-3.5-sonnet:beta")
		expect(result.info.supportsPromptCache).toBe(true)
	})
	test("createMessage generates correct stream chunks", async () => {
		const handler = new OpenRouterHandler(mockOptions)
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					id: "test-id",
					choices: [
						{
							delta: {
								content: "test response",
							},
						},
					],
				}
			},
		}
		// Mock OpenAI chat.completions.create
		const mockCreate = jest.fn().mockResolvedValue(mockStream)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		axios.get.mockResolvedValue({
			data: {
				data: {
					native_tokens_prompt: 10,
					native_tokens_completion: 20,
					total_cost: 0.001,
				},
			},
		})
		const systemPrompt = "test system prompt"
		const messages = [{ role: "user", content: "test message" }]
		const generator = handler.createMessage(systemPrompt, messages)
		const chunks = []
		for await (const chunk of generator) {
			chunks.push(chunk)
		}
		// Verify stream chunks
		expect(chunks).toHaveLength(2) // One text chunk and one usage chunk
		expect(chunks[0]).toEqual({
			type: "text",
			text: "test response",
		})
		expect(chunks[1]).toEqual({
			type: "usage",
			inputTokens: 10,
			outputTokens: 20,
			totalCost: 0.001,
			fullResponseText: "test response",
		})
		// Verify OpenAI client was called with correct parameters
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				model: mockOptions.openRouterModelId,
				temperature: 0,
				messages: expect.arrayContaining([
					{ role: "system", content: systemPrompt },
					{ role: "user", content: "test message" },
				]),
				stream: true,
			}),
		)
	})
	test("createMessage with middle-out transform enabled", async () => {
		const handler = new OpenRouterHandler({
			...mockOptions,
			openRouterUseMiddleOutTransform: true,
		})
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					id: "test-id",
					choices: [
						{
							delta: {
								content: "test response",
							},
						},
					],
				}
			},
		}
		const mockCreate = jest.fn().mockResolvedValue(mockStream)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		axios.get.mockResolvedValue({ data: { data: {} } })
		await handler.createMessage("test", []).next()
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				transforms: ["middle-out"],
			}),
		)
	})
	test("createMessage with Claude model adds cache control", async () => {
		const handler = new OpenRouterHandler({
			...mockOptions,
			openRouterModelId: "anthropic/claude-3.5-sonnet",
		})
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					id: "test-id",
					choices: [
						{
							delta: {
								content: "test response",
							},
						},
					],
				}
			},
		}
		const mockCreate = jest.fn().mockResolvedValue(mockStream)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		axios.get.mockResolvedValue({ data: { data: {} } })
		const messages = [
			{ role: "user", content: "message 1" },
			{ role: "assistant", content: "response 1" },
			{ role: "user", content: "message 2" },
		]
		await handler.createMessage("test system", messages).next()
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({
						role: "system",
						content: expect.arrayContaining([
							expect.objectContaining({
								cache_control: { type: "ephemeral" },
							}),
						]),
					}),
				]),
			}),
		)
	})
	test("createMessage handles API errors", async () => {
		const handler = new OpenRouterHandler(mockOptions)
		const mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					error: {
						message: "API Error",
						code: 500,
					},
				}
			},
		}
		const mockCreate = jest.fn().mockResolvedValue(mockStream)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		const generator = handler.createMessage("test", [])
		await expect(generator.next()).rejects.toThrow("OpenRouter API Error 500: API Error")
	})
	test("completePrompt returns correct response", async () => {
		const handler = new OpenRouterHandler(mockOptions)
		const mockResponse = {
			choices: [
				{
					message: {
						content: "test completion",
					},
				},
			],
		}
		const mockCreate = jest.fn().mockResolvedValue(mockResponse)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		const result = await handler.completePrompt("test prompt")
		expect(result).toBe("test completion")
		expect(mockCreate).toHaveBeenCalledWith({
			model: mockOptions.openRouterModelId,
			messages: [{ role: "user", content: "test prompt" }],
			temperature: 0,
			stream: false,
		})
	})
	test("completePrompt handles API errors", async () => {
		const handler = new OpenRouterHandler(mockOptions)
		const mockError = {
			error: {
				message: "API Error",
				code: 500,
			},
		}
		const mockCreate = jest.fn().mockResolvedValue(mockError)
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		await expect(handler.completePrompt("test prompt")).rejects.toThrow("OpenRouter API Error 500: API Error")
	})
	test("completePrompt handles unexpected errors", async () => {
		const handler = new OpenRouterHandler(mockOptions)
		const mockCreate = jest.fn().mockRejectedValue(new Error("Unexpected error"))
		OpenAI.prototype.chat = {
			completions: { create: mockCreate },
		}
		await expect(handler.completePrompt("test prompt")).rejects.toThrow(
			"OpenRouter completion error: Unexpected error",
		)
	})
})
//# sourceMappingURL=openrouter.test.js.map
