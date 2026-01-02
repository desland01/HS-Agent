"""
Security Module - Bash Command Validation

Implements allowlist-based security for shell commands.
Only explicitly allowed commands can be executed.
"""

import shlex
from typing import Tuple, Set

# Commands that are safe for autonomous agent use
ALLOWED_COMMANDS: Set[str] = {
    # File operations (read-only or safe)
    "ls",
    "cat",
    "head",
    "tail",
    "wc",
    "grep",
    "find",
    "cp",
    "mkdir",
    "chmod",
    "pwd",
    "tree",
    "diff",

    # Node.js / npm
    "npm",
    "node",
    "npx",
    "tsx",

    # Git (core operations)
    "git",

    # Process management
    "ps",
    "lsof",
    "pkill",
    "sleep",

    # Network (limited)
    "curl",

    # TypeScript
    "tsc",

    # Testing
    "jest",
    "vitest",

    # Build tools
    "esbuild",
    "vite",
}

# Patterns that are always blocked regardless of command
BLOCKED_PATTERNS = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf /*",
    "> /dev/",
    "| rm",
    "; rm",
    "&& rm -rf",
    "sudo",
    "chmod 777",
    "curl | bash",
    "curl | sh",
    "wget | bash",
    "wget | sh",
    "eval",
    "$(curl",
    "$(wget",
    "mkfs",
    "dd if=",
    ":(){",  # Fork bomb
    ">/dev/sda",
    ">/dev/null 2>&1 &",  # Background execution hiding output
]


def get_command_name(command: str) -> str:
    """
    Extract the base command name from a shell command.

    Handles:
    - Simple commands: "ls -la" -> "ls"
    - Environment variables: "NODE_ENV=test npm run" -> "npm"
    - Paths: "/usr/bin/node script.js" -> "node"
    """
    # Remove leading environment variable assignments
    parts = command.strip().split()
    for i, part in enumerate(parts):
        if "=" not in part or part.startswith("-"):
            # Found the actual command
            cmd = parts[i] if i < len(parts) else ""
            # Remove path prefix
            return cmd.split("/")[-1]
    return ""


def contains_blocked_pattern(command: str) -> Tuple[bool, str]:
    """Check if command contains any blocked patterns."""
    command_lower = command.lower()
    for pattern in BLOCKED_PATTERNS:
        if pattern.lower() in command_lower:
            return True, f"Contains blocked pattern: {pattern}"
    return False, ""


def is_command_allowed(command: str) -> Tuple[bool, str]:
    """
    Check if a bash command is allowed.

    Returns:
        Tuple of (is_allowed: bool, reason: str)
    """
    if not command or not command.strip():
        return False, "Empty command"

    # Check for blocked patterns first
    is_blocked, reason = contains_blocked_pattern(command)
    if is_blocked:
        return False, reason

    # Extract the base command
    base_cmd = get_command_name(command)
    if not base_cmd:
        return False, "Could not parse command"

    # Check if command is in allowlist
    if base_cmd in ALLOWED_COMMANDS:
        return True, ""

    return False, f"Command '{base_cmd}' is not in allowlist"


def get_allowed_commands_list() -> list:
    """Return sorted list of allowed commands."""
    return sorted(ALLOWED_COMMANDS)
