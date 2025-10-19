# Guest Log Feature

A draggable modal component that allows users to leave messages in a scrollable guest book, similar to a hotel guest log.

## Features

### ✅ Draggable Modal
- Click and drag the title bar to move the window anywhere on screen
- Styled with Windows 95/98 Plaza theme
- Appears on the Dashboard view

### ✅ Rate Limiting
- **2 entries per minute** per user
- Visual countdown timer shows when next entry is available
- Displays "X/2 used" status
- Client-side enforcement with timestamp tracking

### ✅ Message Thread Display
- One-way message thread (read-only after posting)
- Shows username and timestamp for each entry
- Timestamps use relative formatting:
  - "Just now" (< 1 minute)
  - "Xm ago" (< 1 hour)
  - "Xh ago" (< 24 hours)
  - "Xd ago" (< 7 days)
  - Full date (older)
- Scrollable list (last 100 entries)
- Auto-scrolls to bottom on new messages
- Highlights user's own messages

### ✅ Message Input
- Textarea with 280 character limit
- Character counter display
- Submit button (keyboard shortcut: Ctrl/Cmd + Enter)
- Disabled during cooldown period
- Validation ensures messages aren't empty

### ✅ Real-time Updates
- Uses Firestore onSnapshot for live updates
- New entries appear immediately for all users
- Sorted chronologically (oldest first)

## Implementation Details

### Component Location
- **File:** `ui/src/components/GuestLog.vue`
- **Integration:** `ui/src/views/DashboardView.vue`

### Firestore Collection
- **Collection:** `guestLog`
- **Document Fields:**
  ```javascript
  {
    message: string,        // 1-280 characters
    userId: string,         // Creator's user ID
    userName: string,       // Creator's display name
    createdAt: timestamp,   // Server timestamp
    timestamp: number       // Client timestamp (for sorting)
  }
  ```

### Security Rules
- All authenticated users can **read** entries
- Users can only **create** entries with their own `userId`
- Messages must be 1-280 characters
- **No updates or deletes** allowed (permanent log)

### Rate Limiting Logic
1. Tracks last entry timestamps in client-side array
2. Filters out entries older than 60 seconds
3. Counts remaining entries (max 2)
4. Calculates cooldown based on oldest entry
5. Updates countdown timer every second
6. Disables input during cooldown

## Usage

### Opening the Guest Log
1. Go to Dashboard view
2. Click "📖 Guest Log" button in header
3. Modal opens in center of screen

### Posting an Entry
1. Type message (max 280 characters)
2. Click "Post Entry" or press Ctrl/Cmd + Enter
3. Message appears in thread immediately
4. Cooldown timer starts (if 2nd entry in minute)

### Dragging the Modal
1. Click and hold the title bar
2. Drag to desired position
3. Release to drop

### Closing the Modal
1. Click X button in title bar
2. Click outside modal (on overlay)

## Styling
- Windows 95/98 aesthetic (Plaza theme)
- Grayscale color scheme
- Inset borders for text areas
- Outset borders for buttons
- Win98-style scrollbars

## Future Enhancements (Optional)
- [ ] Admin ability to moderate/delete entries
- [ ] Search/filter functionality
- [ ] Export guest log to file
- [ ] Emoji reactions to entries
- [ ] Pagination for very large logs (current: 100 entries)
- [ ] User avatars next to messages

