import type { Action } from "svelte/action";

interface JsonTextareaParams {
	onsubmit?: () => void;
	onescape?: () => void;
}

function getIndentation(text: string): string {
	const match = text.match(/^(\s*)/);
	return match ? match[1] : "";
}

function handleSkipClosing(
	event: KeyboardEvent,
	target: HTMLTextAreaElement,
	textValue: string,
	selectionStart: number,
	selectionEnd: number,
): boolean {
	// Skip if any modifier keys or there's a selection
	if (event.ctrlKey || event.altKey || event.metaKey || selectionStart !== selectionEnd) return false;

	const closingChars = ["}", "]", ")", '"', "'", "`"];
	if (!closingChars.includes(event.key)) return false;

	// Check if next character is the same as what we're typing
	const nextChar = textValue[selectionStart];
	if (nextChar !== event.key) return false;

	event.preventDefault();

	// Just move cursor forward one position
	requestAnimationFrame(() => {
		target.setSelectionRange(selectionStart + 1, selectionStart + 1);
	});
	return true;
}

function handleAutoPairing(
	event: KeyboardEvent,
	target: HTMLTextAreaElement,
	textValue: string,
	selectionStart: number,
	selectionEnd: number,
): boolean {
	// Skip if any modifier keys (except shift for shift+2 = @, etc.)
	if (event.ctrlKey || event.altKey || event.metaKey) return false;

	const pairs: Record<string, string> = {
		"{": "}",
		"[": "]",
		"(": ")",
		'"': '"',
		"'": "'",
		"`": "`",
	};

	const closingChar = pairs[event.key];
	if (!closingChar) return false;

	event.preventDefault();

	// If there's a selection, wrap it with the pair
	if (selectionStart !== selectionEnd) {
		const selectedText = textValue.substring(selectionStart, selectionEnd);
		const newValue =
			textValue.substring(0, selectionStart) +
			event.key +
			selectedText +
			closingChar +
			textValue.substring(selectionEnd);
		target.value = newValue;
		target.dispatchEvent(new Event("input", { bubbles: true }));

		// Select the wrapped text (excluding the added characters)
		requestAnimationFrame(() => {
			target.setSelectionRange(selectionStart + 1, selectionEnd + 1);
		});
		return true;
	}

	// Insert both opening and closing characters
	const newValue = textValue.substring(0, selectionStart) + event.key + closingChar + textValue.substring(selectionEnd);
	target.value = newValue;
	target.dispatchEvent(new Event("input", { bubbles: true }));

	// Position cursor between the pair
	requestAnimationFrame(() => {
		target.setSelectionRange(selectionStart + 1, selectionStart + 1);
	});
	return true;
}

function handleDeindent(target: HTMLTextAreaElement, textValue: string, selectionStart: number, selectionEnd: number) {
	// Single cursor position
	if (selectionStart === selectionEnd) {
		const lineStart = textValue.lastIndexOf("\n", selectionStart - 1) + 1;
		const lineText = textValue.substring(lineStart, selectionStart);
		const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || "";

		if (leadingWhitespace.length === 0) return;

		// Remove one tab or up to 2 spaces
		let charsToRemove = 1;
		if (leadingWhitespace.startsWith("\t")) {
			charsToRemove = 1;
		} else if (leadingWhitespace.startsWith("  ")) {
			charsToRemove = 2;
		} else if (leadingWhitespace.startsWith(" ")) {
			charsToRemove = 1;
		}

		const newValue = textValue.substring(0, lineStart) + textValue.substring(lineStart + charsToRemove);
		target.value = newValue;
		target.dispatchEvent(new Event("input", { bubbles: true }));

		// Move cursor back
		requestAnimationFrame(() => {
			target.setSelectionRange(selectionStart - charsToRemove, selectionStart - charsToRemove);
		});
		return;
	}

	// Selection: deindent all lines
	const beforeSelection = textValue.substring(0, selectionStart);
	const afterSelection = textValue.substring(selectionEnd);

	const lineStartPos = beforeSelection.lastIndexOf("\n") + 1;
	const fullSelection = textValue.substring(lineStartPos, selectionEnd);
	const fullLines = fullSelection.split("\n");

	const deindentedLines = fullLines.map((line) => {
		const leadingWhitespace = line.match(/^(\s*)/)?.[1] || "";
		if (leadingWhitespace.length === 0) return line;

		if (leadingWhitespace.startsWith("\t")) {
			return line.substring(1);
		}
		if (leadingWhitespace.startsWith("  ")) {
			return line.substring(2);
		}
		if (leadingWhitespace.startsWith(" ")) {
			return line.substring(1);
		}
		return line;
	});

	const newValue = textValue.substring(0, lineStartPos) + deindentedLines.join("\n") + afterSelection;
	target.value = newValue;
	target.dispatchEvent(new Event("input", { bubbles: true }));

	// Maintain selection
	requestAnimationFrame(() => {
		const newSelectionStart = lineStartPos;
		const newSelectionEnd = lineStartPos + deindentedLines.join("\n").length;
		target.setSelectionRange(newSelectionStart, newSelectionEnd);
	});
}

function handleIndent(target: HTMLTextAreaElement, textValue: string, selectionStart: number, selectionEnd: number) {
	// Single cursor: insert tab at cursor
	if (selectionStart === selectionEnd) {
		const newValue = textValue.substring(0, selectionStart) + "\t" + textValue.substring(selectionEnd);
		target.value = newValue;
		target.dispatchEvent(new Event("input", { bubbles: true }));

		// Move cursor after tab
		requestAnimationFrame(() => {
			target.setSelectionRange(selectionStart + 1, selectionStart + 1);
		});
		return;
	}

	// Selection: indent all lines
	const beforeSelection = textValue.substring(0, selectionStart);
	const afterSelection = textValue.substring(selectionEnd);

	const lineStartPos = beforeSelection.lastIndexOf("\n") + 1;
	const fullSelection = textValue.substring(lineStartPos, selectionEnd);
	const lines = fullSelection.split("\n");

	const indentedLines = lines.map((line) => "\t" + line);

	const newValue = textValue.substring(0, lineStartPos) + indentedLines.join("\n") + afterSelection;
	target.value = newValue;
	target.dispatchEvent(new Event("input", { bubbles: true }));

	// Maintain selection
	requestAnimationFrame(() => {
		const newSelectionStart = lineStartPos;
		const newSelectionEnd = lineStartPos + indentedLines.join("\n").length;
		target.setSelectionRange(newSelectionStart, newSelectionEnd);
	});
}

function handleEnterKey(
	event: KeyboardEvent,
	target: HTMLTextAreaElement,
	textValue: string,
	selectionStart: number,
	selectionEnd: number,
) {
	event.preventDefault();

	// Get current line
	const lineStart = textValue.lastIndexOf("\n", selectionStart - 1) + 1;
	const lineEnd = textValue.indexOf("\n", selectionStart);
	const currentLine = textValue.substring(lineStart, lineEnd === -1 ? textValue.length : lineEnd);

	// Get current indentation
	const currentIndent = getIndentation(currentLine);

	// Check if previous character is { or [
	const charBeforeCursor = textValue[selectionStart - 1];
	const charAfterCursor = textValue[selectionStart];

	if (charBeforeCursor !== "{" && charBeforeCursor !== "[") {
		// Just insert newline with same indentation
		const insertion = "\n" + currentIndent;
		const newValue = textValue.substring(0, selectionStart) + insertion + textValue.substring(selectionEnd);
		target.value = newValue;
		target.dispatchEvent(new Event("input", { bubbles: true }));

		requestAnimationFrame(() => {
			target.setSelectionRange(selectionStart + insertion.length, selectionStart + insertion.length);
		});
		return;
	}

	// Insert newline with increased indent, then another newline with current indent
	const extraIndent = "\t";
	let insertion = "\n" + currentIndent + extraIndent;
	const cursorOffset = insertion.length;

	// If next char is } or ], add closing line
	if (charAfterCursor === "}" || charAfterCursor === "]") {
		insertion += "\n" + currentIndent;
	}

	const newValue = textValue.substring(0, selectionStart) + insertion + textValue.substring(selectionEnd);
	target.value = newValue;
	target.dispatchEvent(new Event("input", { bubbles: true }));

	requestAnimationFrame(() => {
		target.setSelectionRange(selectionStart + cursorOffset, selectionStart + cursorOffset);
	});
}

function handleClosingBrace(
	event: KeyboardEvent,
	target: HTMLTextAreaElement,
	textValue: string,
	selectionStart: number,
	selectionEnd: number,
) {
	// Get current line up to cursor
	const lineStart = textValue.lastIndexOf("\n", selectionStart - 1) + 1;
	const lineBeforeCursor = textValue.substring(lineStart, selectionStart);

	// Check if line only contains whitespace
	if (!/^\s*$/.test(lineBeforeCursor) || lineBeforeCursor.length === 0) return;

	event.preventDefault();

	const closingChar = event.key; // Either } or ]

	// Remove one level of indentation
	const indentMatch = lineBeforeCursor.match(/^(\s*)/);
	const indent = indentMatch ? indentMatch[1] : "";

	if (indent.length === 0) {
		// No indentation to remove, just insert closing character
		const newValue = textValue.substring(0, selectionStart) + closingChar + textValue.substring(selectionEnd);
		target.value = newValue;
		target.dispatchEvent(new Event("input", { bubbles: true }));

		requestAnimationFrame(() => {
			target.setSelectionRange(selectionStart + 1, selectionStart + 1);
		});
		return;
	}

	let charsToRemove = 1;
	if (indent.endsWith("\t")) {
		charsToRemove = 1;
	} else if (indent.length >= 2 && indent.endsWith("  ")) {
		charsToRemove = 2;
	} else if (indent.endsWith(" ")) {
		charsToRemove = 1;
	}

	// Remove indentation and add closing character
	const newValue =
		textValue.substring(0, selectionStart - charsToRemove) + closingChar + textValue.substring(selectionEnd);
	target.value = newValue;
	target.dispatchEvent(new Event("input", { bubbles: true }));

	requestAnimationFrame(() => {
		target.setSelectionRange(selectionStart - charsToRemove + 1, selectionStart - charsToRemove + 1);
	});
}

export const jsonTextarea: Action<HTMLTextAreaElement, JsonTextareaParams | undefined> = (node, params) => {
	function handleKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLTextAreaElement;
		const { selectionStart, selectionEnd, value: textValue } = target;

		// Escape to blur and move to next/previous focusable element
		if (event.key === "Escape") {
			event.preventDefault();

			// Call custom escape handler if provided
			if (params?.onescape) {
				params.onescape();
				return;
			}

			target.blur();

			// Find all focusable elements
			const focusableElements = Array.from(
				document.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
				),
			).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);

			const currentIndex = focusableElements.indexOf(target);

			// Shift+Escape goes backward, Escape goes forward
			const targetElement = event.shiftKey ? focusableElements[currentIndex - 1] : focusableElements[currentIndex + 1];

			if (targetElement) {
				targetElement.focus();
			}
			return;
		}

		// Ctrl+Enter to submit
		if (event.ctrlKey && event.key === "Enter") {
			event.preventDefault();
			params?.onsubmit?.();
			return;
		}

		// Skip over closing characters if they're already there
		if (handleSkipClosing(event, target, textValue, selectionStart, selectionEnd)) {
			return;
		}

		// Auto-pairing for quotes and braces
		if (handleAutoPairing(event, target, textValue, selectionStart, selectionEnd)) {
			return;
		}

		// Tab key handling
		if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey) {
			// Enter key handling
			if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
				handleEnterKey(event, target, textValue, selectionStart, selectionEnd);
				return;
			}

			// } and ] key handling - auto-deindent
			if (
				(event.key === "}" || event.key === "]") &&
				!event.ctrlKey &&
				!event.shiftKey &&
				!event.altKey &&
				!event.metaKey
			) {
				handleClosingBrace(event, target, textValue, selectionStart, selectionEnd);
			}
			return;
		}

		event.preventDefault();

		// Shift+Tab: deindent
		if (event.shiftKey) {
			handleDeindent(target, textValue, selectionStart, selectionEnd);
			return;
		}

		// Tab: indent
		handleIndent(target, textValue, selectionStart, selectionEnd);
	}

	node.addEventListener("keydown", handleKeydown);

	return {
		destroy() {
			node.removeEventListener("keydown", handleKeydown);
		},
	};
};
