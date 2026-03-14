
## Known Issues / Future Improvements

### Centered text: skip rag smoothing
`optimizeBreaks` + `shapeRag` assume left-aligned text with a right rag to smooth. On centered text, the word-spacing adjustments create a visible kerning jump with no benefit — there's no rag to fix. 

**Current workaround:** `data-no-smooth` attribute on centered elements.

**Future fix:** The engine should auto-detect `text-align: center` (via `getComputedStyle`) and skip the rag pass automatically. Orphan prevention and binding should still run.

### Visible phase transition
The 1.6s delayed execution means users can see the kerning/word-spacing change live. On fast connections this looks like a layout jump. Consider:
- Reducing the delay where hydration isn't a concern (non-SSR/SPA contexts)
- Adding a CSS transition on word-spacing so the shift is smooth rather than sudden
- Or using `opacity: 0` → `opacity: 1` anti-flicker pattern (already exists in some codepaths)

### Mobile measures
All DOM-based functions (`fixRealOrphans`, `optimizeBreaks`, etc.) work at any width because they measure rendered lines. The string-based `typesetText()` bails under 35ch for binding rules — but the DOM functions don't need this guard. No changes needed to the engine; just use `GlobalTypeset` (DOM-based) instead of calling `typesetText` directly on narrow layouts.
