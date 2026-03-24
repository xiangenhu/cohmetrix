#!/bin/bash
# Claude Code Skills Pack Installer
# Installs reusable team skills (feature, i18n, performance, review, security)
# into any project's .claude/commands/ directory.
#
# Usage:
#   ./install.sh                  # Install to current directory's project
#   ./install.sh /path/to/project # Install to specific project

set -e

TARGET_DIR="${1:-.}"
COMMANDS_DIR="$TARGET_DIR/.claude/commands"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_DIR="$SCRIPT_DIR/skills"

# Colors (if terminal supports them)
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  BOLD='\033[1m'
  NC='\033[0m'
else
  GREEN='' YELLOW='' RED='' BOLD='' NC=''
fi

echo ""
echo -e "${BOLD}Claude Code Skills Pack Installer${NC}"
echo "──────────────────────────────────"
echo ""

# Resolve target to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd)" || {
  echo -e "${RED}Error: Directory '$1' does not exist.${NC}"
  exit 1
}

echo -e "Target project: ${BOLD}$TARGET_DIR${NC}"
echo ""

# Check skills directory exists
if [ ! -d "$SKILLS_DIR" ]; then
  echo -e "${RED}Error: Skills directory not found at $SKILLS_DIR${NC}"
  exit 1
fi

# Create .claude/commands/ if needed
if [ ! -d "$COMMANDS_DIR" ]; then
  echo -e "${YELLOW}Creating $COMMANDS_DIR${NC}"
  mkdir -p "$COMMANDS_DIR"
fi

# Install each skill
INSTALLED=0
SKIPPED=0
UPDATED=0

for skill_file in "$SKILLS_DIR"/*.md; do
  filename="$(basename "$skill_file")"
  dest="$COMMANDS_DIR/$filename"

  if [ -f "$dest" ]; then
    # Check if content differs
    if diff -q "$skill_file" "$dest" > /dev/null 2>&1; then
      echo -e "  ${GREEN}✓${NC} $filename (already up to date)"
      SKIPPED=$((SKIPPED + 1))
    else
      # Backup existing file
      cp "$dest" "$dest.bak"
      cp "$skill_file" "$dest"
      echo -e "  ${YELLOW}↑${NC} $filename (updated, backup saved as $filename.bak)"
      UPDATED=$((UPDATED + 1))
    fi
  else
    cp "$skill_file" "$dest"
    echo -e "  ${GREEN}+${NC} $filename (installed)"
    INSTALLED=$((INSTALLED + 1))
  fi
done

echo ""
echo "──────────────────────────────────"
echo -e "Installed: ${GREEN}$INSTALLED${NC}  Updated: ${YELLOW}$UPDATED${NC}  Unchanged: $SKIPPED"
echo ""
echo -e "Skills are now available as slash commands in Claude Code:"
echo "  /team-feature      Full feature development workflow"
echo "  /team-i18n         Hash-based three-mode i18n implementation"
echo "  /team-performance  Performance analysis and optimization"
echo "  /team-review       Comprehensive code review"
echo "  /team-security     Security audit"
echo ""
echo -e "${GREEN}Done!${NC}"
