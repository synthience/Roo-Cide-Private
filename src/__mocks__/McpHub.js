export class McpHub {
	connections = []
	isConnecting = false
	constructor() {
		this.toggleToolAlwaysAllow = jest.fn()
		this.callTool = jest.fn()
	}
	async toggleToolAlwaysAllow(serverName, toolName, shouldAllow) {
		return Promise.resolve()
	}
	async callTool(serverName, toolName, toolArguments) {
		return Promise.resolve({ result: "success" })
	}
}
//# sourceMappingURL=McpHub.js.map
