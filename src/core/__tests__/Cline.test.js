import { Cline } from "../Cline"
import { ClineProvider } from "../webview/ClineProvider"
import * as os from "os"
import * as path from "path"
// Mock all MCP-related modules
jest.mock(
	"@modelcontextprotocol/sdk/types.js",
	() => ({
		CallToolResultSchema: {},
		ListResourcesResultSchema: {},
		ListResourceTemplatesResultSchema: {},
		ListToolsResultSchema: {},
		ReadResourceResultSchema: {},
		ErrorCode: {
			InvalidRequest: "InvalidRequest",
			MethodNotFound: "MethodNotFound",
			InternalError: "InternalError",
		},
		McpError: class McpError extends Error {
			code
			constructor(code, message) {
				super(message)
				this.code = code
				this.name = "McpError"
			}
		},
	}),
	{ virtual: true },
)
jest.mock(
	"@modelcontextprotocol/sdk/client/index.js",
	() => ({
		Client: jest.fn().mockImplementation(() => ({
			connect: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
			listTools: jest.fn().mockResolvedValue({ tools: [] }),
			callTool: jest.fn().mockResolvedValue({ content: [] }),
		})),
	}),
	{ virtual: true },
)
jest.mock(
	"@modelcontextprotocol/sdk/client/stdio.js",
	() => ({
		StdioClientTransport: jest.fn().mockImplementation(() => ({
			connect: jest.fn().mockResolvedValue(undefined),
			close: jest.fn().mockResolvedValue(undefined),
		})),
	}),
	{ virtual: true },
)
// Mock fileExistsAtPath
jest.mock("../../utils/fs", () => ({
	fileExistsAtPath: jest.fn().mockImplementation((filePath) => {
		return filePath.includes("ui_messages.json") || filePath.includes("api_conversation_history.json")
	}),
}))
// Mock fs/promises
const mockMessages = [
	{
		ts: Date.now(),
		type: "say",
		say: "text",
		text: "historical task",
	},
]
jest.mock("fs/promises", () => ({
	mkdir: jest.fn().mockResolvedValue(undefined),
	writeFile: jest.fn().mockResolvedValue(undefined),
	readFile: jest.fn().mockImplementation((filePath) => {
		if (filePath.includes("ui_messages.json")) {
			return Promise.resolve(JSON.stringify(mockMessages))
		}
		if (filePath.includes("api_conversation_history.json")) {
			return Promise.resolve("[]")
		}
		return Promise.resolve("[]")
	}),
	unlink: jest.fn().mockResolvedValue(undefined),
	rmdir: jest.fn().mockResolvedValue(undefined),
}))
// Mock dependencies
jest.mock("vscode", () => {
	const mockDisposable = { dispose: jest.fn() }
	const mockEventEmitter = {
		event: jest.fn(),
		fire: jest.fn(),
	}
	const mockTextDocument = {
		uri: {
			fsPath: "/mock/workspace/path/file.ts",
		},
	}
	const mockTextEditor = {
		document: mockTextDocument,
	}
	const mockTab = {
		input: {
			uri: {
				fsPath: "/mock/workspace/path/file.ts",
			},
		},
	}
	const mockTabGroup = {
		tabs: [mockTab],
	}
	return {
		window: {
			createTextEditorDecorationType: jest.fn().mockReturnValue({
				dispose: jest.fn(),
			}),
			visibleTextEditors: [mockTextEditor],
			tabGroups: {
				all: [mockTabGroup],
			},
		},
		workspace: {
			workspaceFolders: [
				{
					uri: {
						fsPath: "/mock/workspace/path",
					},
					name: "mock-workspace",
					index: 0,
				},
			],
			createFileSystemWatcher: jest.fn(() => ({
				onDidCreate: jest.fn(() => mockDisposable),
				onDidDelete: jest.fn(() => mockDisposable),
				onDidChange: jest.fn(() => mockDisposable),
				dispose: jest.fn(),
			})),
			fs: {
				stat: jest.fn().mockResolvedValue({ type: 1 }), // FileType.File = 1
			},
			onDidSaveTextDocument: jest.fn(() => mockDisposable),
		},
		env: {
			uriScheme: "vscode",
			language: "en",
		},
		EventEmitter: jest.fn().mockImplementation(() => mockEventEmitter),
		Disposable: {
			from: jest.fn(),
		},
		TabInputText: jest.fn(),
	}
})
// Mock p-wait-for to resolve immediately
jest.mock("p-wait-for", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(async () => Promise.resolve()),
}))
jest.mock("delay", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation(async () => Promise.resolve()),
}))
jest.mock("serialize-error", () => ({
	__esModule: true,
	serializeError: jest.fn().mockImplementation((error) => ({
		name: error.name,
		message: error.message,
		stack: error.stack,
	})),
}))
jest.mock("strip-ansi", () => ({
	__esModule: true,
	default: jest.fn().mockImplementation((str) => str.replace(/\u001B\[\d+m/g, "")),
}))
jest.mock("globby", () => ({
	__esModule: true,
	globby: jest.fn().mockImplementation(async () => []),
}))
jest.mock("os-name", () => ({
	__esModule: true,
	default: jest.fn().mockReturnValue("Mock OS Name"),
}))
jest.mock("default-shell", () => ({
	__esModule: true,
	default: "/bin/bash", // Mock default shell path
}))
describe("Cline", () => {
	let mockProvider
	let mockApiConfig
	let mockOutputChannel
	let mockExtensionContext
	beforeEach(() => {
		// Setup mock extension context
		const storageUri = {
			fsPath: path.join(os.tmpdir(), "test-storage"),
		}
		mockExtensionContext = {
			globalState: {
				get: jest.fn().mockImplementation((key) => {
					if (key === "taskHistory") {
						return [
							{
								id: "123",
								ts: Date.now(),
								task: "historical task",
								tokensIn: 100,
								tokensOut: 200,
								cacheWrites: 0,
								cacheReads: 0,
								totalCost: 0.001,
							},
						]
					}
					return undefined
				}),
				update: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				keys: jest.fn().mockReturnValue([]),
			},
			globalStorageUri: storageUri,
			workspaceState: {
				get: jest.fn().mockImplementation((key) => undefined),
				update: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				keys: jest.fn().mockReturnValue([]),
			},
			secrets: {
				get: jest.fn().mockImplementation((key) => Promise.resolve(undefined)),
				store: jest.fn().mockImplementation((key, value) => Promise.resolve()),
				delete: jest.fn().mockImplementation((key) => Promise.resolve()),
			},
			extensionUri: {
				fsPath: "/mock/extension/path",
			},
			extension: {
				packageJSON: {
					version: "1.0.0",
				},
			},
		}
		// Setup mock output channel
		mockOutputChannel = {
			appendLine: jest.fn(),
			append: jest.fn(),
			clear: jest.fn(),
			show: jest.fn(),
			hide: jest.fn(),
			dispose: jest.fn(),
		}
		// Setup mock provider with output channel
		mockProvider = new ClineProvider(mockExtensionContext, mockOutputChannel)
		// Setup mock API configuration
		mockApiConfig = {
			apiProvider: "anthropic",
			apiModelId: "claude-3-5-sonnet-20241022",
			apiKey: "test-api-key", // Add API key to mock config
		}
		// Mock provider methods
		mockProvider.postMessageToWebview = jest.fn().mockResolvedValue(undefined)
		mockProvider.postStateToWebview = jest.fn().mockResolvedValue(undefined)
		mockProvider.getTaskWithId = jest.fn().mockImplementation(async (id) => ({
			historyItem: {
				id,
				ts: Date.now(),
				task: "historical task",
				tokensIn: 100,
				tokensOut: 200,
				cacheWrites: 0,
				cacheReads: 0,
				totalCost: 0.001,
			},
			taskDirPath: "/mock/storage/path/tasks/123",
			apiConversationHistoryFilePath: "/mock/storage/path/tasks/123/api_conversation_history.json",
			uiMessagesFilePath: "/mock/storage/path/tasks/123/ui_messages.json",
			apiConversationHistory: [],
		}))
	})
	describe("constructor", () => {
		it("should respect provided settings", () => {
			const cline = new Cline(
				mockProvider,
				mockApiConfig,
				"custom instructions",
				false,
				0.95, // 95% threshold
				"test task",
			)
			expect(cline.customInstructions).toBe("custom instructions")
			expect(cline.diffEnabled).toBe(false)
		})
		it("should use default fuzzy match threshold when not provided", () => {
			const cline = new Cline(mockProvider, mockApiConfig, "custom instructions", true, undefined, "test task")
			expect(cline.diffEnabled).toBe(true)
			// The diff strategy should be created with default threshold (1.0)
			expect(cline.diffStrategy).toBeDefined()
		})
		it("should use provided fuzzy match threshold", () => {
			const getDiffStrategySpy = jest.spyOn(require("../diff/DiffStrategy"), "getDiffStrategy")
			const cline = new Cline(
				mockProvider,
				mockApiConfig,
				"custom instructions",
				true,
				0.9, // 90% threshold
				"test task",
			)
			expect(cline.diffEnabled).toBe(true)
			expect(cline.diffStrategy).toBeDefined()
			expect(getDiffStrategySpy).toHaveBeenCalledWith("claude-3-5-sonnet-20241022", 0.9, false)
			getDiffStrategySpy.mockRestore()
		})
		it("should pass default threshold to diff strategy when not provided", () => {
			const getDiffStrategySpy = jest.spyOn(require("../diff/DiffStrategy"), "getDiffStrategy")
			const cline = new Cline(mockProvider, mockApiConfig, "custom instructions", true, undefined, "test task")
			expect(cline.diffEnabled).toBe(true)
			expect(cline.diffStrategy).toBeDefined()
			expect(getDiffStrategySpy).toHaveBeenCalledWith("claude-3-5-sonnet-20241022", 1.0, false)
			getDiffStrategySpy.mockRestore()
		})
		it("should require either task or historyItem", () => {
			expect(() => {
				new Cline(
					mockProvider,
					mockApiConfig,
					undefined, // customInstructions
					false, // diffEnabled
					undefined, // fuzzyMatchThreshold
					undefined,
				)
			}).toThrow("Either historyItem or task/images must be provided")
		})
	})
	describe("getEnvironmentDetails", () => {
		let originalDate
		let mockDate
		beforeEach(() => {
			originalDate = global.Date
			const fixedTime = new Date("2024-01-01T12:00:00Z")
			mockDate = new Date(fixedTime)
			mockDate.getTimezoneOffset = jest.fn().mockReturnValue(420) // UTC-7
			class MockDate extends Date {
				constructor() {
					super()
					return mockDate
				}
				static now() {
					return mockDate.getTime()
				}
			}
			global.Date = MockDate
			// Create a proper mock of Intl.DateTimeFormat
			const mockDateTimeFormat = {
				resolvedOptions: () => ({
					timeZone: "America/Los_Angeles",
				}),
				format: () => "1/1/2024, 5:00:00 AM",
			}
			const MockDateTimeFormat = function () {
				return mockDateTimeFormat
			}
			MockDateTimeFormat.prototype = mockDateTimeFormat
			MockDateTimeFormat.supportedLocalesOf = jest.fn().mockReturnValue(["en-US"])
			global.Intl.DateTimeFormat = MockDateTimeFormat
		})
		afterEach(() => {
			global.Date = originalDate
		})
		it("should include timezone information in environment details", async () => {
			const cline = new Cline(mockProvider, mockApiConfig, undefined, false, undefined, "test task")
			const details = await cline["getEnvironmentDetails"](false)
			// Verify timezone information is present and formatted correctly
			expect(details).toContain("America/Los_Angeles")
			expect(details).toMatch(/UTC-7:00/) // Fixed offset for America/Los_Angeles
			expect(details).toContain("# Current Time")
			expect(details).toMatch(/1\/1\/2024.*5:00:00 AM.*\(America\/Los_Angeles, UTC-7:00\)/) // Full time string format
		})
		describe("API conversation handling", () => {
			it("should clean conversation history before sending to API", async () => {
				const cline = new Cline(mockProvider, mockApiConfig, undefined, false, undefined, "test task")
				// Mock the API's createMessage method to capture the conversation history
				const createMessageSpy = jest.fn()
				// Set up mock stream
				const mockStreamForClean = (async function* () {
					yield { type: "text", text: "test response" }
				})()
				// Set up spy
				const cleanMessageSpy = jest.fn().mockReturnValue(mockStreamForClean)
				jest.spyOn(cline.api, "createMessage").mockImplementation(cleanMessageSpy)
				// Mock getEnvironmentDetails to return empty details
				jest.spyOn(cline, "getEnvironmentDetails").mockResolvedValue("")
				// Mock loadContext to return unmodified content
				jest.spyOn(cline, "loadContext").mockImplementation(async (content) => [content, ""])
				// Add test message to conversation history
				cline.apiConversationHistory = [
					{
						role: "user",
						content: [{ type: "text", text: "test message" }],
						ts: Date.now(),
					},
				]
				// Mock abort state
				Object.defineProperty(cline, "abort", {
					get: () => false,
					configurable: true,
				})
				// Add a message with extra properties to the conversation history
				const messageWithExtra = {
					role: "user",
					content: [{ type: "text", text: "test message" }],
					ts: Date.now(),
					extraProp: "should be removed",
				}
				cline.apiConversationHistory = [messageWithExtra]
				// Trigger an API request
				await cline.recursivelyMakeClineRequests([{ type: "text", text: "test request" }], false)
				// Get the conversation history from the first API call
				const history = cleanMessageSpy.mock.calls[0][1]
				expect(history).toBeDefined()
				expect(history.length).toBeGreaterThan(0)
				// Find our test message
				const cleanedMessage = history.find((msg) =>
					msg.content?.some((content) => content.text === "test message"),
				)
				expect(cleanedMessage).toBeDefined()
				expect(cleanedMessage).toEqual({
					role: "user",
					content: [{ type: "text", text: "test message" }],
				})
				// Verify extra properties were removed
				expect(Object.keys(cleanedMessage)).toEqual(["role", "content"])
			})
			it("should handle image blocks based on model capabilities", async () => {
				// Create two configurations - one with image support, one without
				const configWithImages = {
					...mockApiConfig,
					apiModelId: "claude-3-sonnet",
				}
				const configWithoutImages = {
					...mockApiConfig,
					apiModelId: "gpt-3.5-turbo",
				}
				// Create test conversation history with mixed content
				const conversationHistory = [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Here is an image",
							},
							{
								type: "image",
								source: {
									type: "base64",
									media_type: "image/jpeg",
									data: "base64data",
								},
							},
						],
					},
					{
						role: "assistant",
						content: [
							{
								type: "text",
								text: "I see the image",
							},
						],
					},
				]
				// Test with model that supports images
				const clineWithImages = new Cline(
					mockProvider,
					configWithImages,
					undefined,
					false,
					undefined,
					"test task",
				)
				// Mock the model info to indicate image support
				jest.spyOn(clineWithImages.api, "getModel").mockReturnValue({
					id: "claude-3-sonnet",
					info: {
						supportsImages: true,
						supportsPromptCache: true,
						supportsComputerUse: true,
						contextWindow: 200000,
						maxTokens: 4096,
						inputPrice: 0.25,
						outputPrice: 0.75,
					},
				})
				clineWithImages.apiConversationHistory = conversationHistory
				// Test with model that doesn't support images
				const clineWithoutImages = new Cline(
					mockProvider,
					configWithoutImages,
					undefined,
					false,
					undefined,
					"test task",
				)
				// Mock the model info to indicate no image support
				jest.spyOn(clineWithoutImages.api, "getModel").mockReturnValue({
					id: "gpt-3.5-turbo",
					info: {
						supportsImages: false,
						supportsPromptCache: false,
						supportsComputerUse: false,
						contextWindow: 16000,
						maxTokens: 2048,
						inputPrice: 0.1,
						outputPrice: 0.2,
					},
				})
				clineWithoutImages.apiConversationHistory = conversationHistory
				// Mock abort state for both instances
				Object.defineProperty(clineWithImages, "abort", {
					get: () => false,
					configurable: true,
				})
				Object.defineProperty(clineWithoutImages, "abort", {
					get: () => false,
					configurable: true,
				})
				// Mock environment details and context loading
				jest.spyOn(clineWithImages, "getEnvironmentDetails").mockResolvedValue("")
				jest.spyOn(clineWithoutImages, "getEnvironmentDetails").mockResolvedValue("")
				jest.spyOn(clineWithImages, "loadContext").mockImplementation(async (content) => [content, ""])
				jest.spyOn(clineWithoutImages, "loadContext").mockImplementation(async (content) => [content, ""])
				// Set up mock streams
				const mockStreamWithImages = (async function* () {
					yield { type: "text", text: "test response" }
				})()
				const mockStreamWithoutImages = (async function* () {
					yield { type: "text", text: "test response" }
				})()
				// Set up spies
				const imagesSpy = jest.fn().mockReturnValue(mockStreamWithImages)
				const noImagesSpy = jest.fn().mockReturnValue(mockStreamWithoutImages)
				jest.spyOn(clineWithImages.api, "createMessage").mockImplementation(imagesSpy)
				jest.spyOn(clineWithoutImages.api, "createMessage").mockImplementation(noImagesSpy)
				// Set up conversation history with images
				clineWithImages.apiConversationHistory = [
					{
						role: "user",
						content: [
							{ type: "text", text: "Here is an image" },
							{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "base64data" } },
						],
					},
				]
				// Trigger API requests
				await clineWithImages.recursivelyMakeClineRequests([{ type: "text", text: "test request" }])
				await clineWithoutImages.recursivelyMakeClineRequests([{ type: "text", text: "test request" }])
				// Get the calls
				const imagesCalls = imagesSpy.mock.calls
				const noImagesCalls = noImagesSpy.mock.calls
				// Verify model with image support preserves image blocks
				expect(imagesCalls[0][1][0].content).toHaveLength(2)
				expect(imagesCalls[0][1][0].content[0]).toEqual({ type: "text", text: "Here is an image" })
				expect(imagesCalls[0][1][0].content[1]).toHaveProperty("type", "image")
				// Verify model without image support converts image blocks to text
				expect(noImagesCalls[0][1][0].content).toHaveLength(2)
				expect(noImagesCalls[0][1][0].content[0]).toEqual({ type: "text", text: "Here is an image" })
				expect(noImagesCalls[0][1][0].content[1]).toEqual({
					type: "text",
					text: "[Referenced image in conversation]",
				})
			})
			it("should handle API retry with countdown", async () => {
				const cline = new Cline(mockProvider, mockApiConfig, undefined, false, undefined, "test task")
				// Mock delay to track countdown timing
				const mockDelay = jest.fn().mockResolvedValue(undefined)
				jest.spyOn(require("delay"), "default").mockImplementation(mockDelay)
				// Mock say to track messages
				const saySpy = jest.spyOn(cline, "say")
				// Create a stream that fails on first chunk
				const mockError = new Error("API Error")
				const mockFailedStream = {
					async *[Symbol.asyncIterator]() {
						throw mockError
					},
					async next() {
						throw mockError
					},
					async return() {
						return { done: true, value: undefined }
					},
					async throw(e) {
						throw e
					},
					async [Symbol.asyncDispose]() {
						// Cleanup
					},
				}
				// Create a successful stream for retry
				const mockSuccessStream = {
					async *[Symbol.asyncIterator]() {
						yield { type: "text", text: "Success" }
					},
					async next() {
						return { done: true, value: { type: "text", text: "Success" } }
					},
					async return() {
						return { done: true, value: undefined }
					},
					async throw(e) {
						throw e
					},
					async [Symbol.asyncDispose]() {
						// Cleanup
					},
				}
				// Mock createMessage to fail first then succeed
				let firstAttempt = true
				jest.spyOn(cline.api, "createMessage").mockImplementation(() => {
					if (firstAttempt) {
						firstAttempt = false
						return mockFailedStream
					}
					return mockSuccessStream
				})
				// Set alwaysApproveResubmit and requestDelaySeconds
				mockProvider.getState = jest.fn().mockResolvedValue({
					alwaysApproveResubmit: true,
					requestDelaySeconds: 3,
				})
				// Mock previous API request message
				cline.clineMessages = [
					{
						ts: Date.now(),
						type: "say",
						say: "api_req_started",
						text: JSON.stringify({
							tokensIn: 100,
							tokensOut: 50,
							cacheWrites: 0,
							cacheReads: 0,
							request: "test request",
						}),
					},
				]
				// Trigger API request
				const iterator = cline.attemptApiRequest(0)
				await iterator.next()
				// Verify countdown messages
				expect(saySpy).toHaveBeenCalledWith(
					"api_req_retry_delayed",
					expect.stringContaining("Retrying in 3 seconds"),
					undefined,
					true,
				)
				expect(saySpy).toHaveBeenCalledWith(
					"api_req_retry_delayed",
					expect.stringContaining("Retrying in 2 seconds"),
					undefined,
					true,
				)
				expect(saySpy).toHaveBeenCalledWith(
					"api_req_retry_delayed",
					expect.stringContaining("Retrying in 1 seconds"),
					undefined,
					true,
				)
				expect(saySpy).toHaveBeenCalledWith(
					"api_req_retry_delayed",
					expect.stringContaining("Retrying now"),
					undefined,
					false,
				)
				// Verify delay was called correctly
				expect(mockDelay).toHaveBeenCalledTimes(3)
				expect(mockDelay).toHaveBeenCalledWith(1000)
				// Verify error message content
				const errorMessage = saySpy.mock.calls.find((call) => call[1]?.includes(mockError.message))?.[1]
				expect(errorMessage).toBe(`${mockError.message}\n\nRetrying in 3 seconds...`)
			})
			describe("loadContext", () => {
				it("should process mentions in task and feedback tags", async () => {
					const cline = new Cline(mockProvider, mockApiConfig, undefined, false, undefined, "test task")
					// Mock parseMentions to track calls
					const mockParseMentions = jest.fn().mockImplementation((text) => `processed: ${text}`)
					jest.spyOn(require("../../core/mentions"), "parseMentions").mockImplementation(mockParseMentions)
					const userContent = [
						{
							type: "text",
							text: "Regular text with @/some/path",
						},
						{
							type: "text",
							text: "<task>Text with @/some/path in task tags</task>",
						},
						{
							type: "tool_result",
							tool_use_id: "test-id",
							content: [
								{
									type: "text",
									text: "<feedback>Check @/some/path</feedback>",
								},
							],
						},
						{
							type: "tool_result",
							tool_use_id: "test-id-2",
							content: [
								{
									type: "text",
									text: "Regular tool result with @/path",
								},
							],
						},
					]
					// Process the content
					const [processedContent] = await cline["loadContext"](userContent)
					// Regular text should not be processed
					expect(processedContent[0].text).toBe("Regular text with @/some/path")
					// Text within task tags should be processed
					expect(processedContent[1].text).toContain("processed:")
					expect(mockParseMentions).toHaveBeenCalledWith(
						"<task>Text with @/some/path in task tags</task>",
						expect.any(String),
						expect.any(Object),
					)
					// Feedback tag content should be processed
					const toolResult1 = processedContent[2]
					const content1 = Array.isArray(toolResult1.content) ? toolResult1.content[0] : toolResult1.content
					expect(content1.text).toContain("processed:")
					expect(mockParseMentions).toHaveBeenCalledWith(
						"<feedback>Check @/some/path</feedback>",
						expect.any(String),
						expect.any(Object),
					)
					// Regular tool result should not be processed
					const toolResult2 = processedContent[3]
					const content2 = Array.isArray(toolResult2.content) ? toolResult2.content[0] : toolResult2.content
					expect(content2.text).toBe("Regular tool result with @/path")
				})
			})
		})
	})
})
//# sourceMappingURL=Cline.test.js.map
