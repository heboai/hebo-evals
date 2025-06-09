import { MarkdownPatterns } from './tokenizer';

/**
 * Interface for markdown format handlers
 */
export interface MarkdownHandler {
  pattern: RegExp;
  handle(match: RegExpMatchArray): string;
}

/**
 * Handler for markdown headers (h1-h6)
 */
export class HeaderHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_HEADER;

  handle(match: RegExpMatchArray): string {
    const [, hashes, text] = match;
    return `${hashes} ${text.trim()}`;
  }
}

/**
 * Handler for markdown lists (ordered and unordered)
 */
export class ListHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_LIST;

  handle(match: RegExpMatchArray): string {
    const [, indent, marker, text] = match;
    return `${indent}${marker} ${text.trim()}`;
  }
}

/**
 * Handler for markdown task lists
 */
export class TaskListHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_TASK_LIST;

  handle(match: RegExpMatchArray): string {
    const [, indent, checked, text] = match;
    return `${indent}* [${checked}] ${text.trim()}`;
  }
}

/**
 * Handler for markdown code blocks
 */
export class CodeBlockHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_CODE_BLOCK;

  handle(match: RegExpMatchArray): string {
    const [, lang, code] = match;
    return `\`\`\`${lang}\n${code.trim()}\n\`\`\``;
  }
}

/**
 * Handler for markdown inline code
 */
export class InlineCodeHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_INLINE_CODE;

  handle(match: RegExpMatchArray): string {
    const [, code] = match;
    return `\`${code}\``;
  }
}

/**
 * Handler for markdown bold text
 */
export class BoldHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_BOLD;

  handle(match: RegExpMatchArray): string {
    const [, text] = match;
    return `**${text}**`;
  }
}

/**
 * Handler for markdown italic text
 */
export class ItalicHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_ITALIC;

  handle(match: RegExpMatchArray): string {
    const [, text] = match;
    return `*${text}*`;
  }
}

/**
 * Handler for markdown blockquotes
 */
export class BlockquoteHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_BLOCKQUOTE;

  handle(match: RegExpMatchArray): string {
    const [, text] = match;
    return `> ${text}`;
  }
}

/**
 * Handler for markdown horizontal rules
 */
export class HorizontalRuleHandler implements MarkdownHandler {
  pattern = MarkdownPatterns.MARKDOWN_HORIZONTAL_RULE;

  handle(): string {
    return '---';
  }
}

/**
 * Handler for markdown tables
 */
export class TableHandler implements MarkdownHandler {
  pattern = /^\|(.+)\|$/;

  handle(match: RegExpMatchArray): string {
    const [, content] = match;
    return `|${content.trim()}|`;
  }
}

/**
 * Handler for markdown table separators
 */
export class TableSeparatorHandler implements MarkdownHandler {
  pattern = /^\|([:\-|]+)\|$/;

  handle(match: RegExpMatchArray): string {
    const [, content] = match;
    return `|${content.trim()}|`;
  }
}

/**
 * Handler for markdown links
 */
export class LinkHandler implements MarkdownHandler {
  pattern = /\[([^\]]+)\]\(([^)]+)\)/;

  handle(match: RegExpMatchArray): string {
    const [, text, url] = match;
    return `[${text}](${url})`;
  }
}

/**
 * Collection of all markdown handlers
 */
export const markdownHandlers: MarkdownHandler[] = [
  new HeaderHandler(),
  new ListHandler(),
  new TaskListHandler(),
  new CodeBlockHandler(),
  new InlineCodeHandler(),
  new BoldHandler(),
  new ItalicHandler(),
  new BlockquoteHandler(),
  new HorizontalRuleHandler(),
  new TableHandler(),
  new TableSeparatorHandler(),
  new LinkHandler(),
];
