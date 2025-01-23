# Titan Memory Server Quickstart Guide

## Overview

The Titan Memory Server provides memory storage and retrieval capabilities with semantic search using embeddings. It uses the NEMO API for generating embeddings and provides a simple interface through MCP tools.

## Prerequisites

- Node.js v18 or higher
- At least 20GB RAM recommended
- CUDA-capable GPU (optional, for faster embedding generation)

## Environment Variables

```bash
# Path to the Titan model files
TITAN_MODEL_PATH="/path/to/models/titan"

# Maximum memory usage in MB
TITAN_MAX_MEMORY_MB="20000"

# Path where memories will be stored
TITAN_PERSISTENCE_PATH="/path/to/data/memories"

# Embedding dimension (must match model output)
TITAN_EMBEDDING_DIM="1024"
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`

## Running the Server

### Windows (PowerShell)

```powershell
# Set environment variables and start server
$env:TITAN_MODEL_PATH="path/to/models/titan"
$env:TITAN_MAX_MEMORY_MB="20000"
$env:TITAN_PERSISTENCE_PATH="path/to/data/memories"
$env:TITAN_EMBEDDING_DIM="1024"
$env:NODE_ENV="production"
npm start
```

### Unix/Linux/macOS

```bash
# Set environment variables and start server
export TITAN_MODEL_PATH="/path/to/models/titan"
export TITAN_MAX_MEMORY_MB="20000"
export TITAN_PERSISTENCE_PATH="/path/to/data/memories"
export TITAN_EMBEDDING_DIM="1024"
export NODE_ENV="production"
npm start
```

## MCP Server Configuration

Add the following to your Cline MCP settings file (cline_mcp_settings.json):

```json
{
	"mcpServers": {
		"titan-memory": {
			"command": "node",
			"args": ["path/to/titan-memory/dist/index.js"],
			"cwd": "path/to/titan-memory",
			"env": {
				"TITAN_MODEL_PATH": "path/to/models/titan",
				"TITAN_MAX_MEMORY_MB": "20000",
				"TITAN_PERSISTENCE_PATH": "path/to/data/memories",
				"TITAN_EMBEDDING_DIM": "1024",
				"NODE_ENV": "production"
			},
			"disabled": false,
			"alwaysAllow": ["store_memory", "query_memory"]
		}
	}
}
```

After configuring:

1. Restart VSCode to load the MCP server configuration
2. The server will automatically start when needed

## Available Tools

### store_memory

Stores a new memory with its embedding.

```typescript
interface StoreMemoryArgs {
	content: string
	context?: Record<string, any>
}
```

Example:

```json
{
	"content": "The quick brown fox jumps over the lazy dog",
	"context": {
		"type": "test",
		"timestamp": "2025-01-23T13:30:00"
	}
}
```

### query_memory

Queries stored memories using semantic search.

```typescript
interface QueryMemoryArgs {
	query: string
	limit?: number
}
```

Example:

```json
{
	"query": "fox jumping",
	"limit": 5
}
```

## Implementation Notes

### Async Initialization

The memory manager uses async initialization to ensure proper setup:

- Directory creation
- Loading existing memories
- Model warmup

All operations automatically wait for initialization to complete before proceeding.

### File Storage

Memories are stored both in memory and on disk:

- Each memory gets a unique ID based on timestamp
- Files are stored as JSON in the persistence directory
- Automatic pruning when memory limit is reached

### Error Handling

The server includes comprehensive error handling:

- Initialization errors
- File system errors
- Invalid embedding dimensions
- Memory storage/retrieval errors

## Troubleshooting

### Common Issues

1. "Server components not yet initialized"

    - Wait for initialization to complete
    - Check logs for initialization errors

2. "Failed to store memory"

    - Verify persistence directory permissions
    - Check available disk space
    - Ensure valid embedding dimension

3. "Invalid embedding dimension"

    - Verify TITAN_EMBEDDING_DIM matches model output
    - Check embedding generation process

4. "MCP server not showing in Cline"
    - Verify MCP settings configuration
    - Restart VSCode to reload MCP settings
    - Check server logs for connection issues

### Logging

The server provides detailed logging:

- Initialization status
- Operation results
- Error details with context
- Memory statistics

## Recovery

In case of issues:

1. Check backup directory for recent backups
2. Follow recovery instructions in BACKUP_LOG.md
3. Rebuild and restart the server
