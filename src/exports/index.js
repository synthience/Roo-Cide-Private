export function createClineAPI(outputChannel, sidebarProvider) {
	const api = {
		setCustomInstructions: async (value) => {
			await sidebarProvider.updateCustomInstructions(value)
			outputChannel.appendLine("Custom instructions set")
		},
		getCustomInstructions: async () => {
			return await sidebarProvider.getGlobalState("customInstructions")
		},
		startNewTask: async (task, images) => {
			outputChannel.appendLine("Starting new task")
			await sidebarProvider.clearTask()
			await sidebarProvider.postStateToWebview()
			await sidebarProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
			await sidebarProvider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: task,
				images: images,
			})
			outputChannel.appendLine(
				`Task started with message: ${task ? `"${task}"` : "undefined"} and ${images?.length || 0} image(s)`,
			)
		},
		sendMessage: async (message, images) => {
			outputChannel.appendLine(
				`Sending message: ${message ? `"${message}"` : "undefined"} with ${images?.length || 0} image(s)`,
			)
			await sidebarProvider.postMessageToWebview({
				type: "invoke",
				invoke: "sendMessage",
				text: message,
				images: images,
			})
		},
		pressPrimaryButton: async () => {
			outputChannel.appendLine("Pressing primary button")
			await sidebarProvider.postMessageToWebview({
				type: "invoke",
				invoke: "primaryButtonClick",
			})
		},
		pressSecondaryButton: async () => {
			outputChannel.appendLine("Pressing secondary button")
			await sidebarProvider.postMessageToWebview({
				type: "invoke",
				invoke: "secondaryButtonClick",
			})
		},
		sidebarProvider: sidebarProvider,
	}
	return api
}
//# sourceMappingURL=index.js.map
