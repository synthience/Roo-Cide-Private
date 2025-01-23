const vscode = require("vscode")
const fs = require("fs/promises")
const { McpHub } = require("../McpHub")
jest.mock("vscode")
jest.mock("fs/promises")
jest.mock("../../../core/webview/ClineProvider")
describe("McpHub", () => {
	let mcpHub
	let mockProvider
	const mockSettingsPath = "/mock/settings/path/cline_mcp_settings.json"
	beforeEach(() => {
		jest.clearAllMocks()
		const mockUri = {
			scheme: "file",
			authority: "",
			path: "/test/path",
			query: "",
			fragment: "",
			fsPath: "/test/path",
			with: jest.fn(),
			toJSON: jest.fn(),
		}
		mockProvider = {
			ensureSettingsDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			ensureMcpServersDirectoryExists: jest.fn().mockResolvedValue("/mock/settings/path"),
			postMessageToWebview: jest.fn(),
			context: {
				subscriptions: [],
				workspaceState: {},
				globalState: {},
				secrets: {},
				extensionUri: mockUri,
				extensionPath: "/test/path",
				storagePath: "/test/storage",
				globalStoragePath: "/test/global-storage",
				environmentVariableCollection: {},
				extension: {
					id: "test-extension",
					extensionUri: mockUri,
					extensionPath: "/test/path",
					extensionKind: 1,
					isActive: true,
					packageJSON: {
						version: "1.0.0",
					},
					activate: jest.fn(),
					exports: undefined,
				},
				asAbsolutePath: (path) => path,
				storageUri: mockUri,
				globalStorageUri: mockUri,
				logUri: mockUri,
				extensionMode: 1,
				logPath: "/test/path",
				languageModelAccessInformation: {},
			},
		}
		fs.readFile.mockResolvedValue(
			JSON.stringify({
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["allowed-tool"],
					},
				},
			}),
		)
		mcpHub = new McpHub(mockProvider)
	})
	describe("toggleToolAlwaysAllow", () => {
		it("should add tool to always allow list when enabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						alwaysAllow: [],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "new-tool", true)
			// Verify the config was updated correctly
			const writeCall = fs.writeFile.mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
		it("should remove tool from always allow list when disabling", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						alwaysAllow: ["existing-tool"],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "existing-tool", false)
			// Verify the config was updated correctly
			const writeCall = fs.writeFile.mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).not.toContain("existing-tool")
		})
		it("should initialize alwaysAllow if it does not exist", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleToolAlwaysAllow("test-server", "new-tool", true)
			// Verify the config was updated with initialized alwaysAllow
			const writeCall = fs.writeFile.mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toBeDefined()
			expect(writtenConfig.mcpServers["test-server"].alwaysAllow).toContain("new-tool")
		})
	})
	describe("server disabled state", () => {
		it("should toggle server disabled state", async () => {
			const mockConfig = {
				mcpServers: {
					"test-server": {
						command: "node",
						args: ["test.js"],
						disabled: false,
					},
				},
			}
			fs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig))
			await mcpHub.toggleServerDisabled("test-server", true)
			// Verify the config was updated correctly
			const writeCall = fs.writeFile.mock.calls[0]
			const writtenConfig = JSON.parse(writeCall[1])
			expect(writtenConfig.mcpServers["test-server"].disabled).toBe(true)
		})
		it("should filter out disabled servers from getServers", () => {
			const mockConnections = [
				{
					server: {
						name: "enabled-server",
						config: "{}",
						status: "connected",
						disabled: false,
					},
					client: {},
					transport: {},
				},
				{
					server: {
						name: "disabled-server",
						config: "{}",
						status: "connected",
						disabled: true,
					},
					client: {},
					transport: {},
				},
			]
			mcpHub.connections = mockConnections
			const servers = mcpHub.getServers()
			expect(servers.length).toBe(1)
			expect(servers[0].name).toBe("enabled-server")
		})
		it("should prevent calling tools on disabled servers", async () => {
			const mockConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				},
				transport: {},
			}
			mcpHub.connections = [mockConnection]
			await expect(mcpHub.callTool("disabled-server", "some-tool", {})).rejects.toThrow(
				'Server "disabled-server" is disabled and cannot be used',
			)
		})
		it("should prevent reading resources from disabled servers", async () => {
			const mockConnection = {
				server: {
					name: "disabled-server",
					config: "{}",
					status: "connected",
					disabled: true,
				},
				client: {
					request: jest.fn(),
				},
				transport: {},
			}
			mcpHub.connections = [mockConnection]
			await expect(mcpHub.readResource("disabled-server", "some/uri")).rejects.toThrow(
				'Server "disabled-server" is disabled',
			)
		})
	})
	describe("callTool", () => {
		it("should execute tool successfully", async () => {
			// Mock the connection with a minimal client implementation
			const mockConnection = {
				server: {
					name: "test-server",
					config: JSON.stringify({}),
					status: "connected",
				},
				client: {
					request: jest.fn().mockResolvedValue({ result: "success" }),
				},
				transport: {
					start: jest.fn(),
					close: jest.fn(),
					stderr: { on: jest.fn() },
				},
			}
			mcpHub.connections = [mockConnection]
			await mcpHub.callTool("test-server", "some-tool", {})
			// Verify the request was made with correct parameters
			expect(mockConnection.client.request).toHaveBeenCalledWith(
				{
					method: "tools/call",
					params: {
						name: "some-tool",
						arguments: {},
					},
				},
				expect.any(Object),
			)
		})
		it("should throw error if server not found", async () => {
			await expect(mcpHub.callTool("non-existent-server", "some-tool", {})).rejects.toThrow(
				"No connection found for server: non-existent-server",
			)
		})
	})
})
export {}
//# sourceMappingURL=McpHub.test.js.map
