type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
	timestamp: string
	level: LogLevel
	component: string
	message: string
	data?: any
}

class Logger {
	private logs: LogEntry[] = []

	log(component: string, message: string, data?: any) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: "info",
			component,
			message,
			data,
		}

		this.logs.push(entry)
		console.log(`[${entry.timestamp}] [${entry.component}] ${entry.message}`, data ? data : "")
	}

	error(component: string, message: string, error?: any) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: "error",
			component,
			message,
			data: error,
		}

		this.logs.push(entry)
		console.error(`[${entry.timestamp}] [${entry.component}] ERROR: ${entry.message}`, error ? error : "")
	}

	debug(component: string, message: string, data?: any) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: "debug",
			component,
			message,
			data,
		}

		this.logs.push(entry)
		console.debug(`[${entry.timestamp}] [${entry.component}] DEBUG: ${entry.message}`, data ? data : "")
	}

	warn(component: string, message: string, data?: any) {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level: "warn",
			component,
			message,
			data,
		}

		this.logs.push(entry)
		console.warn(`[${entry.timestamp}] [${entry.component}] WARN: ${entry.message}`, data ? data : "")
	}

	async cleanup(): Promise<void> {
		// Clear logs
		this.logs = []
	}
}

export const logger = new Logger()
