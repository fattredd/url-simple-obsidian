import { App, PluginSettingTab, Setting } from "obsidian";

import SmartUrlCleanerPlugin from "main";

export interface SmartUrlCleanerSettings {
	autoFormat: boolean;
	stripTrackers: boolean;
	shortenUrls: boolean;
	customTrackingParams: string;
	enableShorteningAllPastes: boolean;
	enableTrackerStrippingAllPastes: boolean;
	enableFormattingAllPastes: boolean;
	autoFormatDomains: string;
}

export const DEFAULT_SETTINGS: SmartUrlCleanerSettings = {
	autoFormat: true,
	stripTrackers: true,
	shortenUrls: true,
	customTrackingParams: "",
	enableShorteningAllPastes: true,
	enableTrackerStrippingAllPastes: false,
	enableFormattingAllPastes: false,
	autoFormatDomains:
		"youtube.com, youtu.be, amazon., x.com, twitter.com, reddit.com",
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

		new Setting(containerEl).setName("Smart URL cleaner settings").setHeading();

		new Setting(containerEl).setName("Default paste override options").setHeading();

		new Setting(containerEl)
			.setName("Enable shortening for all pastes")
			.setDesc("Automatically shorten URLs when pasted into editor")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableShorteningAllPastes)
					.onChange(async (value) => {
						this.plugin.settings.enableShorteningAllPastes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable tracker stripping for all pastes")
			.setDesc(
				"Automatically strip tracking from URLs when pasted into editor"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.enableTrackerStrippingAllPastes
					)
					.onChange(async (value) => {
						this.plugin.settings.enableTrackerStrippingAllPastes =
							value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable formatting for all pastes")
			.setDesc("Automatically format select URLs when pasted into editor")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableFormattingAllPastes)
					.onChange(async (value) => {
						this.plugin.settings.enableFormattingAllPastes = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl).setName("Command options").setHeading();

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

		// Advanced Settings
		new Setting(containerEl).setName("Advanced settings").setHeading();

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

			new Setting(containerEl)
			.setName("Auto-format URLs")
			.setDesc(
				'Comma-separated list of domains to auto-format as Markdown links (e.g., "youtube.com,amazon."). Other domains will only have trackers stripped.'
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("youtube.com, youtu.be, amazon., x.com")
					.setValue(this.plugin.settings.autoFormatDomains)
					.onChange(async (value) => {
						this.plugin.settings.autoFormatDomains = value;
						await this.plugin.saveSettings();
					})
			);

		// Plugin Info
		containerEl
			.createEl("div", {
				cls: "setting-item",
				attr: { style: "padding: 20px 0; color: var(--text-muted);" },
			})
			.createEl("small", {
				text: "Simple URL Cleaner v1.0.0 • Automatically cleans, shortens, and titles URLs",
			});
	}
}
