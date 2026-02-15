export default {

    IS_FAKE_BOT: 1,
    IS_FAKE_HUMAN: 2,
    IS_REAL_BOT: 0,
    IS_REAL_BOT_WITH_FAKE_USER_AGENT: 4,
    IS_REAL_HUMAN: 3,

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const headers = request.headers;
        const userAgent = (headers.get("user-agent") || "").toLowerCase();

        // 1. Bot Detection
        const botEvaluation = await this.defineExternalBots(request, env, ctx);
        const isBot = botEvaluation === this.IS_REAL_BOT ||
            botEvaluation === this.IS_FAKE_BOT ||
            botEvaluation === this.IS_REAL_BOT_WITH_FAKE_USER_AGENT ||
            botEvaluation === true; // Fallback for simple boolean returns

        // 2. Redirection (Ensure clean URLs)
        // Redirect /static/* and /__bots/* to /*
        const match = url.pathname.match(/^\/(static|__bots)(\/.*)?$/i);
        if (match) {
            let cleanPath = match[2] || "/";
            if (cleanPath === "/index.html") cleanPath = "/";
            return Response.redirect(new URL(cleanPath, url.origin), 301);
        }

        // Redirect /index.html to /
        if (url.pathname === "/index.html") {
            return Response.redirect(new URL("/", url.origin), 301);
        }

        // 3. Asset Serving logic
        const targetDir = isBot ? "/__bots" : "/static";

        const assetsModule = env.ASSETS || Object.values(env).find(v => v && typeof v.fetch === 'function');
        if (!assetsModule) {
            return new Response("Internal Server Error: Assets binding missing", { status: 500 });
        }

        const serveAsset = async (path) => {
            const assetUrl = new URL(request.url);
            assetUrl.pathname = `${targetDir}${path}`.replace(/\/+/g, "/");

            if (url.pathname !== "/favicon.ico") {
                console.log(`[SERVE] ${url.pathname} -> ${assetUrl.pathname}`);
            }

            let response = await assetsModule.fetch(new Request(assetUrl, request));

            // Add debug header to show which path was used
            const newHeaders = new Headers(response.headers);
            newHeaders.set("X-Served-From", `${targetDir} (eval: ${botEvaluation})`);

            let res = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });

            // Follow internal redirects once (e.g., if it wants to add a trailing slash or go to index.html)
            if ([301, 302, 307, 308].includes(res.status)) {
                const loc = res.headers.get("Location");
                if (loc) {
                    const locUrl = new URL(loc, url.origin);
                    if (locUrl.pathname.startsWith(targetDir)) {
                        const redirectRes = await assetsModule.fetch(new Request(locUrl, request));
                        const redirectHeaders = new Headers(redirectRes.headers);
                        redirectHeaders.set("X-Served-From", `${targetDir} (eval: ${botEvaluation})`);
                        return new Response(redirectRes.body, {
                            status: redirectRes.status,
                            statusText: redirectRes.statusText,
                            headers: redirectHeaders
                        });
                    }
                }
            }
            return res;
        };

        let path = url.pathname;
        if (path === "/") path = "/index.html";

        let response = await serveAsset(path);

        // Extension-less fallback
        if (response.status === 404 && !path.includes(".") && !path.endsWith("/")) {
            console.log(`[FALLBACK] Trying ${path}.html`);
            const fallbackRes = await serveAsset(`${path}.html`);
            if (fallbackRes.ok) {
                return fallbackRes;
            }
        }

        return response;
    },

    /**
     * Define bots by request and context
     */
    async defineExternalBots(request, env, ctx) {
        const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
        const botPatterns = [/bot/i, /spider/i, /crawler/i, /lighthouse/i, /headless/i, /slurp/i];
        const isBot = botPatterns.some(p => p.test(userAgent)) ||
            ["x-bot-agent", "x-is-bot", "x-crawler-test"].some(h => request.headers.has(h));
        const isGoogleBotEasy = userAgent.includes("googlebot");
        if (isGoogleBotEasy) {
            let isRealBot = await this.defineGoogleBot(request, env, ctx);
            if (isRealBot) {
                return this.IS_REAL_BOT;
            }
            return this.IS_FAKE_BOT;
        }
        return isBot;
    },

    async defineGoogleBot(request, env, ctx) {
        const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
        if (!userAgent.includes("googlebot")) return false;

        // first method bot is good
        try {
            const isVerified = request.cf?.botManagement?.verifiedBot || request.cf?.isVerifiedBot;
            if (isVerified) {
                return this.IS_REAL_BOT;
            }
        } catch (e) {
            console.error("Bot verification failed:", e);
        }

        const hostname = await this.defineGoogleBotReverseDns(request, env, ctx);
        if (!hostname) return false;

        return await this.defineGoogleBotForwardDns(hostname, request, env, ctx);
    },

    async defineGoogleBotReverseDns(request, env, ctx) {
        const ip = request.headers.get("cf-connecting-ip");
        if (!ip) return null;

        let reverseName;
        if (ip.includes(':')) {
            // IPv6
            const [prefix, suffix] = ip.split('::');
            const prefixParts = prefix ? prefix.split(':') : [];
            const suffixParts = suffix ? suffix.split(':') : [];
            const missingCount = 8 - (prefixParts.length + suffixParts.length);
            const fullParts = [...prefixParts, ...Array(missingCount).fill('0'), ...suffixParts];
            const expanded = fullParts.map(part => part.padStart(4, '0')).join('');
            reverseName = expanded.split('').reverse().join('.') + '.ip6.arpa';
        } else {
            // IPv4
            reverseName = ip.split('.').reverse().join('.') + '.in-addr.arpa';
        }

        try {
            const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${reverseName}&type=PTR`, {
                headers: { 'accept': 'application/dns-json' }
            });
            const json = await response.json();

            if (json.Answer && json.Answer.length > 0) {
                const hostname = json.Answer[0].data.toLowerCase().replace(/\.$/, "");
                if (hostname.endsWith(".googlebot.com") || hostname.endsWith(".google.com")) {
                    return hostname;
                }
            }
        } catch (e) {
            console.error("Reverse DNS lookup failed:", e);
        }
        return null;
    },

    async defineGoogleBotForwardDns(hostname, request, env, ctx) {
        if (!hostname) return false;
        const ip = request.headers.get("cf-connecting-ip");
        if (!ip) return false;

        const type = ip.includes(':') ? 'AAAA' : 'A';
        try {
            const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=${type}`, {
                headers: { 'accept': 'application/dns-json' }
            });
            const json = await response.json();

            if (json.Answer && json.Answer.length > 0) {
                return json.Answer.some(ans => ans.data === ip);
            }
        } catch (e) {
            console.error("Forward DNS lookup failed:", e);
        }
        return false;
    }
};
