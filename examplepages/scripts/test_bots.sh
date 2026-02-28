#!/bin/bash

# Configuration
URL=${1:-"https://examplepages.vitosgeen.workers.dev"}

echo "Testing URL: $URL"
echo "-----------------------------------"

# 1. Just Human (Regular Chrome User-Agent)
echo "Case 1: Just Human (Regular Browser)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36" > scripts/reports/case1.html
echo "-----------------------------------"

# 2. Some Bot (Generic Bot User-Agent)
echo "Case 2: Some Bot (Detects 'bot' in UA)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; MyGenericBot/1.0; +http://example.com/bot)" > scripts/reports/case2.html
echo "-----------------------------------"

# 3. Fake Googlebot (Googlebot UA but no verification)
echo "Case 3: Fake Googlebot (Pretending to be Googlebot)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" > scripts/reports/case3.html
echo "-----------------------------------"

# 4. Bot via Header
echo "Case 4: Bot detected via Header (x-is-bot: true)"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" \
  -H "x-is-bot: true" > scripts/reports/case4.html
echo "-----------------------------------"


echo "Case 5: Private Bot with right signature"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; PrivateBot/1.0) private-bot" \
  -H "x-private-bot: private-bot" > scripts/reports/case5.html
# compare size of case5.html and case1.html and print if they are the different sizes it's ok
if [ "$(stat -c%s scripts/reports/case5.html)" -ne "$(stat -c%s scripts/reports/case1.html)" ]; then
  echo "Case 5: Private Bot with right signature - OK"
else
  echo "Case 5: Private Bot with right signature - FAIL"
fi
echo "-----------------------------------"

echo "Case 6: Private Bot with wrong signature"
curl -sL --max-time 5 -D - "$URL" \
  -H "User-Agent: Mozilla/5.0 (compatible; PrivateBot/1.0) private-bot" \
  -H "x-private-bot: wrong-bot" > scripts/reports/case6.html
# compare size of case6.html and case1.html and print if they are the different sizes it's fail 
if [ "$(stat -c%s scripts/reports/case6.html)" -ne "$(stat -c%s scripts/reports/case1.html)" ]; then
    echo "Case 6: Private Bot with wrong signature - FAIL"
else
    echo "Case 6: Private Bot with wrong signature - OK"
fi
echo "-----------------------------------"


echo "Done."
