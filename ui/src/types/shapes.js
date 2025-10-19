// Shape type definitions and utilities
// Types: 'rectangle' | 'circle' | 'line' | 'text'

// Generate a unique ID for shapes
export const generateId = (type = 'rectangle') => {
  const prefix = type.substring(0, 4) // rect, circ, line, text
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// Generate random color from predefined palette
export const generateRandomColor = () => {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Light Yellow
    '#BB8FCE', // Light Purple
    '#85C1E9', // Light Blue
    '#F8C471', // Orange
    '#82E0AA', // Light Green
    '#F1948A', // Pink
    '#AED6F1', // Sky Blue
    '#D2B4DE'  // Lavender
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

// Default shape properties
export const DEFAULT_SHAPE_PROPERTIES = {
  rectangle: {
    width: 100,
    height: 100,
    fill: '#000000' // Black
  },
  circle: {
    radius: 50,
    fill: '#000000' // Black
    // stroke and strokeWidth are optional, omit from defaults
  },
  line: {
    stroke: '#000000', // Black
    strokeWidth: 2
  },
  text: {
    text: 'Text',
    fontSize: 16,
    fontFamily: 'Arial',
    fill: '#000000', // Black
    fontStyle: 'normal',
    align: 'left'
    // width is optional, omit from defaults
  }
}

// Legacy export for backward compatibility
export const DEFAULT_RECT_SIZE = DEFAULT_SHAPE_PROPERTIES.rectangle

// Canvas constraints
export const CANVAS_BOUNDS = {
  width: 3000,
  height: 3000
}

// Constrain position within canvas bounds
export const constrainToBounds = (
  x, 
  y, 
  width = DEFAULT_RECT_SIZE.width, 
  height = DEFAULT_RECT_SIZE.height
) => {
  return {
    x: Math.max(0, Math.min(x, CANVAS_BOUNDS.width - width)),
    y: Math.max(0, Math.min(y, CANVAS_BOUNDS.height - height))
  }
}

// Z-index utility functions
export const getMaxZIndex = (shapes) => {
  if (shapes.size === 0) return 0
  return Math.max(...Array.from(shapes.values()).map(shape => shape.zIndex))
}

export const getMinZIndex = (shapes) => {
  if (shapes.size === 0) return 0
  return Math.min(...Array.from(shapes.values()).map(shape => shape.zIndex))
}

// Check if z-index normalization is needed (gap > 1000)
export const needsZIndexNormalization = (shapes) => {
  if (shapes.size === 0) return false
  const max = getMaxZIndex(shapes)
  const min = getMinZIndex(shapes)
  return (max - min) > 1000
}

