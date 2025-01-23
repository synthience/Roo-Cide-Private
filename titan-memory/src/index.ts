import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from "@modelcontextprotocol/sdk/types.js"
import { MemoryManager } from "./models/memory-manager.js"
import { NemoAPI } from "./models/nemo-api.js"
import { logger } from "./utils/logger.js"

// Environment variables validation
const requiredEnvVars = {
	TITAN_MODEL_PATH: process.env.TITAN_MODEL_PATH ?? "",
	TITAN_MAX_MEMORY_MB: process.env.TITAN_MAX_MEMORY_MB ?? "",
	TITAN_PERSISTENCE_PATH: process.env.TITAN_PERSISTENCE_PATH ?? "",
	TITAN_EMBEDDING_DIM: process.env.TITAN_EMBEDDING_DIM ?? "",
}

// Validate all required environment variables are present
Object.entries(requiredEnvVars).forEach(([key, value]) => {
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`)
	}
})

logger.log("TitanMemory", "Starting with configuration", requiredEnvVars)

// Initialize components
const nemoApi = new NemoAPI({
	modelPath: requiredEnvVars.TITAN_MODEL_PATH,
	embeddingDimension: parseInt(requiredEnvVars.TITAN_EMBEDDING_DIM),
	cutlassConfig: {
		tensorCoreEnabled: true,
		computeCapability: "8.9",
		memoryLimit: parseInt(requiredEnvVars.TITAN_MAX_MEMORY_MB) * 1024 * 1024,
	},
})

const memoryManager = new MemoryManager({
	persistencePath: requiredEnvVars.TITAN_PERSISTENCE_PATH,
	maxMemoryMB: parseInt(requiredEnvVars.TITAN_MAX_MEMORY_MB),
	embeddingDimension: parseInt(requiredEnvVars.TITAN_EMBEDDING_DIM),
})

logger.log("TitanMemory", "Components initialized successfully")

// Create MCP server
const server = new Server(
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

// Handle tool requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
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

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
	logger.log("TitanMemory", "Received tool request", {
		tool: request.params.name,
		args: request.params.arguments,
	})

	try {
		switch (request.params.name) {
			case "store_memory": {
				const { content, context } = request.params.arguments
				logger.log("TitanMemory", "Processing store_memory request", {
					content,
					context,
					persistencePath: requiredEnvVars.TITAN_PERSISTENCE_PATH,
					cwd: process.cwd(),
				})

				// Generate embedding
				const embedding = await nemoApi.generateEmbedding(content)
				logger.log("TitanMemory", "Generated embedding", {
					contentLength: content.length,
					embeddingLength: embedding.length,
				})

				// Store memory
				const memory = await memoryManager.storeMemory({ content, embedding, context })
				logger.log("TitanMemory", "Memory stored successfully", { id: memory.id })

				return {
					content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
				}
			}

			case "query_memory": {
				const { query, limit = 5 } = request.params.arguments
				logger.log("TitanMemory", "Processing query_memory request", { query, limit })

				// Generate query embedding
				const queryEmbedding = await nemoApi.generateEmbedding(query)
				logger.log("TitanMemory", "Generated query embedding", {
					queryLength: query.length,
					embeddingLength: queryEmbedding.length,
				})

				// Query memories
				const results = await memoryManager.queryMemories(queryEmbedding, limit)
				logger.log("TitanMemory", "Query completed", { resultCount: results.length })

				return {
					content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
				}
			}

			default:
				logger.log("TitanMemory", "Unknown tool requested", { tool: request.params.name })
				throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`)
		}
	} catch (error) {
		logger.log("TitanMemory", "Tool execution failed", error)
		throw error
	}
})

// Error handling
server.onerror = (error) => {
	logger.log("TitanMemory", "Server error", error)
}

// Initialize components and start server
;(async () => {
	try {
		// Initialize NemoAPI
		logger.log("TitanMemory", "Initializing NemoAPI")
		await nemoApi.initialize()
		logger.log("TitanMemory", "NemoAPI initialization complete")

		// Start server
		const transport = new StdioServerTransport()
		await server.connect(transport)
		logger.log("TitanMemory", "Server running on stdio")
	} catch (error) {
		logger.log("TitanMemory", "Failed to start server", error)
		process.exit(1)
	}
})()

// Cleanup on exit
process.on("SIGINT", async () => {
	logger.log("TitanMemory", "Received SIGINT, cleaning up")
	await memoryManager.cleanup()
	await logger.cleanup()
	await server.close()
	process.exit(0)
})
