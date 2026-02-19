#!/bin/bash
# Build script for macOS executable
# Usage: ./scripts/build-mac.sh
# Requirements: Node.js 18+, npm, Xcode Command Line Tools (for codesigning)

set -e

echo "🔨 Building Audiobook Uploader for macOS..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Step 1: Checking prerequisites${NC}"
node -v
npm -v
echo ""

echo -e "${BLUE}Step 2: Installing dependencies${NC}"
npm install
echo ""

echo -e "${BLUE}Step 3: Type checking${NC}"
npm run type-check
echo ""

echo -e "${BLUE}Step 4: Building Electron main process${NC}"
npm run build:electron
echo ""

echo -e "${BLUE}Step 5: Building React UI${NC}"
npm run build:renderer
echo ""

echo -e "${BLUE}Step 6: Building macOS executables with electron-builder${NC}"
npm run build:mac
echo ""

if [ -d "dist/release" ]; then
    echo -e "${GREEN}✅ Build completed successfully!${NC}"
    echo ""
    echo "📦 Output files:"
    ls -lh dist/release/ | grep -E '\.(dmg|zip)$' || true
    echo ""
    echo "📝 To verify the build:"
    echo "   - Open dist/release/Audiobook-Uploader-0.1.0.dmg"
    echo "   - Drag & drop to Applications folder"
    echo "   - Launch the app from Applications"
else
    echo -e "${YELLOW}⚠️  Build directory not found${NC}"
    exit 1
fi
