"""
Claude Code SDK Client Configuration

Configures:
- MCP servers (Linear via HTTP transport)
- Security hooks (bash command validation)
- Allowed tools list
"""

import os
from typing import Any, Dict, Optional

from claude_code_sdk import ClaudeCodeClient, Options, MCPServer, Hook

from security import is_command_allowed, get_allowed_commands_list


def create_mcp_servers() -> Dict[str, MCPServer]:
    """
    Create MCP server configurations.

    Linear MCP is connected via HTTP transport to linear.app's official server.
    """
    linear_api_key = os.environ.get("LINEAR_API_KEY", "")

    servers = {}

    # Linear MCP via HTTP transport (official Linear MCP server)
    if linear_api_key:
        servers["linear"] = MCPServer(
            transport="http",
            url="https://mcp.linear.app/mcp",
            headers={
                "Authorization": f"Bearer {linear_api_key}",
                "Content-Type": "application/json"
            }
        )

    return servers


def create_security_hooks() -> list:
    """
    Create security hooks to validate tool usage.

    PreToolUse hook for Bash commands:
    - Validates commands against allowlist
    - Blocks dangerous operations
    """

    def validate_bash_command(tool_name: str, tool_input: Dict[str, Any]) -> Optional[str]:
        """
        Validate bash commands before execution.

        Returns None to allow, or error message to block.
        """
        if tool_name != "Bash":
            return None  # Allow non-bash tools

        command = tool_input.get("command", "")
        if not command:
            return "Empty command not allowed"

        is_allowed, reason = is_command_allowed(command)
        if not is_allowed:
            return f"Command blocked: {reason}. Allowed commands: {', '.join(get_allowed_commands_list())}"

        return None  # Allow the command

    return [
        Hook(
            event="PreToolUse",
            handler=validate_bash_command
        )
    ]


def create_client(
    project_dir: str,
    model: str = "claude-sonnet-4-20250514"
) -> ClaudeCodeClient:
    """
    Create a configured Claude Code client.

    Each session should create a fresh client to prevent context pollution.
    """
    mcp_servers = create_mcp_servers()
    hooks = create_security_hooks()

    # Define allowed tools
    allowed_tools = [
        # File operations
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "LS",

        # Shell (with security validation)
        "Bash",

        # Git operations
        "GitDiff",
        "GitLog",
        "GitStatus",

        # Task management
        "TodoWrite",
        "Task",

        # Linear MCP tools
        "mcp__linear__list_issues",
        "mcp__linear__get_issue",
        "mcp__linear__create_issue",
        "mcp__linear__update_issue",
        "mcp__linear__list_teams",
        "mcp__linear__list_projects",
        "mcp__linear__create_project",
        "mcp__linear__create_comment",
        "mcp__linear__list_issue_statuses",
    ]

    options = Options(
        model=model,
        cwd=project_dir,
        allowed_tools=allowed_tools,
        mcp_servers=mcp_servers,
        hooks=hooks,
        # Enable streaming for real-time output
        include_partial_messages=True,
    )

    return ClaudeCodeClient(options=options)
