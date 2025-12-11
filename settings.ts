import { App, PluginSettingTab, Setting } from "obsidian";

import SmartUrlCleanerPlugin from "main";

export interface SmartUrlCleanerSettings {
	fetchTitle: boolean;
	stripTrackers: boolean;
	shortenUrls: boolean;
	customTrackingParams: string;
	enableForAllPastes: boolean;
	requestTimeout: number;
	titleMaxLength: number;
	autoFormatDomains: string;
}

export const DEFAULT_SETTINGS: SmartUrlCleanerSettings = {
	fetchTitle: true,
	stripTrackers: true,
	shortenUrls: true,
	customTrackingParams: "",
	enableForAllPastes: true,
	requestTimeout: 5000,
	titleMaxLength: 100,
	autoFormatDomains:
		"youtube.com,youtu.be,amazon.,x.com,twitter.com,reddit.com",
};

export class SmartUrlCleanerSettingTab extends PluginSettingTab {
	plugin: SmartUrlCleanerPlugin;

	constructor(app: App, plugin: SmartUrlCleanerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Smart URL Cleaner Settings" });

		// Basic Settings
		new Setting(containerEl)
			.setName("Enable for all pastes")
			.setDesc("Automatically process URLs when pasted into editor")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableForAllPastes)
					.onChange(async (value) => {
						this.plugin.settings.enableForAllPastes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Fetch page titles")
			.setDesc("Automatically fetch and insert page titles as link text")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.fetchTitle)
					.onChange(async (value) => {
						this.plugin.settings.fetchTitle = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Strip tracking parameters")
			.setDesc(
				"Remove UTM parameters, click IDs, and other tracking data"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripTrackers)
					.onChange(async (value) => {
						this.plugin.settings.stripTrackers = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Shorten known URLs")
			.setDesc("Convert YouTube, Amazon, etc. to their short forms")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.shortenUrls)
					.onChange(async (value) => {
						this.plugin.settings.shortenUrls = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-format domains")
			.setDesc(
				'Comma-separated list of domains to auto-format as Markdown links (e.g., "youtube.com,amazon."). Other domains will only have trackers stripped.'
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("youtube.com,youtu.be,amazon.,x.com")
					.setValue(this.plugin.settings.autoFormatDomains)
					.onChange(async (value) => {
						this.plugin.settings.autoFormatDomains = value;
						await this.plugin.saveSettings();
					})
			);

		// Title Fetching Settings
		containerEl.createEl("h3", { text: "Title Fetching Options" });

		new Setting(containerEl)
			.setName("Request timeout (ms)")
			.setDesc("Maximum time to wait for title fetching (milliseconds)")
			.addText((text) =>
				text
					.setPlaceholder("5000")
					.setValue(this.plugin.settings.requestTimeout.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue > 0) {
							this.plugin.settings.requestTimeout = numValue;
							await this.plugin.saveSettings();
						}
					})
			);

		new Setting(containerEl)
			.setName("Maximum title length")
			.setDesc("Truncate titles longer than this number of characters")
			.addText((text) =>
				text
					.setPlaceholder("100")
					.setValue(this.plugin.settings.titleMaxLength.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue > 0) {
							this.plugin.settings.titleMaxLength = numValue;
							await this.plugin.saveSettings();
						}
					})
			);

		// Advanced Settings
		containerEl.createEl("h3", { text: "Advanced Settings" });

		new Setting(containerEl)
			.setName("Custom tracking parameters")
			.setDesc("Comma-separated list of additional parameters to remove")
			.addTextArea((text) =>
				text
					.setPlaceholder("tracking_id,session_id,custom_param")
					.setValue(this.plugin.settings.customTrackingParams)
					.onChange(async (value) => {
						this.plugin.settings.customTrackingParams = value;
						await this.plugin.saveSettings();
					})
			);

		// Plugin Info
		containerEl.createEl("hr");
		containerEl
			.createEl("div", {
				cls: "setting-item",
				attr: { style: "padding: 20px 0; color: var(--text-muted);" },
			})
			.createEl("small", {
				text: "Smart URL Cleaner v1.0.0 • Automatically cleans, shortens, and titles URLs",
			});
	}
}
