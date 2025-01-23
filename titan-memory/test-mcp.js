import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { MemoryManager } from "./dist/models/memory-manager.js"
import path from "path"
import fs from "fs/promises"

async function testMCP() {
	// Initialize memory manager
	const basePath = path.resolve("data/memories")
	const embeddingDimension = 1024 // Match TITAN_EMBEDDING_DIM

	// Clear existing memories
	try {
		await fs.rm(basePath, { recursive: true, force: true })
		await fs.mkdir(basePath, { recursive: true })
		console.log("Cleared existing memories")
	} catch (error) {
		console.error("Error clearing memories:", error)
	}

	const memoryManager = new MemoryManager({
		persistencePath: basePath,
		maxMemoryMB: 1000,
		embeddingDimension,
	})

	// Create test server
	const server = new Server(
		{
			name: "test-server",
			version: "0.1.0",
		},
		{
			capabilities: {
				tools: {
					store_memory: {
						name: "store_memory",
						description: "Store a memory in the system",
						inputSchema: {
							type: "object",
							properties: {
								content: { type: "string" },
								context: { type: "object" },
							},
							required: ["content"],
						},
					},
					query_memory: {
						name: "query_memory",
						description: "Query memories from the system",
						inputSchema: {
							type: "object",
							properties: {
								query: { type: "string" },
								limit: { type: "number" },
							},
							required: ["query"],
						},
					},
				},
			},
		},
	)

	// Create request handler
	const handleRequest = async (request) => {
		switch (request.params.name) {
			case "store_memory": {
				const { content, context } = request.params.arguments
				const embedding = new Array(embeddingDimension).fill(0).map((_, i) => Math.sin(i))
				const memory = await memoryManager.storeMemory({ content, embedding, context })
				console.log("Memory stored:", memory.id)
				return {
					content: [{ type: "text", text: JSON.stringify(memory, null, 2) }],
				}
			}

			case "query_memory": {
				const { query, limit = 5 } = request.params.arguments
				const queryEmbedding = new Array(embeddingDimension).fill(0).map((_, i) => Math.sin(i))
				const memories = await memoryManager.queryMemories(queryEmbedding, limit)
				console.log("Memories found:", memories.length)
				return {
					content: [{ type: "text", text: JSON.stringify(memories, null, 2) }],
				}
			}

			default:
				throw new Error(`Unknown tool: ${request.params.name}`)
		}
	}

	// Register handler
	server.setRequestHandler(CallToolRequestSchema, handleRequest)

	// Start server
	const transport = new StdioServerTransport()
	await server.connect(transport)

	try {
		// Store multiple test memories
		const testMemories = [
			{ content: "First test memory", context: { type: "test", index: 1 } },
			{ content: "Second test memory", context: { type: "test", index: 2 } },
			{ content: "Third test memory", context: { type: "test", index: 3 } },
		]

		console.log("\nStoring test memories:")
		for (const memory of testMemories) {
			const request = {
				jsonrpc: "2.0",
				id: 1,
				method: "CallTool",
				params: {
					name: "store_memory",
					arguments: {
						content: memory.content,
						context: { ...memory.context, timestamp: new Date().toISOString() },
					},
				},
			}
			await handleRequest(request)
		}

		// Test query memory
		const queryRequest = {
			jsonrpc: "2.0",
			id: 2,
			method: "CallTool",
			params: {
				name: "query_memory",
				arguments: {
					query: "test",
					limit: 3,
				},
			},
		}

		console.log("\nTesting query_memory:")
		const queryResponse = await handleRequest(queryRequest)
		const memories = JSON.parse(queryResponse.content[0].text)
		console.log("Found memories:", memories.map((m) => m.id).join(", "))
	} catch (error) {
		console.error("Test failed:", error)
	}

	await server.close()
}

testMCP().catch(console.error)
