# Python Autonomous Agent Dockerfile
# Runs the coding agent loop that processes Linear issues

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies needed by the agent
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent code
COPY . .

# Environment settings
ENV PYTHONUNBUFFERED=1

# Default command - skip init since Linear issues already exist
# Override max-iterations as needed
CMD ["python", "autonomous_agent.py", "--skip-init", "--max-iterations", "1000"]
