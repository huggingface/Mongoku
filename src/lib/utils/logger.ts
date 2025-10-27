/**
 * Logger class that wraps console methods for centralized logging
 */
class Logger {
	/**
	 * Log an informational message
	 */
	log(...args: unknown[]): void {
		console.log(...args);
	}

	/**
	 * Log an informational message (alias for log)
	 */
	info(...args: unknown[]): void {
		console.log(...args);
	}

	/**
	 * Log an error message
	 */
	error(...args: unknown[]): void {
		console.error(...args);
	}

	/**
	 * Log a warning message
	 */
	warn(...args: unknown[]): void {
		console.warn(...args);
	}

	/**
	 * Log a debug message
	 */
	debug(...args: unknown[]): void {
		console.debug(...args);
	}
}

// Export a singleton instance
export const logger = new Logger();
