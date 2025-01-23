declare module "@modelcontextprotocol/sdk/server/index.js" {
	export class Server {
		constructor(
			info: { name: string; version: string },
			config: { capabilities: { tools: Record<string, unknown> } },
		)
		setRequestHandler<T>(schema: unknown, handler: (request: T) => Promise<unknown>): void
		connect(transport: unknown): Promise<void>
		close(): Promise<void>
		onerror: (error: Error) => void
	}
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
	export class StdioServerTransport {
		constructor()
	}
}

declare module "@modelcontextprotocol/sdk/types.js" {
	export interface CallToolRequest {
		params: {
			name: string
			arguments: unknown
		}
	}

	export const CallToolRequestSchema: unique symbol
	export const ListToolsRequestSchema: unique symbol

	export enum ErrorCode {
		MethodNotFound = "MethodNotFound",
		InvalidRequest = "InvalidRequest",
		InternalError = "InternalError",
	}

	export class McpError extends Error {
		constructor(code: ErrorCode, message: string)
	}

	export interface ToolResponse {
		content: Array<{
			type: string
			text: string
		}>
		isError?: boolean
	}
}
