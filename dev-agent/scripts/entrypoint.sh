#!/bin/bash
# Entrypoint script for the Dev Agent container
# Sets up the repository and starts the agent

set -e

echo "=== Home Service Dev Agent Entrypoint ==="
echo "Starting at: $(date)"

# Run setup script if repo URL is provided
if [ -n "$GITHUB_REPO_URL" ]; then
    echo "Setting up repository..."
    /app/scripts/setup-repo.sh
else
    echo "GITHUB_REPO_URL not set, skipping repo clone"
    echo "Assuming WORKING_DIRECTORY already contains the repository"
fi

echo ""
echo "=== Starting Dev Agent ==="
echo ""

# Start the agent
exec node /app/dist/index.js
