"""
Prompt Loading Utilities

Loads and prepares prompts for the autonomous agent.
"""

import os
from pathlib import Path
from typing import Optional


def get_prompts_dir() -> Path:
    """Get the prompts directory path."""
    return Path(__file__).parent / "prompts"


def load_prompt_file(filename: str) -> str:
    """Load a prompt file from the prompts directory."""
    prompt_path = get_prompts_dir() / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text()


def load_app_spec() -> str:
    """Load the application specification."""
    return load_prompt_file("app_spec.txt")


def get_initializer_prompt(project_dir: str) -> str:
    """
    Get the initializer prompt for creating Linear issues.

    The initializer prompt instructs the agent to:
    1. Read the app_spec.txt
    2. Create a Linear project
    3. Create 50 detailed issues
    4. Create a META issue for tracking
    5. Set up init.sh and git
    """
    base_prompt = load_prompt_file("initializer_prompt.md")
    app_spec = load_app_spec()

    # Inject app spec into the prompt
    prompt = base_prompt.replace("{{APP_SPEC}}", app_spec)
    prompt = prompt.replace("{{PROJECT_DIR}}", project_dir)

    return prompt


def get_coding_prompt(project_dir: str) -> str:
    """
    Get the coding prompt for implementing issues.

    The coding prompt instructs the agent to:
    1. Query Linear for highest-priority Todo issue
    2. Verify previously completed features still work
    3. Claim the issue (mark In Progress)
    4. Implement the feature
    5. Test appropriately
    6. Add implementation comment
    7. Mark complete (Done)
    8. Update META issue with session summary
    """
    base_prompt = load_prompt_file("coding_prompt.md")

    # Inject project directory
    prompt = base_prompt.replace("{{PROJECT_DIR}}", project_dir)

    return prompt
