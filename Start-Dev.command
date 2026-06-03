#!/bin/bash
# Run once: chmod +x Start-Dev.command
cd "$(dirname "$0")" || exit 1
cursor . || open -a Cursor .
pnpm run dev
