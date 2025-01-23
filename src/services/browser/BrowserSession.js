import * as fs from "fs/promises"
import * as path from "path"
import { TimeoutError } from "puppeteer-core"
// @ts-ignore
import PCR from "puppeteer-chromium-resolver"
import pWaitFor from "p-wait-for"
import delay from "delay"
import { fileExistsAtPath } from "../../utils/fs"
export class BrowserSession {
	context
	browser
	page
	currentMousePosition
	constructor(context) {
		this.context = context
	}
	async ensureChromiumExists() {
		const globalStoragePath = this.context?.globalStorageUri?.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const puppeteerDir = path.join(globalStoragePath, "puppeteer")
		const dirExists = await fileExistsAtPath(puppeteerDir)
		if (!dirExists) {
			await fs.mkdir(puppeteerDir, { recursive: true })
		}
		// if chromium doesn't exist, this will download it to path.join(puppeteerDir, ".chromium-browser-snapshots")
		// if it does exist it will return the path to existing chromium
		const stats = await PCR({
			downloadPath: puppeteerDir,
		})
		return stats
	}
	async launchBrowser() {
		console.log("launch browser called")
		if (this.browser) {
			// throw new Error("Browser already launched")
			await this.closeBrowser() // this may happen when the model launches a browser again after having used it already before
		}
		const stats = await this.ensureChromiumExists()
		this.browser = await stats.puppeteer.launch({
			args: [
				"--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
			],
			executablePath: stats.executablePath,
			defaultViewport: (() => {
				const size = this.context.globalState.get("browserViewportSize") || "900x600"
				const [width, height] = size.split("x").map(Number)
				return { width, height }
			})(),
			// headless: false,
		})
		// (latest version of puppeteer does not add headless to user agent)
		this.page = await this.browser?.newPage()
	}
	async closeBrowser() {
		if (this.browser || this.page) {
			console.log("closing browser...")
			await this.browser?.close().catch(() => {})
			this.browser = undefined
			this.page = undefined
			this.currentMousePosition = undefined
		}
		return {}
	}
	async doAction(action) {
		if (!this.page) {
			throw new Error(
				"Browser is not launched. This may occur if the browser was automatically closed by a non-`browser_action` tool.",
			)
		}
		const logs = []
		let lastLogTs = Date.now()
		const consoleListener = (msg) => {
			if (msg.type() === "log") {
				logs.push(msg.text())
			} else {
				logs.push(`[${msg.type()}] ${msg.text()}`)
			}
			lastLogTs = Date.now()
		}
		const errorListener = (err) => {
			logs.push(`[Page Error] ${err.toString()}`)
			lastLogTs = Date.now()
		}
		// Add the listeners
		this.page.on("console", consoleListener)
		this.page.on("pageerror", errorListener)
		try {
			await action(this.page)
		} catch (err) {
			if (!(err instanceof TimeoutError)) {
				logs.push(`[Error] ${err.toString()}`)
			}
		}
		// Wait for console inactivity, with a timeout
		await pWaitFor(() => Date.now() - lastLogTs >= 500, {
			timeout: 3_000,
			interval: 100,
		}).catch(() => {})
		let options = {
			encoding: "base64",
			// clip: {
			// 	x: 0,
			// 	y: 0,
			// 	width: 900,
			// 	height: 600,
			// },
		}
		let screenshotBase64 = await this.page.screenshot({
			...options,
			type: "webp",
			quality: (await this.context.globalState.get("screenshotQuality")) ?? 75,
		})
		let screenshot = `data:image/webp;base64,${screenshotBase64}`
		if (!screenshotBase64) {
			console.log("webp screenshot failed, trying png")
			screenshotBase64 = await this.page.screenshot({
				...options,
				type: "png",
			})
			screenshot = `data:image/png;base64,${screenshotBase64}`
		}
		if (!screenshotBase64) {
			throw new Error("Failed to take screenshot.")
		}
		// this.page.removeAllListeners() <- causes the page to crash!
		this.page.off("console", consoleListener)
		this.page.off("pageerror", errorListener)
		return {
			screenshot,
			logs: logs.join("\n"),
			currentUrl: this.page.url(),
			currentMousePosition: this.currentMousePosition,
		}
	}
	async navigateToUrl(url) {
		return this.doAction(async (page) => {
			// networkidle2 isn't good enough since page may take some time to load. we can assume locally running dev sites will reach networkidle0 in a reasonable amount of time
			await page.goto(url, { timeout: 7_000, waitUntil: ["domcontentloaded", "networkidle2"] })
			// await page.goto(url, { timeout: 10_000, waitUntil: "load" })
			await this.waitTillHTMLStable(page) // in case the page is loading more resources
		})
	}
	// page.goto { waitUntil: "networkidle0" } may not ever resolve, and not waiting could return page content too early before js has loaded
	// https://stackoverflow.com/questions/52497252/puppeteer-wait-until-page-is-completely-loaded/61304202#61304202
	async waitTillHTMLStable(page, timeout = 5_000) {
		const checkDurationMsecs = 500 // 1000
		const maxChecks = timeout / checkDurationMsecs
		let lastHTMLSize = 0
		let checkCounts = 1
		let countStableSizeIterations = 0
		const minStableSizeIterations = 3
		while (checkCounts++ <= maxChecks) {
			let html = await page.content()
			let currentHTMLSize = html.length
			// let bodyHTMLSize = await page.evaluate(() => document.body.innerHTML.length)
			console.log("last: ", lastHTMLSize, " <> curr: ", currentHTMLSize)
			if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
				countStableSizeIterations++
			} else {
				countStableSizeIterations = 0 //reset the counter
			}
			if (countStableSizeIterations >= minStableSizeIterations) {
				console.log("Page rendered fully...")
				break
			}
			lastHTMLSize = currentHTMLSize
			await delay(checkDurationMsecs)
		}
	}
	async click(coordinate) {
		const [x, y] = coordinate.split(",").map(Number)
		return this.doAction(async (page) => {
			// Set up network request monitoring
			let hasNetworkActivity = false
			const requestListener = () => {
				hasNetworkActivity = true
			}
			page.on("request", requestListener)
			// Perform the click
			await page.mouse.click(x, y)
			this.currentMousePosition = coordinate
			// Small delay to check if click triggered any network activity
			await delay(100)
			if (hasNetworkActivity) {
				// If we detected network activity, wait for navigation/loading
				await page
					.waitForNavigation({
						waitUntil: ["domcontentloaded", "networkidle2"],
						timeout: 7000,
					})
					.catch(() => {})
				await this.waitTillHTMLStable(page)
			}
			// Clean up listener
			page.off("request", requestListener)
		})
	}
	async type(text) {
		return this.doAction(async (page) => {
			await page.keyboard.type(text)
		})
	}
	async scrollDown() {
		const size = (await this.context.globalState.get("browserViewportSize")) || "900x600"
		const height = parseInt(size.split("x")[1])
		return this.doAction(async (page) => {
			await page.evaluate((scrollHeight) => {
				window.scrollBy({
					top: scrollHeight,
					behavior: "auto",
				})
			}, height)
			await delay(300)
		})
	}
	async scrollUp() {
		const size = (await this.context.globalState.get("browserViewportSize")) || "900x600"
		const height = parseInt(size.split("x")[1])
		return this.doAction(async (page) => {
			await page.evaluate((scrollHeight) => {
				window.scrollBy({
					top: -scrollHeight,
					behavior: "auto",
				})
			}, height)
			await delay(300)
		})
	}
}
//# sourceMappingURL=BrowserSession.js.map
