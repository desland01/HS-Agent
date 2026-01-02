"""
Claude Code SDK Client Configuration

Configures:
- MCP servers (Linear via HTTP transport)
- Security hooks (bash command validation)
- Allowed tools list
"""

import os
from typing import Any, Dict, Optional

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient, HookMatcher

from security import is_command_allowed, get_allowed_commands_list


async def validate_bash_hook(input_data: Dict[str, Any], tool_use_id: str, context: Any) -> Dict[str, Any]:
    """
    PreToolUse hook to validate bash commands.

    Returns:
        Empty dict to allow, or permission denial dict to block.
    """
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if tool_name != "Bash":
        return {}  # Allow non-bash tools

    command = tool_input.get("command", "")
    if not command:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Empty command not allowed",
            }
        }

    is_allowed, reason = is_command_allowed(command)
    if not is_allowed:
        allowed_cmds = ", ".join(get_allowed_commands_list())
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": f"Command blocked: {reason}. Allowed: {allowed_cmds}",
            }
        }

    return {}  # Allow the command


def create_options(
    project_dir: str,
    model: str = "claude-sonnet-4-20250514"
) -> ClaudeCodeOptions:
    """
    Create Claude Code options with MCP servers and hooks.
    """
    linear_api_key = os.environ.get("LINEAR_API_KEY", "")

    # MCP servers configuration
    mcp_servers = {}

    if linear_api_key:
        # Linear MCP via HTTP transport
        mcp_servers["linear"] = {
            "type": "http",
            "url": "https://mcp.linear.app/mcp",
            "headers": {
                "Authorization": f"Bearer {linear_api_key}",
                "Content-Type": "application/json"
            }
        }

    # Define allowed tools
    allowed_tools = [
        # File operations
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "LS",

        # Shell (with security validation via hook)
        "Bash",

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
        "mcp__linear__list_issue_labels",
        "mcp__linear__create_issue_label",
    ]

    # Security hooks
    hooks = {
        "PreToolUse": [
            HookMatcher(matcher="Bash", hooks=[validate_bash_hook]),
        ],
    }

    return ClaudeCodeOptions(
        model=model,
        cwd=project_dir,
        allowed_tools=allowed_tools,
        mcp_servers=mcp_servers,
        hooks=hooks,
    )


def create_client(
    project_dir: str,
    model: str = "claude-sonnet-4-20250514"
) -> ClaudeSDKClient:
    """
    Create a configured Claude SDK client.

    Each session should create a fresh client to prevent context pollution.
    """
    options = create_options(project_dir=project_dir, model=model)
    return ClaudeSDKClient(options=options)
