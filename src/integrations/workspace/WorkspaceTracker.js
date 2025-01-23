import * as vscode from "vscode"
import * as path from "path"
import { listFiles } from "../../services/glob/list-files"
const cwd = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0)
const MAX_INITIAL_FILES = 1_000
// Note: this is not a drop-in replacement for listFiles at the start of tasks, since that will be done for Desktops when there is no workspace selected
class WorkspaceTracker {
	providerRef
	disposables = []
	filePaths = new Set()
	updateTimer = null
	constructor(provider) {
		this.providerRef = new WeakRef(provider)
		this.registerListeners()
	}
	async initializeFilePaths() {
		// should not auto get filepaths for desktop since it would immediately show permission popup before cline ever creates a file
		if (!cwd) {
			return
		}
		const [files, _] = await listFiles(cwd, true, MAX_INITIAL_FILES)
		files.slice(0, MAX_INITIAL_FILES).forEach((file) => this.filePaths.add(this.normalizeFilePath(file)))
		this.workspaceDidUpdate()
	}
	registerListeners() {
		const watcher = vscode.workspace.createFileSystemWatcher("**")
		this.disposables.push(
			watcher.onDidCreate(async (uri) => {
				await this.addFilePath(uri.fsPath)
				this.workspaceDidUpdate()
			}),
		)
		// Renaming files triggers a delete and create event
		this.disposables.push(
			watcher.onDidDelete(async (uri) => {
				if (await this.removeFilePath(uri.fsPath)) {
					this.workspaceDidUpdate()
				}
			}),
		)
		this.disposables.push(watcher)
	}
	workspaceDidUpdate() {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
		}
		this.updateTimer = setTimeout(() => {
			if (!cwd) {
				return
			}
			this.providerRef.deref()?.postMessageToWebview({
				type: "workspaceUpdated",
				filePaths: Array.from(this.filePaths).map((file) => {
					const relativePath = path.relative(cwd, file).toPosix()
					return file.endsWith("/") ? relativePath + "/" : relativePath
				}),
			})
			this.updateTimer = null
		}, 300) // Debounce for 300ms
	}
	normalizeFilePath(filePath) {
		const resolvedPath = cwd ? path.resolve(cwd, filePath) : path.resolve(filePath)
		return filePath.endsWith("/") ? resolvedPath + "/" : resolvedPath
	}
	async addFilePath(filePath) {
		// Allow for some buffer to account for files being created/deleted during a task
		if (this.filePaths.size >= MAX_INITIAL_FILES * 2) {
			return filePath
		}
		const normalizedPath = this.normalizeFilePath(filePath)
		try {
			const stat = await vscode.workspace.fs.stat(vscode.Uri.file(normalizedPath))
			const isDirectory = (stat.type & vscode.FileType.Directory) !== 0
			const pathWithSlash = isDirectory && !normalizedPath.endsWith("/") ? normalizedPath + "/" : normalizedPath
			this.filePaths.add(pathWithSlash)
			return pathWithSlash
		} catch {
			// If stat fails, assume it's a file (this can happen for newly created files)
			this.filePaths.add(normalizedPath)
			return normalizedPath
		}
	}
	async removeFilePath(filePath) {
		const normalizedPath = this.normalizeFilePath(filePath)
		return this.filePaths.delete(normalizedPath) || this.filePaths.delete(normalizedPath + "/")
	}
	dispose() {
		if (this.updateTimer) {
			clearTimeout(this.updateTimer)
			this.updateTimer = null
		}
		this.disposables.forEach((d) => d.dispose())
	}
}
export default WorkspaceTracker
//# sourceMappingURL=WorkspaceTracker.js.map
