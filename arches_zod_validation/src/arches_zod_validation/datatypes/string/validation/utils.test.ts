// htmlToPlainText.test.ts
import { describe, it, expect } from 'vitest';
import { htmlToPlainText } from './utils.ts'; // <-- adjust path as needed

describe('htmlToPlainText – DOM environment', () => {
    // If tests are running in a pure Node env without jsdom, we skip DOM-specific tests.
    if (typeof document === 'undefined') {
        it('skips DOM-specific tests when document is not available', () => {
            expect(typeof document).toBe('undefined');
        });
        return;
    }

    it('returns empty string for empty / falsy input', () => {
        expect(htmlToPlainText('')).toBe('');
        // @ts-expect-error
        expect(htmlToPlainText(null)).toBe('');
        // @ts-expect-error
        expect(htmlToPlainText(undefined)).toBe('');
    });

    it('converts a simple paragraph to plain text', () => {
        const html = '<p>Hello world</p>';
        const result = htmlToPlainText(html);
        expect(result).toBe('Hello world');
    });

    it('converts <br> tags into newline characters', () => {
        const html = 'Hello<br>World';
        const result = htmlToPlainText(html);
        expect(result).toBe('Hello\nWorld');
    });

    it('trims spaces before newlines created from <br>', () => {
        const html = '<p>Hello   <br>World</p>';
        const result = htmlToPlainText(html);
        // note: spaces before the newline should be removed
        expect(result).toBe('Hello\nWorld');
    });

    it('handles multiple paragraphs (each ending with a single newline)', () => {
        const html = '<p>First paragraph.</p><p>Second paragraph.</p>';
        const result = htmlToPlainText(html);

        // Current implementation appends a single "\n" per <p>,
        // so the paragraphs end up as:
        // "First paragraph.\nSecond paragraph."
        expect(result).toBe('First paragraph.\nSecond paragraph.');
    });

    it('renders unordered lists with bullet prefixes and newline after each item', () => {
        const html = `
            <ul>
                <li>First item</li>
                <li>Second item</li>
            </ul>
        `;
        const result = htmlToPlainText(html);

        // Each <li> gets "• " prefix and a trailing "\n".
        // .trim() at the end removes the last newline only.
        expect(result).toBe('• First item\n• Second item');
    });

    it('renders ordered lists with numeric prefixes and newline after each item', () => {
        const html = `
            <ol>
                <li>First</li>
                <li>Second</li>
                <li>Third</li>
            </ol>
        `;
        const result = htmlToPlainText(html);

        expect(result).toBe('1. First\n2. Second\n3. Third');
    });

    it('normalizes non-breaking spaces to regular spaces', () => {
        const html = '<p>Hello&nbsp;world&nbsp;&nbsp;!</p>';
        const result = htmlToPlainText(html);

        // &nbsp; → "\u00a0" in the DOM, which should be converted to " "
        expect(result).toBe('Hello world  !');
    });
});

describe('htmlToPlainText – fallback without document (stripTagsFallback)', () => {
    it('uses the non-DOM fallback when document is not available', () => {
        const hadDocument = 'document' in globalThis;
        const originalDocument = (globalThis as any).document;

        if (hadDocument) {
            // Remove `document` from the global object so that
            // `typeof document === "undefined"` inside the function becomes true.
            delete (globalThis as any).document;
        }

        try {
            const html = '<p>Hello<br>World</p>';
            const result = htmlToPlainText(html);

            // stripTagsFallback behavior:
            // <br> -> "\n", </p> -> "\n", then tags stripped, then
            // whitespace collapsed to single spaces.
            // "<p>Hello<br>World</p>" -> "Hello World"
            expect(result).toBe('Hello World');
        } finally {
            // Restore original document so other tests (or other suites)
            // aren’t affected.
            if (hadDocument) {
                (globalThis as any).document = originalDocument;
            }
        }
    });
});
