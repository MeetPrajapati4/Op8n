/**
 * Resilient JSON Extractor and Repair Utility
 * 
 * Handles all AI model JSON anomalies:
 * - Markdown fences (```json ... ```)
 * - Preamble / postamble text
 * - Trailing commas in arrays and objects
 * - Single-line and multi-line comments
 * - Unescaped newlines/tabs inside string literals
 * - Truncated JSON streams (unclosed quotes, arrays, braces)
 * - Intelligent balanced bracket scanning (avoiding naive greedy regex issues)
 */

/**
 * Intelligent balanced scanner to locate and slice the root JSON object or array.
 * Skips braces inside string literals and properly respects backslash escapes.
 */
export function extractJsonObjectString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  let cleaned = raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => {
      // If code fence starts, strip prefix
      return '';
    })
    .trim();

  // Strip trailing markdown fence if present
  cleaned = cleaned.replace(/\n?```[\s\S]*$/, '').trim();

  // Find start of JSON structure: either '{' or '['
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx === -1) {
    return cleaned;
  }

  // Scan through tokens respecting string escapes
  let inString = false;
  let isEscaped = false;
  const stack: string[] = [];
  let endIdx = -1;

  for (let i = startIdx; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}') {
      if (stack[stack.length - 1] === '{') {
        stack.pop();
        if (stack.length === 0) {
          endIdx = i;
          break;
        }
      }
    } else if (char === ']') {
      if (stack[stack.length - 1] === '[') {
        stack.pop();
        if (stack.length === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }

  if (endIdx !== -1) {
    return cleaned.slice(startIdx, endIdx + 1);
  }

  // If unclosed (e.g. truncated stream), slice from startIdx to end
  return cleaned.slice(startIdx);
}

/**
 * Repairs common syntax errors in AI-produced JSON:
 * - Trailing commas before `}` or `]`
 * - JS-style comments
 * - Unclosed string quotes or missing closing braces/brackets
 */
export function repairJsonSyntax(input: string): string {
  if (!input) return '';

  let str = input.trim();

  // 1. Remove comments outside strings
  let sanitized = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = str[i + 1];

    if (inString) {
      sanitized += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    // Check for single-line comment //
    if (char === '/' && nextChar === '/') {
      const newlineIdx = str.indexOf('\n', i + 2);
      if (newlineIdx === -1) {
        break; // Remainder of string is a comment
      }
      i = newlineIdx - 1;
      continue;
    }

    // Check for multi-line comment /* */
    if (char === '/' && nextChar === '*') {
      const closeIdx = str.indexOf('*/', i + 2);
      if (closeIdx === -1) {
        break;
      }
      i = closeIdx + 1;
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    sanitized += char;
  }

  str = sanitized;

  // 2. Remove trailing commas before closing braces or brackets:
  // e.g. { "a": 1, } -> { "a": 1 }
  // e.g. [ 1, 2, ] -> [ 1, 2 ]
  str = str.replace(/,\s*([}\]])/g, '$1');

  // 3. Balance unclosed brackets, braces, or string quotes if truncated
  const stack: string[] = [];
  inString = false;
  isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}') {
      if (stack[stack.length - 1] === '{') {
        stack.pop();
      }
    } else if (char === ']') {
      if (stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
  }

  // If a string was left open, close it
  if (inString) {
    str += '"';
  }

  // Check if string ends with a hanging key without value, e.g. ` "key": `
  str = str.replace(/:\s*$/, ': null');
  // Check if string ends with a hanging comma
  str = str.replace(/,\s*$/, '');

  // Close any unclosed braces or brackets in reverse order
  while (stack.length > 0) {
    const unclosed = stack.pop();
    if (unclosed === '{') {
      str += '}';
    } else if (unclosed === '[') {
      str += ']';
    }
  }

  return str;
}

/**
 * Escapes unescaped raw newlines or tabs inside JSON string values
 */
export function sanitizeStringLiterals(jsonStr: string): string {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (inString) {
      if (isEscaped) {
        isEscaped = false;
        result += char;
      } else if (char === '\\') {
        isEscaped = true;
        result += char;
      } else if (char === '"') {
        inString = false;
        result += char;
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    }

    result += char;
  }

  return result;
}

/**
 * Robust JSON Parser: Tries 4 increasingly permissive parsing stages.
 * Guaranteed to succeed on clean or slightly malformed AI JSON.
 */
export function robustJsonParse<T = unknown>(raw: string): T {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Empty or invalid output provided to JSON parser');
  }

  // Stage 1: Fast direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // Continue to stage 2
  }

  // Stage 2: Extract JSON object / array substring
  const extracted = extractJsonObjectString(raw);
  try {
    return JSON.parse(extracted);
  } catch {
    // Continue to stage 3
  }

  // Stage 3: Syntax repair (trailing commas, comments, balanced closures)
  const repaired = repairJsonSyntax(extracted);
  try {
    return JSON.parse(repaired);
  } catch {
    // Continue to stage 4
  }

  // Stage 4: Sanitize string literals with unescaped control chars
  const sanitized = sanitizeStringLiterals(repaired);
  try {
    return JSON.parse(sanitized);
  } catch (finalErr) {
    const preview = raw.length > 200 ? raw.slice(0, 200) + '...' : raw;
    throw new Error(
      `JSON Parse Failure: Unable to parse output. Preview: "${preview}". Error: ${
        finalErr instanceof Error ? finalErr.message : String(finalErr)
      }`
    );
  }
}

/**
 * Fallback node extractor: If a JSON payload was severely truncated or mangled,
 * this function scans for individual valid n8n node objects and synthesizes a
 * minimal valid n8n workflow so the user never receives a fatal error.
 */
export function synthesizeFallbackWorkflow(rawText: string, fallbackName = 'Recovered Automation'): any {
  const nodes: any[] = [];
  const nodeRegex = /\{\s*"id"\s*:\s*"[^"]+"\s*,\s*"name"\s*:\s*"[^"]+"\s*,\s*"type"\s*:\s*"[^"]+"[\s\S]*?\}/g;

  let match: RegExpExecArray | null;
  while ((match = nodeRegex.exec(rawText)) !== null) {
    try {
      const nodeCandidate = repairJsonSyntax(match[0]);
      const parsedNode = JSON.parse(nodeCandidate);
      if (parsedNode && parsedNode.id && parsedNode.name && parsedNode.type) {
        nodes.push(parsedNode);
      }
    } catch {
      // ignore individual malformed candidate
    }
  }

  // If no nodes found, create default trigger and note
  if (nodes.length === 0) {
    nodes.push({
      id: 'node-1',
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [250, 300],
      parameters: {},
    });
  }

  return {
    name: fallbackName,
    nodes,
    connections: {},
    active: false,
    settings: {},
    tags: [],
  };
}
