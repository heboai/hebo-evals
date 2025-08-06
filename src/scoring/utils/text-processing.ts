/**
 * Common text processing utilities used across scoring modules
 */

/**
 * Tokenizes text by converting to lowercase, removing punctuation, and splitting on whitespace
 * @param text - The text to tokenize
 * @returns Array of tokens
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Normalizes text for comparison by converting to lowercase and removing punctuation
 * @param text - The text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:()\[\]"]/g, '');
}

/**
 * Checks if two tokens represent the same number (e.g., "4" and "four")
 * @param token1 - First token
 * @param token2 - Second token
 * @returns True if they represent the same number
 */
export function isNumberMatch(token1: string, token2: string): boolean {
  const numberWords: Record<string, string> = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
    '10': 'ten',
    '11': 'eleven',
    '12': 'twelve',
    '13': 'thirteen',
    '14': 'fourteen',
    '15': 'fifteen',
    '16': 'sixteen',
    '17': 'seventeen',
    '18': 'eighteen',
    '19': 'nineteen',
    '20': 'twenty',
  };

  // Check if token1 is a number and token2 is the word equivalent
  if (numberWords[token1] === token2) {
    return true;
  }

  // Check if token2 is a number and token1 is the word equivalent
  if (numberWords[token2] === token1) {
    return true;
  }

  // Check if both are numbers
  if (!isNaN(Number(token1)) && !isNaN(Number(token2))) {
    return Number(token1) === Number(token2);
  }

  return false;
}
