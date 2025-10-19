/**
 * Color Validation Utility
 * 
 * Ensures only grayscale colors (black, white, shades of gray) are used
 */

/**
 * Check if a color is grayscale (R = G = B)
 * @param {string} color - Hex color string (e.g., "#FF5733" or "#808080")
 * @returns {boolean} True if grayscale, false otherwise
 */
export function isGrayscaleColor(color) {
  if (!color || typeof color !== 'string') {
    return false
  }

  // Remove # if present
  const hex = color.replace('#', '')

  // Handle 3-character hex codes
  if (hex.length === 3) {
    const r = hex[0]
    const g = hex[1]
    const b = hex[2]
    return r === g && g === b
  }

  // Handle 6-character hex codes
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    return r === g && g === b
  }

  return false
}

/**
 * Validate and sanitize a color to ensure it's grayscale
 * @param {string} color - Color to validate
 * @param {string} fallback - Fallback color if validation fails (default: #808080)
 * @returns {string} Valid grayscale color
 */
export function validateGrayscaleColor(color, fallback = '#808080') {
  if (isGrayscaleColor(color)) {
    return color.startsWith('#') ? color : `#${color}`
  }
  console.warn(`Non-grayscale color "${color}" rejected. Using fallback: ${fallback}`)
  return fallback
}

/**
 * Convert any color to grayscale by averaging RGB values
 * @param {string} color - Hex color to convert
 * @returns {string} Grayscale hex color
 */
export function convertToGrayscale(color) {
  if (!color || typeof color !== 'string') {
    return '#808080' // Default gray
  }

  const hex = color.replace('#', '')

  let r, g, b

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16)
    g = parseInt(hex.substring(2, 4), 16)
    b = parseInt(hex.substring(4, 6), 16)
  } else {
    return '#808080'
  }

  // Calculate grayscale value (average method)
  const gray = Math.round((r + g + b) / 3)
  const grayHex = gray.toString(16).padStart(2, '0')

  return `#${grayHex}${grayHex}${grayHex}`
}

/**
 * Predefined grayscale colors for quick selection
 */
export const GRAYSCALE_COLORS = [
  '#ffffff', // White
  '#f5f5f5', // Off White
  '#eeeeee', // Very Light Gray
  '#e0e0e0', // Light Gray
  '#d4d4d4', // Light Medium Gray
  '#bdbdbd', // Medium Light Gray
  '#9e9e9e', // Medium Gray
  '#808080', // Gray
  '#707070', // Medium Dark Gray
  '#616161', // Dark Medium Gray
  '#4f4f4f', // Dark Gray
  '#3d3d3d', // Very Dark Gray
  '#2b2b2b', // Near Black
  '#1a1a1a', // Almost Black
  '#000000', // Black
]

