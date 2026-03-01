# ExamplePages Wrangler

A Cloudflare Workers/Pages application designed for advanced bot detection, intelligent routing, and serving specialized static assets to verified search engine crawlers versus regular human users.

## Project Overview

This project intercepts incoming HTTP requests, analyzes their User-Agent and connection attributes, and determines if the client is a real human, a fake bot (e.g., spoofed crawler), or a verified search engine crawler (such as Googlebot). Depending on the evaluation, it dynamically serves assets from different target directories, enabling optimized SEO delivery (Dynamic Rendering or conditional targeting).

## Features

- **Advanced Bot Detection**: Capable of distinguishing between real users, basic bots, spoofed bots, and verified Googlebots.
- **DNS Verification**: Verifies Googlebot authenticity through a robust set of checks, including:
  - Reverse DNS (PTR) lookups using Cloudflare's DNS over HTTPS.
  - Forward DNS (A/AAAA) lookups to validate the IP address.
- **Intelligent Routing & Redirection**:
  - Regular human traffic is sourced from the `/static` asset directory.
  - Verified bots are routed to the `/__bots` asset directory.
  - Ensures clean root URLs by automatically redirecting requests for direct `/static/*`, `/__bots/*`, or `/index.html`.
- **Extension-less Fallbacks**: Automatically attempts to serve `.html` file equivalents for extensionless routes.

## Prerequisites

- Node.js (v16+ recommended)
- `npm` package manager
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed via `devDependencies`

## Setup and Commands

This project includes a convenient `Makefile` to simplify local development, testing, and deployment processes.

### 1. Install Dependencies
```bash
npm install
```

### 2. Local Development 
Start the local Wrangler development server in the background:
```bash
make start
```

Check the status of the local server:
```bash
make status
```

Stop the local server safely:
```bash
make stop
```

Force-stop any lingering wrangler processes (e.g., if port 8787 is busy):
```bash
make force-stop
```

### 3. Testing Bot Logic
There's an included shell script to verify detection logic using simulated requests:
```bash
make test-bots
```
*Note: Make sure your local server is running with `make start` prior to running tests.*

### 4. Viewing Logs
To stream the background server output logs:
```bash
make logs
```

### 5. Deployment
Publish your worker scripts to your Cloudflare account:
```bash
make deploy
```
*(This will implicitly run `npm run deploy`, executing `wrangler deploy`)*

## Project Structure

- `src/index.js` - Main entry point containing request handling, bot detection via regex, and reverse/forward DNS verification.
- `public/` - Static assets directory. Likely structured internally with `/static` (for normal users) and `/__bots` (for crawlers).
- `scripts/test_bots.sh` - Automated bash scripts containing `curl` commands simulating various User-Agents to test local routing behaviors.
- `Makefile` - Project automation commands.
- `wrangler.jsonc` - Cloudflare Wrangler configuration defining environments, entry points, compatibility dates, and asset bindings.


# rules for behavior

1. Regular user traffic is served from the `/static` asset directory.
2. Googlebot traffic is served from the `/__bots` asset directory.
3. If googlebot is detected, but it is not verified, then it is served from the `/static` asset directory.
4. Any user or bot traffic that is not detected as a bot is served from the `/static` asset directory.
5. Any inspection bot traffic is served from the `/static` asset directory.
6. Private bot traffic is served from the `/_bots` asset directory.