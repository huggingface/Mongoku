import { contextStore } from "$lib/server/contextStore";
import { inspect } from "node:util";

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Logger class that wraps console methods for centralized logging
 */
class Logger {
	private structuredLogging: boolean;
	private logHeaders: string[];

	constructor() {
		this.structuredLogging = process.env.MONGOKU_STRUCTURED_LOG === "true";
		// Parse comma-delimited list of headers to log
		this.logHeaders = process.env.MONGOKU_LOG_HEADERS
			? process.env.MONGOKU_LOG_HEADERS.split(",")
					.map((h) => h.trim().toLowerCase())
					.filter(Boolean)
			: [];
	}

	/**
	 * Get request context information from the current request
	 */
	private getRequestContext() {
		const event = contextStore.getStore();
		if (!event) {
			return undefined;
		}

		const url = new URL(event.request.url);

		const context: Record<string, unknown> = {
			requestId: event.locals.requestId,
			method: event.request.method,
			url: url.pathname + url.search,
			ip: event.getClientAddress(),
			userAgent: event.request.headers.get("user-agent") || undefined,
		};

		// Add custom headers if configured
		if (this.logHeaders.length > 0) {
			const headers: Record<string, string> = {};
			for (const headerName of this.logHeaders) {
				const value = event.request.headers.get(headerName);
				if (value) {
					headers[headerName] = value;
				}
			}
			if (Object.keys(headers).length > 0) {
				context.headers = headers;
			}
		}

		return context;
	}

	/**
	 * Format arguments for logging
	 */
	private formatArgs(args: unknown[]): string {
		return args
			.map((arg) => {
				if (arg instanceof Error) {
					return (
						(arg.stack ?? `${arg.name}: ${arg.message}`) +
						(arg.cause instanceof Error
							? `\ncause: ${arg.cause.stack ?? `${arg.cause.name}: ${arg.cause.message}`}`
							: "")
					);
				} else if (typeof arg === "string") {
					return arg;
				} else {
					return inspect(arg, { depth: 20, colors: !this.structuredLogging });
				}
			})
			.join("  ");
	}

	/**
	 * Internal log method that handles both structured and unstructured logging
	 */
	private _log(level: LogLevel, args: unknown[]): void {
		const message = this.formatArgs(args);

		if (this.structuredLogging) {
			const logEntry = {
				level,
				time: new Date().toISOString(),
				message,
				...this.getRequestContext(),
			};
			console.log(JSON.stringify(logEntry));
		} else {
			// Use appropriate console method based on level
			switch (level) {
				case "error":
					console.error(message);
					break;
				case "warn":
					console.warn(message);
					break;
				case "debug":
					console.debug(message);
					break;
				default:
					console.log(message);
			}
		}
	}

	/**
	 * Log an informational message
	 */
	log(...args: unknown[]): void {
		this._log("info", args);
	}

	/**
	 * Log an informational message (alias for log)
	 */
	info(...args: unknown[]): void {
		this._log("info", args);
	}

	/**
	 * Log an error message
	 */
	error(...args: unknown[]): void {
		this._log("error", args);
	}

	/**
	 * Log a warning message
	 */
	warn(...args: unknown[]): void {
		this._log("warn", args);
	}

	/**
	 * Log a debug message
	 */
	debug(...args: unknown[]): void {
		this._log("debug", args);
	}

	/**
	 * Log an HTTP request
	 */
	logRequest(statusCode: number, durationMs: number): void {
		const duration = Math.round(durationMs * 100) / 100; // Round to 2 decimal places

		if (this.structuredLogging) {
			const logEntry = {
				level: "info" as LogLevel,
				time: new Date().toISOString(),
				type: "request",
				statusCode,
				duration,
				...this.getRequestContext(),
			};

			console.log(JSON.stringify(logEntry));
		} else {
			// Simple console log for non-structured mode
			const event = contextStore.getStore();
			if (event) {
				const url = new URL(event.request.url);
				const urlPath = url.pathname + url.search;
				const method = event.request.method;
				const message = `${statusCode} ${method} ${urlPath} ${duration}ms`;
				if (statusCode >= 400) {
					console.error(message);
				} else {
					console.log(message);
				}
			}
		}
	}
}

// Export a singleton instance
export const logger = new Logger();
