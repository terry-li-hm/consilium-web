#!/bin/sh
set -e

echo "Installing consilium..."

# Check for cargo
if command -v cargo >/dev/null 2>&1; then
  echo "Installing via cargo..."
  cargo install consilium
  echo ""
  echo "✓ consilium installed."
  echo ""
  echo "Set your OpenRouter API key:"
  echo "  echo 'export OPENROUTER_API_KEY=sk-or-v1-...' >> ~/.zshenv && source ~/.zshenv"
  echo ""
  echo "Run your first deliberation:"
  echo "  consilium \"Should I take this job offer?\""
else
  echo "Error: cargo not found."
  echo "Install Rust first: https://rustup.rs"
  echo "Then re-run this script."
  exit 1
fi
