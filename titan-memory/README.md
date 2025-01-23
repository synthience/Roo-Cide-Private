# Titan Memory System

A TensorFlow.js-based memory system optimized for RTX 4090 GPUs, integrated with NEMO for embeddings generation.

## Features

- Optimized for NVIDIA RTX 4090 with CUDA compute capability 8.9
- TensorFlow.js GPU acceleration with tensor core optimizations
- Efficient memory management and tensor cleanup
- Persistent storage of memories
- Cosine similarity-based memory retrieval
- MCP integration for Cline

## Installation

1. Install dependencies:

```bash
npm install
```

2. Build the project:

```bash
npm run build
```

## Configuration

The system uses the following environment variables:

- `TITAN_MODEL_PATH`: Path to the NEMO model
- `TITAN_MAX_MEMORY_MB`: Maximum memory usage in MB (default: 20000)
- `TITAN_PERSISTENCE_PATH`: Path for storing memories
- `TITAN_EMBEDDING_DIM`: Embedding dimension (default: 1024)

## MCP Tools

### store_memory

Stores a new memory in the system.

Parameters:

- `content`: The text content to store
- `context`: (optional) Additional context for the memory

Example:

```typescript
const result = await useMcpTool("titan-memory", "store_memory", {
	content: "Important information to remember",
	context: { category: "notes", priority: "high" },
})
```

### query_memory

Queries stored memories based on semantic similarity.

Parameters:

- `query`: The search query text
- `limit`: (optional) Maximum number of results to return (default: 5)

Example:

```typescript
const result = await useMcpTool("titan-memory", "query_memory", {
	query: "Find information about...",
	limit: 10,
})
```

## Architecture

- `src/models/nemo-api.ts`: NEMO model integration with TensorFlow.js
- `src/models/memory-manager.ts`: Memory storage and retrieval
- `src/index.ts`: MCP server implementation
- `src/config/types.ts`: TypeScript type definitions

## GPU Optimizations

- Uses TensorFlow.js GPU backend
- Tensor core operations enabled for RTX 4090
- Dynamic memory management with automatic cleanup
- Batch processing for efficient GPU utilization

## Development

1. Start in development mode:

```bash
npm run dev
```

2. Run tests:

```bash
npm test
```

## Production

1. Build for production:

```bash
npm run build
```

2. The MCP server will automatically load the system when properly configured in Cline settings.

## Requirements

- NVIDIA RTX 4090 GPU
- CUDA Toolkit 12.x
- Node.js 18+
- npm 9+

## Memory Format

Memories are stored in the following format:

```typescript
interface Memory {
	id: string
	content: string
	embedding: number[]
	context?: Record<string, any>
	timestamp: string
}
```

## Error Handling

The system includes comprehensive error handling for:

- GPU memory management
- Model loading failures
- Invalid inputs
- Storage/retrieval errors

## Performance Considerations

- Automatic tensor cleanup
- Batch processing for multiple operations
- Memory pruning when limits are reached
- Efficient similarity search implementation
