# AI Agent Architecture

## Overview

The AI agent in this project is a natural language command parser that converts user text into canvas actions.

## Frontend Flow

```
AICommandPanel.vue → useAICommands.js → aiService.js → OpenAI API
```

- User types command in the AI panel (e.g., "create a red circle")
- The `useAICommands` composable gathers canvas context (viewport, selected shapes, etc.)
- Context + command sent to OpenAI via `aiService`
- OpenAI returns structured JSON with intent + parameters
- Command is mapped to a canonical format and executed on the canvas

## Key Files

### Frontend

- **`ui/src/components/AICommandPanel.vue`** - UI component with input field, history, suggestions
- **`ui/src/composables/useAICommands.js`** - Manages AI state, parses commands, maps intents to actions
- **`ui/src/services/aiService.js`** - Direct OpenAI API integration (gpt-3.5-turbo)
- **`ui/src/types/aiCommands.js`** - Type definitions for command categories

### Backend

- **`functions/ai/parseCommand.js`** - Firebase Cloud Function (alternative backend approach using GPT-4)
- **`functions/ai/templates.js`** - Predefined multi-shape templates (login form, nav bar, etc.)

## Command Flow

```
User Input: "create a 200x300 rectangle"
↓
OpenAI Parsing → { intent: "CREATE_SHAPE", parameters: { type: "rectangle", width: 200, height: 300 }}
↓
Mapping → { category: "creation", action: "create", parameters: { shapeType: "rectangle", size: { width: 200, height: 300 }}}
↓
Canvas Execution → Rectangle created at viewport center
```

## Special Features

### Grayscale Enforcement
Backend validates all colors are grayscale (R=G=B)

### Context-Aware
Passes viewport bounds, selected shapes, zoom level to AI for intelligent positioning

### Templates
Complex multi-shape layouts like "login form" or "dashboard" created with single command

### History
Stores last 50 commands with success/fail tracking

### Keyboard Shortcut
Cmd/Ctrl+J to focus AI panel

## Dual Implementation

The project has **two AI approaches**:

1. **Client-side** (current): Direct OpenAI API calls from browser using `aiService.js`
   - Faster response time
   - No cloud function cold start
   - Uses GPT-3.5-turbo

2. **Cloud Function**: Firebase function at `parseAICommand` (alternative/fallback)
   - Server-side processing
   - Uses GPT-4-turbo
   - More secure API key management

Both parse natural language → structured commands, but the client-side approach is faster.

## Command Categories

- **Creation**: Create shapes (single or multiple)
- **Manipulation**: Move, resize shapes
- **Layout**: Arrange, align, distribute
- **Complex**: Multi-shape templates
- **Selection**: Select shapes by criteria
- **Deletion**: Delete shapes
- **Style**: Change colors, stroke, opacity
- **Utility**: Zoom, center, undo/redo

## Supported Intents

- `CREATE_SHAPE` - Create a single shape
- `CREATE_MULTIPLE_SHAPES` - Create multiple shapes (grids, patterns)
- `CREATE_TEXT` - Create text element
- `MOVE_SHAPE` - Move/position shapes
- `RESIZE_SHAPE` - Resize shapes (absolute or relative)
- `CHANGE_STYLE` - Modify visual properties
- `ARRANGE_SHAPES` - Layout shapes in patterns
- `CHANGE_LAYER` - Modify z-index
- `CREATE_TEMPLATE` - Create predefined components
- `DELETE_SHAPE` - Remove shapes
- `QUERY_INFO` - Answer questions about canvas

## Context Object

The AI receives rich context about the canvas state:

```javascript
{
  viewportCenter: { x: 960, y: 540 },
  viewportWidth: 1920,
  viewportHeight: 1080,
  viewportBounds: { left, right, top, bottom },
  selectedShapeIds: ['shape-123'],
  selectedShape: { type, position, size, color, ... },
  lastCreatedShape: { id, type, ... },
  totalShapes: 42,
  canvasSize: { width: 3000, height: 3000 }
}
```

This context enables intelligent positioning and context-aware operations.

