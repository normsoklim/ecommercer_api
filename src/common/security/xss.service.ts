import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * XSS sanitization service for user-generated content.
 *
 * Provides two levels of sanitization:
 * - sanitizeText: removes all HTML markup (safest for plain-text fields like
 *   review comments and titles).
 * - sanitizeRichText: allows a limited allowlist of formatting tags (for
 *   fields where intentional HTML formatting is required, e.g. product
 *   descriptions).
 *
 * Never use this service on passwords, authentication tokens, or arbitrary
 * structured data. Apply field-specific validation instead.
 */
@Injectable()
export class XssService {
  /**
   * Strips all HTML from a value, returning safe plain text.
   * Use for ordinary product reviews, comments, and other user-generated
   * text that should never be rendered as HTML.
   */
  sanitizeText(value: string): string {
    if (!value) {
      return value;
    }

    return sanitizeHtml(value, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  /**
   * Allows only a safe subset of HTML formatting tags.
   * Use for rich-text fields where limited formatting is intentionally
   * permitted (e.g. product descriptions).
   */
  sanitizeRichText(value: string): string {
    if (!value) {
      return value;
    }

    return sanitizeHtml(value, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'b',
        'i',
        'em',
        'ul',
        'ol',
        'li',
      ],
      allowedAttributes: {},
    });
  }
}
