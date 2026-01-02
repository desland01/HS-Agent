"""
Agent Session Logic

Manages the autonomous agent loop:
- Fresh client per session to prevent context pollution
- Detects first run (initialization) vs continuing (coding)
- Auto-continues with configurable delay
- Session handoff via Linear META issue
"""

import asyncio
from pathlib import Path
from typing import Tuple

from claude_code_sdk import (
    AssistantMessage,
    TextBlock,
    ToolUseBlock,
    ToolResultBlock,
    ResultMessage,
)

from client import create_client
from linear_config import LINEAR_PROJECT_MARKER
from prompts import get_initializer_prompt, get_coding_prompt


# Delay between auto-continue iterations (seconds)
AUTO_CONTINUE_DELAY_SECONDS = 3


def is_linear_initialized(project_dir: str) -> bool:
    """Check if Linear project has been initialized."""
    marker_path = Path(project_dir) / LINEAR_PROJECT_MARKER
    return marker_path.exists()


def mark_linear_initialized(project_dir: str) -> None:
    """Mark Linear project as initialized."""
    marker_path = Path(project_dir) / LINEAR_PROJECT_MARKER
    marker_path.parent.mkdir(parents=True, exist_ok=True)
    marker_path.write_text('{"initialized": true, "project": "Home Service Agent"}')


async def run_agent_session(
    project_dir: str,
    model: str,
    prompt: str
) -> Tuple[str, str]:
    """
    Run a single agent session with the given prompt.

    Returns:
        Tuple of (status, response_text)
        status: "success", "error", "interrupted"
    """
    client = create_client(project_dir=project_dir, model=model)

    full_response = []

    try:
        async with client:
            # Send the prompt
            await client.query(prompt)

            # Receive and process the response
            async for message in client.receive_response():
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            print(block.text, end="", flush=True)
                            full_response.append(block.text)
                        elif isinstance(block, ToolUseBlock):
                            print(f"\n[Tool: {block.name}]", end="", flush=True)
                        elif isinstance(block, ToolResultBlock):
                            # Show abbreviated result
                            result_str = str(block.content) if block.content else ""
                            result_preview = result_str[:100]
                            if len(result_str) > 100:
                                result_preview += "..."
                            print(f" -> {result_preview}", flush=True)

                elif isinstance(message, ResultMessage):
                    # Final result message
                    if hasattr(message, 'error') and message.error:
                        print(f"\n[Error: {message.error}]", flush=True)
                        return ("error", str(message.error))

        return ("success", "".join(full_response))

    except KeyboardInterrupt:
        return ("interrupted", "User interrupted")
    except Exception as e:
        return ("error", str(e))


async def run_autonomous_agent(
    project_dir: str,
    model: str,
    max_iterations: int = 100,
    init_only: bool = False
) -> None:
    """
    Run the autonomous agent loop.

    On first run:
        Uses initializer prompt to create Linear issues from app_spec.txt

    On subsequent runs:
        Uses coding prompt to pick up and implement highest-priority Todo issue
    """
    iteration = 0
    is_first_run = not is_linear_initialized(project_dir)

    while iteration < max_iterations:
        iteration += 1
        print(f"\n{'='*60}")
        print(f"Session {iteration} of {max_iterations}")
        print(f"{'='*60}\n")

        # Select prompt based on initialization state
        if is_first_run:
            print("Mode: INITIALIZER (creating Linear issues)")
            prompt = get_initializer_prompt(project_dir)
        else:
            print("Mode: CODING (implementing next issue)")
            prompt = get_coding_prompt(project_dir)

        # Run the session
        status, response = await run_agent_session(
            project_dir=project_dir,
            model=model,
            prompt=prompt
        )

        print(f"\n\nSession ended with status: {status}")

        if status == "interrupted":
            print("User interrupted. Exiting...")
            break

        if status == "error":
            print(f"Error occurred: {response}")
            print("Waiting before retry...")
            await asyncio.sleep(10)
            continue

        # After successful initialization, mark as initialized
        if is_first_run:
            mark_linear_initialized(project_dir)
            is_first_run = False
            print("\nLinear project initialized successfully!")

            if init_only:
                print("Init-only mode - exiting after initialization.")
                break

        # Auto-continue with delay
        print(f"\nAuto-continuing in {AUTO_CONTINUE_DELAY_SECONDS} seconds...")
        print("(Press Ctrl+C to stop)")

        try:
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
        except KeyboardInterrupt:
            print("\nStopping auto-continue. Exiting...")
            break

    print(f"\n{'='*60}")
    print("Autonomous agent completed")
    print(f"Total sessions: {iteration}")
    print(f"{'='*60}")
