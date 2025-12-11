import { SmartUrlCleanerSettings } from "./settings";
import { PlatformRule } from "./platform-rules";
import {
	tracking_parameters,
	essential_parameters,
} from "./parameter_constants";

// ==================== INTERFACES AND TYPES ====================

export interface UrlProcessingResult {
	originalUrl: string;
	cleanedUrl: string;
	finalUrl: string;
	title: string;
	markdownOutput: string;
	success: boolean;
	skipped?: boolean;
	error?: string;
}

export interface TitleFetchResult {
	title: string;
	success: boolean;
	source: "direct" | "default" | "failed";
}

interface PluginDeps {
	settings: SmartUrlCleanerSettings;
	platformRules: PlatformRule[];
}

// ==================== URL PROCESSOR CLASS ====================

export class UrlProcessor {
	private deps: PluginDeps;

	constructor(deps: PluginDeps) {
		this.deps = deps;
	}

	wouldShortenUrl(url: URL): boolean {
		for (const rule of this.deps.platformRules) {
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

	hasTrackingParameters(url: URL): boolean {
		const allTrackingParams = [...tracking_parameters];
		if (this.deps.settings.customTrackingParams) {
			const customParams = this.deps.settings.customTrackingParams
				.split(",")
				.map((p) => p.trim().toLowerCase())
				.filter((p) => p.length > 0);
			allTrackingParams.push(...customParams);
		}

		let hasTrackers = false;
		url.searchParams.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			const isTrackingParam = allTrackingParams.some((tp) => {
				return lowerKey === tp.toLowerCase();
			});
			const isEssential = essential_parameters.includes(lowerKey);

			if (isTrackingParam && !isEssential) {
				hasTrackers = true;
			}
		});

		return hasTrackers;
	}

	shouldAutoFormat(hostname: string): boolean {
		if (!this.deps.settings.autoFormatDomains.trim()) return false;

		const domains = this.deps.settings.autoFormatDomains
			.split(",")
			.map((d) => d.trim().toLowerCase())
			.filter((d) => d.length > 0);

		return domains.some((domain) =>
			hostname.toLowerCase().includes(domain)
		);
	}

	async processUrl(
		originalUrl: string,
		commandOverrides?: {
			skipShortening: boolean;
			skipTracking: boolean;
			skipFormatting: boolean;
		}
	): Promise<UrlProcessingResult> {
		const shortenUrls = commandOverrides?.skipShortening
			? false
			: this.deps.settings.shortenUrls;
		const stripTrackers = commandOverrides?.skipTracking
			? false
			: this.deps.settings.stripTrackers;
		const autoFormat = commandOverrides?.skipFormatting
			? false
			: this.deps.settings.autoFormat;

		const processingPromise = (async (): Promise<UrlProcessingResult> => {
			try {
				const url = new URL(originalUrl);

				// === EARLY RETURN CHECKS ===
				// Check 1: Does it need shortening?
				const needsShortening =
					shortenUrls && this.wouldShortenUrl(url);

				// Check 2: Does it have trackers?
				const hasTrackers =
					stripTrackers && this.hasTrackingParameters(url);

				// Check 3: Does it need auto-formatting?
				const needsAutoFormat =
					autoFormat && this.shouldAutoFormat(url.hostname);

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

	stripTrackingParameters(url: URL): string {
		const newUrl = new URL(url.toString());

		// Combine default tracking params with user-defined ones
		const allTrackingParams = [...tracking_parameters];
		if (this.deps.settings.customTrackingParams) {
			const customParams = this.deps.settings.customTrackingParams
				.split(",")
				.map((p) => p.trim())
				.filter((p) => p.length > 0);
			allTrackingParams.push(...customParams);
		}

		// Remove tracking parameters
		newUrl.searchParams.forEach((value, key) => {
			const lowerKey = key.toLowerCase();
			const isTrackingParam = allTrackingParams.some((tp) => {
				return lowerKey == tp.toLowerCase();
			});
			const isEssential = essential_parameters.includes(lowerKey);

			if (isTrackingParam && !isEssential) {
				newUrl.searchParams.delete(key);
			}
		});

		return newUrl.toString();
	}

	async applyShorteningRules(url: URL): Promise<string> {
		const hostname = url.hostname;
		const pathname = url.pathname;

		for (const rule of this.deps.platformRules) {
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

	async fetchPageTitle(url: string): Promise<TitleFetchResult> {
		// Don't fetch titles for local files or if disabled
		if (url.startsWith("file://") || !this.deps.settings.autoFormat) {
			return { title: "", success: false, source: "failed" };
		}

		return { title: "", success: true, source: "default" };

		// TODO: direct fetching
	}

	cleanTitle(title: string): string {
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
}
