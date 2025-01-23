import { promises as fs } from "fs"
import path from "path"
import { logger } from "./logger.js"

export async function ensureDirectory(dirPath: string): Promise<void> {
	try {
		const normalizedPath = path.normalize(dirPath)
		logger.debug("FileSystem", "Ensuring directory exists", { path: normalizedPath })
		await fs.mkdir(normalizedPath, { recursive: true })
		logger.debug("FileSystem", "Directory created/verified", { path: normalizedPath })
	} catch (error) {
		logger.error("FileSystem", "Failed to create directory", { path: dirPath, error })
		throw error
	}
}

export async function writeFile(filePath: string, content: string): Promise<void> {
	try {
		const normalizedPath = path.normalize(filePath)
		logger.debug("FileSystem", "Starting file write", { path: normalizedPath })

		// Ensure directory exists
		const dirPath = path.dirname(normalizedPath)
		await ensureDirectory(dirPath)

		// Write file
		await fs.writeFile(normalizedPath, content, { encoding: "utf8" })

		// Verify content
		const writtenContent = await fs.readFile(normalizedPath, "utf8")
		if (writtenContent !== content) {
			throw new Error("File content verification failed")
		}

		logger.debug("FileSystem", "File write successful", { path: normalizedPath })
	} catch (error) {
		logger.error("FileSystem", "Failed to write file", { path: filePath, error })
		throw error
	}
}

export async function readFile(filePath: string): Promise<string> {
	try {
		const normalizedPath = path.normalize(filePath)
		logger.debug("FileSystem", "Reading file", { path: normalizedPath })
		const content = await fs.readFile(normalizedPath, "utf8")
		logger.debug("FileSystem", "File read successful", { path: normalizedPath })
		return content
	} catch (error) {
		logger.error("FileSystem", "Failed to read file", { path: filePath, error })
		throw error
	}
}

export async function deleteFile(filePath: string): Promise<void> {
	try {
		const normalizedPath = path.normalize(filePath)
		logger.debug("FileSystem", "Deleting file", { path: normalizedPath })
		await fs.unlink(normalizedPath)
		logger.debug("FileSystem", "File deletion successful", { path: normalizedPath })
	} catch (error) {
		logger.error("FileSystem", "Failed to delete file", { path: filePath, error })
		throw error
	}
}

export async function listFiles(dirPath: string): Promise<string[]> {
	try {
		const normalizedPath = path.normalize(dirPath)
		logger.debug("FileSystem", "Listing directory contents", { path: normalizedPath })
		const files = await fs.readdir(normalizedPath)
		logger.debug("FileSystem", "Directory listing successful", { path: normalizedPath, fileCount: files.length })
		return files
	} catch (error) {
		logger.error("FileSystem", "Failed to list directory", { path: dirPath, error })
		throw error
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const normalizedPath = path.normalize(filePath)
		await fs.access(normalizedPath)
		logger.debug("FileSystem", "File exists", { path: normalizedPath })
		return true
	} catch {
		logger.debug("FileSystem", "File does not exist", { path: filePath })
		return false
	}
}
