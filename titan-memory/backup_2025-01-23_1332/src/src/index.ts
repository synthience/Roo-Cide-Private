import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
	CallToolRequest,
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
	ToolResponse,
} from "@modelcontextprotocol/sdk/types.js"
import { MemoryManager } from "./models/memory-manager.js"
import { NemoAPI } from "./models/nemo-api.js"
import { TitanConfig } from "./config/types.js"

interface StoreMemoryArgs {
	content: string
	context?: Record<string, any>
}

interface QueryMemoryArgs {
	query: string
	limit?: number
}

class TitanMemoryServer {
	private server: Server
	private nemoApi!: NemoAPI
	private memoryManager!: MemoryManager
	private config: TitanConfig
	private initialized: boolean = false

	constructor() {
		this.config = this.loadConfig()
		this.server = new Server(
			{
				name: "titan-memory",
				version: "0.1.0",
			},
			{
				capabilities: {
					tools: {},
				},
			},
		)

		// Error handling
		this.server.onerror = (error: Error) => console.error("[MCP Error]", error)
		process.on("SIGINT", async () => {
			await this.cleanup()
			process.exit(0)
		})
	}

	private loadConfig(): TitanConfig {
		return {
			modelPath: process.env.TITAN_MODEL_PATH || "/models/titan",
			maxMemoryMB: parseInt(process.env.TITAN_MAX_MEMORY_MB || "20000"),
			persistencePath: process.env.TITAN_PERSISTENCE_PATH || "/data/memories",
			embeddingDimension: parseInt(process.env.TITAN_EMBEDDING_DIM || "1024"),
		}
	}

	private async initializeComponents() {
		if (this.initialized) return

		try {
			// Initialize NEMO API with TensorFlow.js
			this.nemoApi = new NemoAPI({
				modelPath: this.config.modelPath,
				cutlassConfig: {
					tensorCoreEnabled: true,
					computeCapability: "89", // RTX 4090
					memoryLimit: this.config.maxMemoryMB,
				},
				embeddingDimension: this.config.embeddingDimension,
			})

			// Wait for NEMO API initialization
			await this.nemoApi.warmup()

			// Initialize Memory Manager
			this.memoryManager = new MemoryManager({
				maxMemoryMB: this.config.maxMemoryMB,
				persistencePath: this.config.persistencePath,
				embeddingDimension: this.config.embeddingDimension,
			})

			this.initialized = true
			console.error("Components initialized successfully")
		} catch (error) {
			console.error("Failed to initialize components:", error)
			throw error
		}
	}

	private setupRequestHandlers() {
		// List available tools
		this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
			tools: [
				{
					name: "store_memory",
					description: "Store a new memory in the Titan system",
					inputSchema: {
						type: "object",
						properties: {
							content: {
								type: "string",
								description: "Memory content to store",
							},
							context: {
								type: "object",
								description: "Additional context for the memory",
							},
						},
						required: ["content"],
					},
				},
				{
					name: "query_memory",
					description: "Query memories from the Titan system",
					inputSchema: {
						type: "object",
						properties: {
							query: {
								type: "string",
								description: "Query to search memories",
							},
							limit: {
								type: "number",
								description: "Maximum number of results",
							},
						},
						required: ["query"],
					},
				},
			],
		}))

		// Handle tool calls
		this.server.setRequestHandler(
			CallToolRequestSchema,
			async (request: CallToolRequest): Promise<ToolResponse> => {
				if (!this.initialized) {
					throw new McpError(ErrorCode.InternalError, "Server components not yet initialized")
				}

				switch (request.params.name) {
					case "store_memory":
						return await this.handleStoreMemory(request.params.arguments as StoreMemoryArgs)
					case "query_memory":
						return await this.handleQueryMemory(request.params.arguments as QueryMemoryArgs)
					default:
						throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`)
				}
			},
		)
	}

	private async handleStoreMemory(args: StoreMemoryArgs): Promise<ToolResponse> {
		try {
			const embedding = await this.nemoApi.generateEmbedding(args.content)
			const storedMemory = await this.memoryManager.storeMemory({
				content: args.content,
				embedding,
				context: args.context || {},
			})

			return {
				content: [
					{
						type: "text",
						text: `Memory stored successfully with ID: ${storedMemory.id}`,
					},
				],
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
			return {
				content: [
					{
						type: "text",
						text: `Failed to store memory: ${errorMessage}`,
					},
				],
				isError: true,
			}
		}
	}

	private async handleQueryMemory(args: QueryMemoryArgs): Promise<ToolResponse> {
		try {
			const queryEmbedding = await this.nemoApi.generateEmbedding(args.query)
			const results = await this.memoryManager.queryMemories(queryEmbedding, args.limit || 5)

			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(results, null, 2),
					},
				],
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
			return {
				content: [
					{
						type: "text",
						text: `Failed to query memories: ${errorMessage}`,
					},
				],
				isError: true,
			}
		}
	}

	private async cleanup() {
		if (this.initialized) {
			await this.memoryManager.cleanup()
			await this.nemoApi.cleanup()
			await this.server.close()
		}
	}

	async run() {
		try {
			await this.initializeComponents()
			this.setupRequestHandlers()
			const transport = new StdioServerTransport()
			await this.server.connect(transport)
			console.error("Titan Memory MCP server running on stdio")
		} catch (error) {
			console.error("Failed to start server:", error)
			process.exit(1)
		}
	}
}

const server = new TitanMemoryServer()
server.run().catch(console.error)
