#!/bin/bash
# Setup script to clone and configure the repository
# This runs before the agent starts

set -e

REPO_URL="${GITHUB_REPO_URL:-https://github.com/your-org/home-service-agent.git}"
REPO_DIR="${WORKING_DIRECTORY:-/app/repo}"
BRANCH="${GIT_BRANCH:-main}"

echo "=== Repository Setup ==="
echo "Repo URL: $REPO_URL"
echo "Directory: $REPO_DIR"
echo "Branch: $BRANCH"

# Configure git
git config --global user.name "Dev Agent"
git config --global user.email "dev-agent@yourdomain.com"

# Configure gh CLI
if [ -n "$GITHUB_TOKEN" ]; then
    echo "$GITHUB_TOKEN" | gh auth login --with-token
    echo "GitHub CLI authenticated"
fi

# Clone or update repo
if [ -d "$REPO_DIR/.git" ]; then
    echo "Repository exists, updating..."
    cd "$REPO_DIR"
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
else
    echo "Cloning repository..."
    git clone "$REPO_URL" "$REPO_DIR"
    cd "$REPO_DIR"
    git checkout "$BRANCH"
fi

# Install dependencies
echo "Installing dependencies..."
npm install

echo "=== Setup Complete ==="
