// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import delay from "delay"
import * as vscode from "vscode"
import { ClineProvider } from "./core/webview/ClineProvider"
import { createClineAPI } from "./exports"
import "./utils/path" // necessary to have access to String.prototype.toPosix
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
/*
Built using https://github.com/microsoft/vscode-webview-ui-toolkit

Inspired by
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra

*/
let outputChannel
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context) {
	outputChannel = vscode.window.createOutputChannel("Roo-Code")
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine("Roo-Code extension activated")
	// Get default commands from configuration
	const defaultCommands = vscode.workspace.getConfiguration("roo-cline").get("allowedCommands") || []
	// Initialize global state if not already set
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}
	const sidebarProvider = new ClineProvider(context, outputChannel)
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, sidebarProvider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.plusButtonClicked", async () => {
			outputChannel.appendLine("Plus button Clicked")
			await sidebarProvider.clearTask()
			await sidebarProvider.postStateToWebview()
			await sidebarProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.mcpButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.promptsButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
		}),
	)
	const openClineInNewTab = async () => {
		outputChannel.appendLine("Opening Roo Code in new tab")
		// (this example uses webviewProvider activation event which is necessary to deserialize cached webview, but since we use retainContextWhenHidden, we don't need to use that event)
		// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
		const tabProvider = new ClineProvider(context, outputChannel)
		//const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined
		const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))
		// Check if there are any visible text editors, otherwise open a new group to the right
		const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0
		if (!hasVisibleEditors) {
			await vscode.commands.executeCommand("workbench.action.newGroupRight")
		}
		const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two
		const panel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
			enableScripts: true,
			retainContextWhenHidden: true,
			localResourceRoots: [context.extensionUri],
		})
		// TODO: use better svg icon with light and dark variants (see https://stackoverflow.com/questions/58365687/vscode-extension-iconpath)
		panel.iconPath = {
			light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
			dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "rocket.png"),
		}
		tabProvider.resolveWebviewView(panel)
		// Lock the editor group so clicking on files doesn't open them over the panel
		await delay(100)
		await vscode.commands.executeCommand("workbench.action.lockEditorGroup")
	}
	context.subscriptions.push(vscode.commands.registerCommand("roo-cline.popoutButtonClicked", openClineInNewTab))
	context.subscriptions.push(vscode.commands.registerCommand("roo-cline.openInNewTab", openClineInNewTab))
	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.settingsButtonClicked", () => {
			//vscode.window.showInformationMessage(message)
			sidebarProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		}),
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("roo-cline.historyButtonClicked", () => {
			sidebarProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
		}),
	)
	/*
    We use the text document content provider API to show the left side for diff view by creating a virtual document for the original content. This makes it readonly so users know to edit the right side if they want to keep their changes.

    - This API allows you to create readonly documents in VSCode from arbitrary sources, and works by claiming an uri-scheme for which your provider then returns text contents. The scheme must be provided when registering a provider and cannot change afterwards.
    - Note how the provider doesn't create uris for virtual documents - its role is to provide contents given such an uri. In return, content providers are wired into the open document logic so that providers are always considered.
    https://code.visualstudio.com/api/extension-guides/virtual-documents
    */
	const diffContentProvider = new (class {
		provideTextDocumentContent(uri) {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()
	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)
	// URI Handler
	const handleUri = async (uri) => {
		const path = uri.path
		const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
		const visibleProvider = ClineProvider.getVisibleInstance()
		if (!visibleProvider) {
			return
		}
		switch (path) {
			case "/glama": {
				const code = query.get("code")
				if (code) {
					await visibleProvider.handleGlamaCallback(code)
				}
				break
			}
			case "/openrouter": {
				const code = query.get("code")
				if (code) {
					await visibleProvider.handleOpenRouterCallback(code)
				}
				break
			}
			default:
				break
		}
	}
	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))
	return createClineAPI(outputChannel, sidebarProvider)
}
// This method is called when your extension is deactivated
export function deactivate() {
	outputChannel.appendLine("Roo-Code extension deactivated")
}
//# sourceMappingURL=extension.js.map
