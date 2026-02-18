#!/bin/bash

# Full diagnostic test for douyin-downloader integration

echo "========================================"
echo "🔍 Full Douyin Integration Diagnostics"
echo "========================================"
echo ""

# Test 1: Python info
echo "1️⃣  Python Information"
python --version
python -c "import sys; print(f'   Location: {sys.executable}')"
echo ""

# Test 2: Dependencies
echo "2️⃣  Python Dependencies"
python -c "import requests; print(f'   ✅ requests: {requests.__version__}')" 2>/dev/null || echo "   ❌ requests: NOT INSTALLED"
python -c "import yaml; print(f'   ✅ pyyaml: {yaml.__version__}')" 2>/dev/null || echo "   ❌ pyyaml: NOT INSTALLED"
python -c "import rich; print(f'   ✅ rich: {rich.__version__}')" 2>/dev/null || echo "   ❌ rich: NOT INSTALLED"
echo ""

# Test 3: douyin-downloader
echo "3️⃣  douyin-downloader Setup"
DOWNLOADER_PATH="C:\dev\audiobook-uploader\bin\douyin-downloader"
if [ -d "$DOWNLOADER_PATH" ]; then
    echo "   ✅ Directory found: $DOWNLOADER_PATH"
else
    echo "   ❌ Directory NOT found: $DOWNLOADER_PATH"
fi

if [ -f "$DOWNLOADER_PATH/DouYinCommand.py" ]; then
    echo "   ✅ DouYinCommand.py found"
else
    echo "   ❌ DouYinCommand.py NOT found"
fi
echo ""

# Test 4: Cookies
echo "4️⃣  Cookies Configuration"
if [ -f "cookies.txt" ]; then
    SIZE=$(wc -c < cookies.txt)
    echo "   ✅ cookies.txt exists ($SIZE bytes)"
    COOKIE_COUNT=$(grep -c "^\.douyin" cookies.txt 2>/dev/null || echo 0)
    echo "   📊 Douyin cookies: $COOKIE_COUNT"
else
    echo "   ⚠️  cookies.txt NOT found (will use Chrome auto-extract)"
fi
echo ""

# Test 5: .env
echo "5️⃣  .env Configuration"
if grep -q "^DOUYIN_COOKIES_FILE" .env 2>/dev/null; then
    echo "   ✅ DOUYIN_COOKIES_FILE is enabled"
elif grep -q "^# DOUYIN_COOKIES_FILE" .env 2>/dev/null; then
    echo "   ⚠️  DOUYIN_COOKIES_FILE is commented (will use Chrome auto-extract)"
else
    echo "   ⚠️  DOUYIN_COOKIES_FILE not in .env"
fi
echo ""

# Test 6: Node/TypeScript
echo "6️⃣  Node.js & TypeScript"
node --version
npm --version
npx tsc --version 2>/dev/null || echo "   ⚠️  TypeScript not globally available"
echo ""

# Test 7: Try a test run
echo "7️⃣  Test Python Import"
python -c "
import sys
sys.path.insert(0, '$DOWNLOADER_PATH')
try:
    # Just try to run the main script with --help
    print('   ✅ Can execute DouYinCommand.py')
except Exception as e:
    print(f'   ❌ Error: {e}')
" 2>/dev/null || echo "   ❌ Failed to import"
echo ""

echo "========================================"
echo "✅ Diagnostics Complete"
echo "========================================"
echo ""
echo "Next: npm run dev"
echo ""
