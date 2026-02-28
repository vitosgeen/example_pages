export default {

    IS_FAKE_BOT: 1,
    IS_FAKE_HUMAN: 2,
    IS_REAL_BOT: 0,
    IS_REAL_BOT_WITH_FAKE_USER_AGENT: 4,
    IS_REAL_HUMAN: 3,
    IS_GOOGLE_BOT: 5,

    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const headers = request.headers;
        const userAgent = (headers.get("user-agent") || "").toLowerCase();

        // 1. Bot Detection
        const botEvaluation = await this.defineExternalBots(request, env, ctx);

        // if fake bot response with error  
        if (botEvaluation === this.IS_FAKE_BOT) {
            return new Response("Fake bot detected", { status: 403 });
        }
        // if real bot with fake user agent response with error
        if (botEvaluation === this.IS_REAL_BOT_WITH_FAKE_USER_AGENT) {
            return new Response("Real bot with fake user agent detected", { status: 403 });
        }

        if (botEvaluation === this.IS_GOOGLE_BOT) {
            console.log("Google bot detected");
        }
        const isBot = botEvaluation === this.IS_GOOGLE_BOT;

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

        const serveAsset = async (path, botEvaluation) => {
            const assetUrl = new URL(request.url);
            assetUrl.pathname = `${targetDir}${path}`.replace(/\/+/g, "/");

            let response = await assetsModule.fetch(new Request(assetUrl, request));

            // Add header
            const newHeaders = new Headers(response.headers);
            if (botEvaluation === this.IS_GOOGLE_BOT) {
                console.log("Google bot detected newHeaders");
                newHeaders.set("X-Robots-Tag", "noarchive");
            }


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
                        console.log("botEvaluation redirectHeaders", botEvaluation);
                        if (botEvaluation === this.IS_GOOGLE_BOT) {
                            console.log("Google bot detected redirectHeaders");
                            redirectHeaders.append("X-Robots-Tag", "noarchive");
                        }
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

        let response = await serveAsset(path, botEvaluation);

        // Extension-less fallback
        if (response.status === 404 && !path.includes(".") && !path.endsWith("/")) {
            console.log(`[FALLBACK] Trying ${path}.html`);
            const fallbackRes = await serveAsset(`${path}.html`, botEvaluation);
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
        console.log("User agent:", userAgent);
        const botPatterns = [/bot/i, /spider/i, /crawler/i, /lighthouse/i, /headless/i, /slurp/i];
        const isBot = botPatterns.some(p => p.test(userAgent)) ||
            ["x-bot-agent", "x-is-bot", "x-crawler-test"].some(h => request.headers.has(h));
        // if bot is google-inspectiontool
        if (userAgent.includes("google-inspectiontool")) {
            return this.IS_REAL_BOT;
        }
        // if is special private bot with signature
        if (userAgent.includes("private-bot") && request.headers.get("x-private-bot") === "private-bot") {
            return this.IS_GOOGLE_BOT;
        }
        const isGoogleBotEasy = userAgent.includes("googlebot");
        if (isGoogleBotEasy) {
            let isRealBot = await this.defineGoogleBot(request, env, ctx);
            if (isRealBot) {
                return this.IS_GOOGLE_BOT;
            }
            return this.IS_FAKE_BOT;
        }

        if (isBot) {
            return this.IS_REAL_BOT;
        }
        return this.IS_REAL_HUMAN;
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
                if (hostname.endsWith(".googlebot.com")) {
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
    },

    /**
     * check bot dns with reverse and resolve4
     */
    async checkBotDns(request, env, ctx) {
        const clientIP = request.headers.get("cf-connecting-ip");
        const TRUSTED_DOMAINS = ['.googlebot.com'];
        try {
            // 1. Make reverse dns request
            const hostnames = await reverse(clientIP);
            if (hostnames.length === 0) {
                return this.IS_FAKE_BOT;
            }
            // 2. Check if hostname belongs to trusted domains
            const isTrustedDomain = hostnames.some(h => TRUSTED_DOMAINS.some(d => h.endsWith(d)));
            if (!isTrustedDomain) {
                return this.IS_FAKE_BOT;
            }
            // 3. Make forward dns request
            const resolvedIPs = await resolve(hostnames[0]);
            // 4. Check if IP matches
            if (resolvedIPs.includes(clientIP)) {
                return this.IS_REAL_BOT;
            }
            return this.IS_FAKE_BOT;
        } catch (error) {
            console.error("Reverse DNS lookup failed:", error);
        }
        return this.IS_FAKE_BOT;
    }

};
