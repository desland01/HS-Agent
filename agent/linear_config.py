"""
Linear Configuration Constants

Defines constants for Linear workspace integration.
"""

# Marker file to detect if Linear project has been initialized
LINEAR_PROJECT_MARKER = ".linear_project.json"

# Linear workspace settings
LINEAR_TEAM_NAME = "Grove Street Painting"
LINEAR_PROJECT_NAME = "Home Service Agent"

# Issue priorities (Linear uses 0-4 scale)
# 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low
PRIORITY_URGENT = 1
PRIORITY_HIGH = 2
PRIORITY_NORMAL = 3
PRIORITY_LOW = 4

# Issue states
STATE_TODO = "Todo"
STATE_IN_PROGRESS = "In Progress"
STATE_DONE = "Done"

# Labels
LABEL_FOUNDATION = "foundation"
LABEL_AGENT = "agent"
LABEL_INTEGRATION = "integration"
LABEL_API = "api"
LABEL_SECURITY = "security"
LABEL_TESTING = "testing"
LABEL_DASHBOARD = "dashboard"

# META issue title (for session handoff)
META_ISSUE_TITLE = "[META] Home Service Agent Progress Tracker"
