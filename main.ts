import { Editor, Notice, Plugin } from "obsidian";

import {
	SmartUrlCleanerSettings,
	SmartUrlCleanerSettingTab,
	DEFAULT_SETTINGS,
} from "settings";
import { PlatformRule, AllPlatformRules } from "platform-rules";
import { UrlProcessor } from "./urlProcessor";

// ==================== MAIN PLUGIN CLASS ====================

export default class SmartUrlCleanerPlugin extends Plugin {
	settings: SmartUrlCleanerSettings;
	public platformRules: PlatformRule[] = [];
	urlProcessor: UrlProcessor;

	async onload(): Promise<void> {
		// Initialize platform rules
		this.platformRules = AllPlatformRules;

		// Load settings
		await this.loadSettings();

		// Initialize URL processor
		this.urlProcessor = new UrlProcessor({
			settings: this.settings,
			platformRules: this.platformRules,
		});

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
			name: "Paste and process URL from clipboard",
			editorCallback: async (editor: Editor) => {
				await this.handleCommandPaste(editor, {
					skipShortening: false,
					skipTracking: false,
					skipFormatting: false,
				});
			},
		});

		// Register a command for pasting without processing
		this.addCommand({
			id: "paste-raw-url",
			name: "Paste URL from clipboard without processing",
			editorCallback: async (editor: Editor) => {
				await this.handleCommandPaste(editor, {
					skipShortening: true,
					skipTracking: true,
					skipFormatting: true,
				});
			},
		});

		// Register a command for manual processing
		this.addCommand({
			id: "process-selected-url",
			name: "Process selected url",
			editorCallback: async (editor: Editor) => {
				await this.processSelectedText(editor);
			},
		});
	}

	private async handlePasteEvent(
		evt: ClipboardEvent,
		editor: Editor
	): Promise<void> {
		if (
			!this.settings.enableShorteningAllPastes &&
			!this.settings.enableTrackerStrippingAllPastes &&
			!this.settings.enableFormattingAllPastes
		)
			return;
		evt.preventDefault();

		const selection = editor.getSelection();
		if (selection) {
			editor.replaceSelection("");
		}

		await this.handleCommandPaste(editor, {
			skipShortening: !this.settings.enableShorteningAllPastes,
			skipTracking: !this.settings.enableTrackerStrippingAllPastes,
			skipFormatting: !this.settings.enableFormattingAllPastes,
		});
	}

	private async handleCommandPaste(
		editor: Editor,
		options: {
			skipShortening: boolean;
			skipTracking: boolean;
			skipFormatting: boolean;
		}
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
			const result = await this.urlProcessor.processUrl(
				trimmedText,
				options
			);

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
		} catch {}
	}

	private async processSelectedText(editor: Editor): Promise<void> {
		const selection = editor.getSelection();
		if (!selection) return;

		const trimmedText = selection.trim();
		if (!this.isValidUrl(trimmedText)) {
			new Notice("Selected text is not a valid url");
			return;
		}

		try {
			new Notice("Processing URL...");
			const result = this.urlProcessor.processUrl(trimmedText);
			editor.replaceSelection(result.finalUrl);
			new Notice("Url processed successfully!");
		} catch (error) {
			console.error("Processing failed:", error);
			new Notice("Failed to process url");
		}
	}

	private isValidUrl(string: string): boolean {
		try {
			const url = new URL(string);
			return url.protocol === "http:" || url.protocol === "https:";
		} catch {
			return false;
		}
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
}
