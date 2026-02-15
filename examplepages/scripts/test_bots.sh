#!/bin/bash

# Configuration
URL=${1:-"https://examplepages.vitosgeen.workers.dev"}

echo "Testing URL: $URL"
echo "-----------------------------------"

# 1. Just Human (Regular Chrome User-Agent)
echo "Case 1: Just Human (Regular Browser)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" \
  | grep -E "HTTP/|X-Served-From|<h1>"
echo "-----------------------------------"

# 2. Some Bot (Generic Bot User-Agent)
echo "Case 2: Some Bot (Detects 'bot' in UA)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; MyGenericBot/1.0; +http://example.com/bot)" \
  | grep -E "HTTP/|X-Served-From|<h1>"
echo "-----------------------------------"

# 3. Fake Googlebot (Googlebot UA but no verification)
echo "Case 3: Fake Googlebot (Pretending to be Googlebot)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  | grep -E "HTTP/|X-Served-From|<h1>"
echo "-----------------------------------"

# 4. Bot via Header
echo "Case 4: Bot detected via Header (x-is-bot: true)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  -H "x-is-bot: true" \
  | grep -E "HTTP/|X-Served-From|<h1>"
echo "-----------------------------------"

echo "Done."
