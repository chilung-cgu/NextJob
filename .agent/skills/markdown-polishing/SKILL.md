---
name: markdown-polishing
description: Guidelines and rules for polishing Markdown files to ensure consistent formatting, high readability, and correct rendering.
---

# Markdown Polishing Guidelines

Applies to: All `.md` files, especially interview prep and technical documentation like `面試重點.md` and `架構複習.md`.

## 1. Tables Formatting
- **Rule**: Do NOT wrap Markdown tables (lines starting with `|`) inside code blocks (` ``` `).
- **Action**: If a table is inside code blocks, remove the backticks so it renders as a rich table.
- **Conversion**: If you see an ASCII art table (using `+`, `-`, `|` manually drawn), convert it to a standard Markdown table unless it is a complex diagram that cannot be represented by a grid.
- **Alignment**: Use `:---` for left align, `:---:` for center, `---:` for right. Default to left for text.

## 2. Lists and Hierarchy
- **Rule**: Nested lists must use proper indentation to be rendered correctly as sub-items.
- **Indentation**: Use **4 spaces** (or visually sufficient indentation) for sub-list items.
- **List Types**:
  - Use `1.`, `2.` for ordered steps.
  - Use `*` or `-` for unordered items.
- **Continuity**: Avoid breaking the list flow. If a list item has multiple paragraphs, indented the subsequent paragraphs.
- **Correction**: If you see lists manually numbered like `(1)`, `(2)` inside a block of text without proper list formatting, convert them to standard Markdown lists.

## 3. Q&A Sections (Interview Prep)
- **Rule**: Clear visual distinction between Question and Answer.
- **Format Standard**:
  ```markdown
  **Q: "Question text here?"**
  *   **A**: "Answer text here..."
  ```
- **Rationale**: This structure allows the user to quickly scan questions (Bold Q) and see the answer indented and distinct.

## 4. Code Blocks
- **Rule**: Always specify the language for syntax highlighting (e.g., `bash`, `c`, `cpp`, `python`, `json`).
- **Rule**: Do not put Markdown syntax (headers `##`, tables `|`, bold `**`) inside code blocks unless explicitly documenting Markdown syntax itself.
- **Validation**: Check if ` ``` ` blocks contain metadata lines like `| Name | Description |` - if so, it's likely a mistake.

## 5. Preview Check Strategy
- **Simulation**: When editing, imagine the "Preview" mode.
- **Check**:
  - Is the table distinct from the code?
  - Are the sub-points actually indented in the rendered view?
  - Is the text wall broken up by headers or lists?
