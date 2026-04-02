#!/bin/bash
# Launch oh-my-kira in a new Ghostty terminal window
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

osascript <<EOF
tell application "System Events"
  tell process "Ghostty"
    -- Cmd+D for vertical split (side by side)
    keystroke "d" using command down
  end tell
end tell
delay 0.5
tell application "System Events"
  tell process "Ghostty"
    keystroke "cd \"${PROJECT_DIR}\" && npm start"
    key code 36
  end tell
end tell
EOF
