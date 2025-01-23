import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import { CustomModesSettingsSchema } from "./CustomModesSchema"
import { fileExistsAtPath } from "../../utils/fs"
import { arePathsEqual } from "../../utils/path"
export class CustomModesManager {
	context
	onUpdate
	disposables = []
	isWriting = false
	writeQueue = []
	constructor(context, onUpdate) {
		this.context = context
		this.onUpdate = onUpdate
		this.watchCustomModesFile()
	}
	async queueWrite(operation) {
		this.writeQueue.push(operation)
		if (!this.isWriting) {
			await this.processWriteQueue()
		}
	}
	async processWriteQueue() {
		if (this.isWriting || this.writeQueue.length === 0) {
			return
		}
		this.isWriting = true
		try {
			while (this.writeQueue.length > 0) {
				const operation = this.writeQueue.shift()
				if (operation) {
					await operation()
				}
			}
		} finally {
			this.isWriting = false
		}
	}
	async getCustomModesFilePath() {
		const settingsDir = await this.ensureSettingsDirectoryExists()
		const filePath = path.join(settingsDir, "cline_custom_modes.json")
		const fileExists = await fileExistsAtPath(filePath)
		if (!fileExists) {
			await this.queueWrite(async () => {
				await fs.writeFile(filePath, JSON.stringify({ customModes: [] }, null, 2))
			})
		}
		return filePath
	}
	async watchCustomModesFile() {
		const settingsPath = await this.getCustomModesFilePath()
		this.disposables.push(
			vscode.workspace.onDidSaveTextDocument(async (document) => {
				if (arePathsEqual(document.uri.fsPath, settingsPath)) {
					const content = await fs.readFile(settingsPath, "utf-8")
					const errorMessage =
						"Invalid custom modes format. Please ensure your settings follow the correct JSON format."
					let config
					try {
						config = JSON.parse(content)
					} catch (error) {
						console.error(error)
						vscode.window.showErrorMessage(errorMessage)
						return
					}
					const result = CustomModesSettingsSchema.safeParse(config)
					if (!result.success) {
						vscode.window.showErrorMessage(errorMessage)
						return
					}
					await this.context.globalState.update("customModes", result.data.customModes)
					await this.onUpdate()
				}
			}),
		)
	}
	async getCustomModes() {
		const modes = await this.context.globalState.get("customModes")
		// Always read from file to ensure we have the latest
		try {
			const settingsPath = await this.getCustomModesFilePath()
			const content = await fs.readFile(settingsPath, "utf-8")
			const settings = JSON.parse(content)
			const result = CustomModesSettingsSchema.safeParse(settings)
			if (result.success) {
				await this.context.globalState.update("customModes", result.data.customModes)
				return result.data.customModes
			}
			return modes ?? []
		} catch (error) {
			// Return empty array if there's an error reading the file
		}
		return modes ?? []
	}
	async updateCustomMode(slug, config) {
		try {
			const settingsPath = await this.getCustomModesFilePath()
			await this.queueWrite(async () => {
				// Read and update file
				const content = await fs.readFile(settingsPath, "utf-8")
				const settings = JSON.parse(content)
				const currentModes = settings.customModes || []
				const updatedModes = currentModes.filter((m) => m.slug !== slug)
				updatedModes.push(config)
				settings.customModes = updatedModes
				const newContent = JSON.stringify(settings, null, 2)
				// Write to file
				await fs.writeFile(settingsPath, newContent)
				// Update global state
				await this.context.globalState.update("customModes", updatedModes)
				// Notify about the update
				await this.onUpdate()
			})
			// Success, no need for message
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to update custom mode: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
	async deleteCustomMode(slug) {
		try {
			const settingsPath = await this.getCustomModesFilePath()
			await this.queueWrite(async () => {
				const content = await fs.readFile(settingsPath, "utf-8")
				const settings = JSON.parse(content)
				settings.customModes = (settings.customModes || []).filter((m) => m.slug !== slug)
				await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
				await this.context.globalState.update("customModes", settings.customModes)
				await this.onUpdate()
			})
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to delete custom mode: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
	async ensureSettingsDirectoryExists() {
		const settingsDir = path.join(this.context.globalStorageUri.fsPath, "settings")
		await fs.mkdir(settingsDir, { recursive: true })
		return settingsDir
	}
	/**
	 * Delete the custom modes file and reset to default state
	 */
	async resetCustomModes() {
		try {
			const filePath = await this.getCustomModesFilePath()
			await fs.writeFile(filePath, JSON.stringify({ customModes: [] }, null, 2))
			await this.context.globalState.update("customModes", [])
			await this.onUpdate()
		} catch (error) {
			vscode.window.showErrorMessage(
				`Failed to reset custom modes: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}
	dispose() {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}
		this.disposables = []
	}
}
//# sourceMappingURL=CustomModesManager.js.map
