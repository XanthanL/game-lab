#!/bin/bash
# UI 弹窗截图探针
CHROME="/c/Program Files/Google/Chrome/Application/chrome.exe"
BASE="http://127.0.0.1:8126/index.html"
OUT="E:\\Code\\game-lab\\forcing-cosmos\\.shots"
cd /e/Code/game-lab/forcing-cosmos || exit 1
mkdir -p .shots

shot() {
  local name="$1" q="$2"
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size=640,360 --virtual-time-budget=2600 \
    --screenshot="$OUT\\$name.png" "$BASE?noanim=1&$q" >/dev/null 2>&1
  local err
  err=$("$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=2600 \
    --dump-dom "$BASE?noanim=1&$q" 2>/dev/null | grep -o 'id="errlog" class="[^"]*"[^>]*>[^<]*' | head -1)
  if echo "$err" | grep -q 'class="hidden"'; then echo "OK   $name"; else echo "FAIL $name -> $err"; fi
}

shot charsel "charsel=1"
shot shop    "shop=1"
shot event   "event=1"
shot reward  "reward=1"
shot rest    "rest=1"
shot overwin "over=win"
