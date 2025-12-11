import { Editor, Notice, Plugin } from "obsidian";

import {
	SmartUrlCleanerSettings,
	SmartUrlCleanerSettingTab,
	DEFAULT_SETTINGS,
} from "settings";
import { PlatformRule, AllPlatformRules } from "platform-rules";
import { tracking_parameters, essential_parameters } from "parameter_constants";

// ==================== INTERFACES AND TYPES ====================

interface UrlProcessingResult {
	originalUrl: string;
	cleanedUrl: string;
	finalUrl: string;
	title: string;
	markdownOutput: string;
	success: boolean;
	skipped?: boolean;
	error?: string;
}

interface TitleFetchResult {
	title: string;
	success: boolean;
	source: "direct" | "linkpreview" | "failed";
}

// ==================== MAIN PLUGIN CLASS ====================

export default class SmartUrlCleanerPlugin extends Plugin {
	settings: SmartUrlCleanerSettings;
	private platformRules: PlatformRule[] = [];

	async onload(): Promise<void> {
		console.log("Loading Smart URL Cleaner");

		// Initialize platform rules
		this.initializePlatformRules();

		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new SmartUrlCleanerSettingTab(this.app, this));

		// Register the paste event handler
		this.registerEvent(
			this.app.workspace.on(
				"editor-paste",
				async (evt: ClipboardEvent, editor: Editor) => {
					await this.handlePasteEvent(evt, editor);
				}
			)
		);

		// Register a command for pasting with processing
		this.addCommand({
			id: "paste-and-process-url",
			name: "Paste and Process URL from Clipboard",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "v" }],
			editorCallback: async (editor: Editor) => {
				await this.handleCommandPaste(editor, {
					skipFormatting: false,
					skipTracking: false,
				});
			},
		});

		// Register a command for pasting without processing
		this.addCommand({
			id: "paste-raw-url",
			name: "Paste and URL from Clipboard without Processing",
			editorCallback: async (editor: Editor) => {
				await this.handleCommandPaste(editor, {
					skipFormatting: true,
					skipTracking: true,
				});
			},
		});

		// Register a command for manual processing
		this.addCommand({
			id: "process-selected-url",
			name: "Process selected URL",
			editorCallback: async (editor: Editor) => {
				await this.processSelectedText(editor);
			},
		});

		// Show notice that plugin is loaded
		new Notice("Smart URL Cleaner loaded!");
	}

	private initializePlatformRules(): void {
		this.platformRules = AllPlatformRules;
	}

	private async handlePasteEvent(
		evt: ClipboardEvent,
		editor: Editor
	): Promise<void> {
		if (!this.settings.enableForAllPastes) return;

		const clipboardText = evt.clipboardData?.getData("text/plain");
		if (!clipboardText) return;

		const trimmedText = clipboardText.trim();
		if (!this.isValidUrl(trimmedText)) return;

		evt.preventDefault();

		try {
			const cursor = editor.getCursor();
			const processingText = "[Processing URL...]";
			editor.replaceRange(processingText, cursor);

			const result = await this.processUrl(trimmedText);

			if (!result.skipped) {
				const line = editor.getLine(cursor.line);
				const updatedLine = line.replace(
					processingText,
					result.markdownOutput
				);
				editor.setLine(cursor.line, updatedLine);
				editor.setCursor({
					line: cursor.line,
					ch: cursor.ch + result.markdownOutput.length,
				});
			} else {
				const line = editor.getLine(cursor.line);
				const updatedLine = line.replace(processingText, "");
				editor.setLine(cursor.line, updatedLine);
				editor.setCursor(cursor);
			}
		} catch (error) {
			console.error("Smart URL Cleaner processing failed:", error);
			editor.replaceRange(trimmedText, editor.getCursor());
		}
	}

	private async handleCommandPaste(
		editor: Editor,
		options: { skipFormatting: boolean; skipTracking: boolean }
	): Promise<void> {
		try {
			// Read from clipboard
			const clipboardText = await navigator.clipboard.readText();
			if (!clipboardText) {
				new Notice("Nothing on clipboard to paste");
				return;
			}

			const cursor = editor.getCursor();

			const trimmedText = clipboardText.trim();
			if (!this.isValidUrl(trimmedText)) {
				new Notice("Not a valid url");
				const clipboardString = clipboardText.toString();
				editor.replaceRange(clipboardString, cursor);
				editor.setCursor({
					line: cursor.line,
					ch: cursor.ch + clipboardString.length,
				});
				return;
			}

			const processingText = "[Processing URL...]";
			editor.replaceRange(processingText, cursor);

			// Process with command-specific overrides
			const result = await this.processUrl(trimmedText, options);
			console.log("result", result);

			const line = editor.getLine(cursor.line);
			const updatedLine = line.replace(
				processingText,
				result.markdownOutput
			);
			editor.setLine(cursor.line, updatedLine);
			editor.setCursor({
				line: cursor.line,
				ch: cursor.ch + result.markdownOutput.length,
			});

		} catch (error) {
			console.error("Command paste failed:", error);
			new Notice("Failed to paste URL");
		}
	}

	private async processSelectedText(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) return;

		const trimmedText = selection.trim();
		if (!this.isValidUrl(trimmedText)) {
			new Notice("Selected text is not a valid URL");
			return;
		}

		try {
			new Notice("Processing URL...");
			const result = await this.processUrl(trimmedText);
			editor.replaceSelection(result.finalUrl);
			new Notice("URL processed successfully!");
		} catch (error) {
			console.error("Processing failed:", error);
			new Notice("Failed to process URL");
		}
	}

	private isValidUrl(string: string): boolean {
		try {
			const url = new URL(string);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch (_) {
			return false;
		}
	}

	private wouldShortenUrl(url: URL): boolean {
		for (const rule of this.platformRules) {
			if (rule.matchHost.test(url.hostname)) {
				if (rule.matchPath) {
					const match = url.pathname.match(rule.matchPath);
					if (match) {
						const key = rule.extractKey(url, match);
						if (key) return true;
					}
				} else {
					const key = rule.extractKey(url);
					if (key) return true;
				}
			}
		}
		return false;
	}

	private hasTrackingParameters(url: URL): boolean {
		const allTrackingParams = [...tracking_parameters];
		if (this.settings.customTrackingParams) {
			const customParams = this.settings.customTrackingParams
				.split(",")
				.map((p) => p.trim().toLowerCase())
				.filter((p) => p.length > 0);
			allTrackingParams.push(...customParams);
		}

		let hasTrackers = false;
		url.searchParams.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			const isTrackingParam = allTrackingParams.some((tp) =>
				lowerKey.includes(tp.toLowerCase())
			);
			const isEssential = essential_parameters.includes(lowerKey);

			if (isTrackingParam && !isEssential) {
				hasTrackers = true;
			}
		});

		return hasTrackers;
	}

	private shouldAutoFormat(hostname: string): boolean {
		if (!this.settings.autoFormatDomains.trim()) return false;

		const domains = this.settings.autoFormatDomains
			.split(",")
			.map((d) => d.trim().toLowerCase())
			.filter((d) => d.length > 0);

		return domains.some((domain) =>
			hostname.toLowerCase().includes(domain)
		);
	}

	private async processUrl(
		originalUrl: string,
		commandOverrides?: { skipFormatting: boolean; skipTracking: boolean }
	): Promise<UrlProcessingResult> {

		let fetchTitle = commandOverrides?.skipFormatting
			? false
			: this.settings.fetchTitle;
		let stripTrackers = commandOverrides?.skipTracking
			? false
			: this.settings.stripTrackers;
		let shortenUrls = commandOverrides?.skipFormatting
			? false
			: this.settings.shortenUrls;

		const processingPromise = (async (): Promise<UrlProcessingResult> => {
			try {
				console.log(`Processing URL: ${originalUrl}`);
				const url = new URL(originalUrl);

				// === EARLY RETURN CHECKS ===
				// Check 1: Does it need shortening?
				const needsShortening =
					shortenUrls && this.wouldShortenUrl(url);

				// Check 2: Does it need auto-formatting?
				const needsAutoFormat =
					fetchTitle && this.shouldAutoFormat(url.hostname);

				// Check 3: Does it have trackers?
				const hasTrackers =
					stripTrackers && this.hasTrackingParameters(url);

				// EARLY RETURN: If none of the above apply, return original
				if (!needsShortening && !needsAutoFormat && !hasTrackers) {
					return {
						originalUrl,
						cleanedUrl: originalUrl,
						finalUrl: originalUrl,
						title: "",
						markdownOutput: originalUrl,
						success: true,
						skipped: true, // Add this flag to the interface too
					};
				}

				// === PROCESSING PIPELINE (only if needed) ===
				// Step 1: Clean tracking parameters (if needed)
				let cleanedUrl = originalUrl;
				if (hasTrackers) {
					cleanedUrl = this.stripTrackingParameters(url);
				}

				// Step 2: Apply shortening (if needed)
				let finalUrl = cleanedUrl;
				if (needsShortening) {
					finalUrl = await this.applyShorteningRules(
						new URL(cleanedUrl)
					);
				}

				// Step 3: Fetch title and format (if needed)
				let title = "";
				let markdownOutput = finalUrl;

				if (needsAutoFormat) {
					const titleResult = await this.fetchPageTitle(finalUrl);
					title = titleResult.title;

					let linkText = title;
					if (!linkText || linkText.trim() === "") {
						const finalUrlObj = new URL(finalUrl);
						linkText = finalUrlObj.hostname.replace("www.", "");
					}

					if (linkText.length > this.settings.titleMaxLength) {
						linkText =
							linkText.substring(
								0,
								this.settings.titleMaxLength
							) + "...";
					}

					markdownOutput = `[${linkText}](${finalUrl})`;
				}

				// Return processed result
				return {
					originalUrl,
					cleanedUrl,
					finalUrl,
					title,
					markdownOutput,
					success: true,
					skipped: false,
				};
			} catch (error) {
				console.error(`Error processing URL ${originalUrl}:`, error);
				return {
					originalUrl,
					cleanedUrl: originalUrl,
					finalUrl: originalUrl,
					title: "",
					markdownOutput: originalUrl,
					success: false,
					skipped: false,
					error:
						error instanceof Error
							? error.message
							: "Unknown error",
				};
			}
		})();

		return processingPromise;
	}

	private stripTrackingParameters(url: URL): string {
		const newUrl = new URL(url.toString());

		// Combine default tracking params with user-defined ones
		const allTrackingParams = [...tracking_parameters];
		if (this.settings.customTrackingParams) {
			const customParams = this.settings.customTrackingParams
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			allTrackingParams.push(...customParams);
		}

		// Remove tracking parameters
		newUrl.searchParams.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			const isTrackingParam = allTrackingParams.some((tp) => {
				lowerKey === tp.toLowerCase();
			});
			const isEssential = essential_parameters.includes(lowerKey);

			if (isTrackingParam && !isEssential) {
				console.info("removing tracking param", key, value);
				newUrl.searchParams.delete(key);
			}
		});

		return newUrl.toString();
	}

	private async applyShorteningRules(url: URL): Promise<string> {
		const hostname = url.hostname;
		const pathname = url.pathname;

		for (const rule of this.platformRules) {
			if (rule.matchHost.test(hostname)) {
				let match: RegExpMatchArray | null = null;

				// Check path if rule has path pattern
				if (rule.matchPath) {
					match = pathname.match(rule.matchPath);
					if (!match) continue;
				}

				// Extract key using the rule's extractor
				const key = rule.extractKey(url, match);
				if (key) {
					try {
						return rule.buildUrl(key, url);
					} catch (error) {
						console.warn(
							`Failed to build URL for rule ${rule.name}:`,
							error
						);
						continue;
					}
				}
			}
		}

		// No rule matched, return original
		return url.toString();
	}

	private async fetchPageTitle(url: string): Promise<TitleFetchResult> {
		// Don't fetch titles for local files or if disabled
		if (url.startsWith("file://") || !this.settings.fetchTitle) {
			return { title: "", success: false, source: "failed" };
		}

		// direct fetching
		try {
			const title = await this.fetchTitleDirect(url);
			return { title, success: !!title, source: "direct" };
		} catch (error) {
			console.warn("Direct title fetch failed:", error);
			return { title: "", success: false, source: "failed" };
		}
	}

	private async fetchTitleDirect(url: string): Promise<string> {
		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			this.settings.requestTimeout
		);

		try {
			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					"User-Agent":
						"Mozilla/5.0 (compatible; Obsidian-Smart-URL-Cleaner/1.0; +https://obsidian.md)",
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					"Accept-Language": "en-US,en;q=0.5",
					"Accept-Encoding": "gzip, deflate, br",
					Connection: "keep-alive",
					"Upgrade-Insecure-Requests": "1",
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const html = await response.text();

			// Try multiple methods to extract title
			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			if (titleMatch && titleMatch[1]) {
				let title = titleMatch[1].trim();

				// Clean up common patterns
				title = this.cleanTitle(title);

				// Truncate if too long
				if (title.length > this.settings.titleMaxLength) {
					title =
						title.substring(0, this.settings.titleMaxLength) +
						"...";
				}

				return title;
			}

			// Alternative: look for OpenGraph title
			const ogTitleMatch = html.match(
				/<meta[^>]*property="og:title"[^>]*content="([^"]+)"[^>]*>/i
			);
			if (ogTitleMatch && ogTitleMatch[1]) {
				return this.cleanTitle(ogTitleMatch[1]);
			}

			return "";
		} catch (error) {
			clearTimeout(timeoutId);
			throw error;
		}
	}

	private cleanTitle(title: string): string {
		return title
			.replace(/\s*\|\s*[^|]*$/, "") // Remove site name after "|"
			.replace(/\s*-\s*[^-]*$/, "") // Remove site name after "-"
			.replace(/\s*—\s*[^—]*$/, "") // Remove site name after "—"
			.replace(/\s*•\s*[^•]*$/, "") // Remove site name after "•"
			.replace(/\s*:\s*[^:]*$/, "") // Remove site name after ":"
			.replace(/\s+/g, " ") // Normalize whitespace
			.replace(/[\r\n]+/g, " ") // Remove line breaks
			.trim();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	onunload(): void {
		console.log("Unloading Smart URL Cleaner");
	}
}
