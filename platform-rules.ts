export interface PlatformRule {
	matchHost: RegExp;
	matchPath?: RegExp;
	extractKey: (url: URL, match?: RegExpMatchArray | null) => string | null;
	buildUrl: (key: string, originalUrl?: URL) => string;
	name: string;
}

export const AllPlatformRules = [
	{
		name: "YouTube",
		matchHost: /(?:www\.)?youtube\.com$/,
		matchPath: /^\/watch$/,
		extractKey: (url: URL): string | null => {
			return url.searchParams.get("v");
		},
		buildUrl: (key: string, originalUrl: URL): string => {
			const baseUrl = `https://youtu.be/${key}`;
			if (!originalUrl) {
				return baseUrl;
			}

			const newUrl = new URL(baseUrl);
			originalUrl.searchParams.forEach((value, name) => {
				if (name !== "v") {
					newUrl.searchParams.set(name, value);
				}
			});

			return newUrl.toString();
		},
	},
	{
		name: "Amazon",
		matchHost:
			/(?:www\.)?amazon\.(com|co\.uk|de|fr|es|it|ca|com\.au|com\.br|com\.mx|nl|se|pl|tr|ae|in|sg|jp|cn)$/,
		matchPath: /(\/(?:gp\/(?:product\/)?|dp\/)[A-Z0-9]{10})/,
		extractKey: (
			url: URL,
			match?: RegExpMatchArray | null
		): string | null => {
			if (match && match[1]) {
				return match[1];
			}
			// Alternative extraction from pathname
			const pathMatch = url.pathname.match(
				/(\/dp\/[A-Z0-9]{10}|\/gp\/product\/[A-Z0-9]{10})/
			);
			return pathMatch ? pathMatch[0] : null;
		},
		buildUrl: (key: string): string => {
			const cleanPath = key.replace(/\/(gp|dp)\/product\//, "/dp/");
			return `https://amazon.com${cleanPath}`;
		},
	},
	{
		name: "Twitter/X",
		matchHost: /(?:www\.)?(twitter|x)\.com$/,
		extractKey: (url: URL): string | null => {
			return url.pathname;
		},
		buildUrl: (key: string, originalUrl?: URL): string => {
			return `https://x.com${key}`;
		},
	},
	{
		name: "Reddit",
		matchHost: /(?:www\.)?reddit\.com$/,
		matchPath: /^\/r\/[^/]+\/comments\/[^/]+/,
		extractKey: (
			url: URL,
			match?: RegExpMatchArray | null
		): string | null => {
			const postIdMatch = url.pathname.match(/\/comments\/([a-z0-9]+)/);
			return postIdMatch ? postIdMatch[1] : null;
		},
		buildUrl: (key: string): string => {
			return `https://redd.it/${key}`;
		},
	},
];
