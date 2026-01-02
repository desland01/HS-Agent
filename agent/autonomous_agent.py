#!/usr/bin/env python3
"""
Autonomous Agent Entry Point

This script runs an autonomous coding agent that:
1. On first run: Creates 50 Linear issues from app_spec.txt (initializer mode)
2. On subsequent runs: Picks up highest-priority Todo issue and implements it

Based on Linear-Coding-Agent-Harness pattern:
https://github.com/coleam00/Linear-Coding-Agent-Harness
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from agent import run_autonomous_agent
from linear_config import LINEAR_PROJECT_MARKER


def main():
    """Parse arguments and run the autonomous agent."""
    load_dotenv()

    parser = argparse.ArgumentParser(
        description="Run autonomous coding agent with Linear integration"
    )
    parser.add_argument(
        "--project-dir",
        type=str,
        default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        help="Project directory to work in (default: parent of agent/)"
    )
    parser.add_argument(
        "--model",
        type=str,
        default="claude-sonnet-4-20250514",
        help="Claude model to use"
    )
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=100,
        help="Maximum iterations before stopping (default: 100)"
    )
    parser.add_argument(
        "--init-only",
        action="store_true",
        help="Only run initialization (create Linear issues), then exit"
    )
    parser.add_argument(
        "--skip-init",
        action="store_true",
        help="Skip initialization, go straight to coding mode (for cloud deployment)"
    )

    args = parser.parse_args()

    # Validate environment
    required_vars = ["LINEAR_API_KEY"]
    missing = [v for v in required_vars if not os.environ.get(v)]
    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("\nSet these in your environment or .env file:")
        for var in missing:
            print(f"  export {var}=your-value")
        sys.exit(1)

    # Resolve project directory
    project_dir = Path(args.project_dir).resolve()
    if not project_dir.exists():
        print(f"Error: Project directory does not exist: {project_dir}")
        sys.exit(1)

    print(f"\n{'='*60}")
    print("Home Service Agent - Autonomous Development Agent")
    print(f"{'='*60}")
    print(f"Project: {project_dir}")
    print(f"Model: {args.model}")
    print(f"Max iterations: {args.max_iterations}")

    # Check if this is first run (unless --skip-init is set)
    marker_file = project_dir / LINEAR_PROJECT_MARKER
    is_first_run = not marker_file.exists() and not args.skip_init

    if args.skip_init:
        print("\nSkip-init mode - going straight to coding (for cloud deployment)")
    elif is_first_run:
        print("\nFirst run detected - will create Linear issues from app_spec.txt")
    else:
        print("\nContinuing development - will pick up next Todo issue")

    print(f"{'='*60}\n")

    # Run the agent
    try:
        asyncio.run(
            run_autonomous_agent(
                project_dir=str(project_dir),
                model=args.model,
                max_iterations=args.max_iterations,
                init_only=args.init_only,
                skip_init=args.skip_init
            )
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted by user. Exiting...")
        sys.exit(0)
    except Exception as e:
        print(f"\nFatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
