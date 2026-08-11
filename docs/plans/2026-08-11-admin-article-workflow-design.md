# Admin Article Workflow Design

## Goal

Make article creation and Markdown import safe for long editing sessions, easy to locate after batch operations, and immediately previewable without saving content to the server.

## Editing State

The article form is the active editor, while `state.articles` is the in-memory draft store. Every article form input or change event synchronizes the active form back into `state.articles`. Switching articles, creating an article, importing files, exporting, auditing, and saving all perform an additional explicit synchronization before acting.

New articles are inserted without replacing the active draft. Filters are reset only when necessary to reveal the newly selected article, and pagination is calculated from the selected article's position in the current sort order.

## Markdown Import

The file input accepts one or more Markdown files. Each file is read, parsed, and validated independently:

- Valid files are added directly to the in-memory article list.
- Invalid files do not create article records and return file-specific validation reasons.
- A mixed batch imports valid files and reports invalid files in the same result panel.
- Slug conflicts never overwrite an existing article. A numeric suffix creates a unique slug and the rename is reported.
- The first imported article becomes active, and the result panel appears at the top of the article workspace with links to every imported article.

Content is written to Markdown files only after the existing "Save all" action and change-summary confirmation.

## Live Preview

The saved-page iframe is replaced by a local preview rendered from the current form values. Title, status, category, date, excerpt, and Markdown body update on input without a network request or content save. The separate "Open" link remains available for checking the last saved public page.

## Error Handling

Import failures identify the source filename and all validation messages. Read failures use a UTF-8 Markdown hint. Successful imports, automatic slug renames, and failures use distinct result styles and remain visible until dismissed.

## Verification

- Run `npm run build` and `git diff --check`.
- Edit an existing article, create another article, then reopen the first and confirm its unsaved fields remain intact.
- Import multiple valid files plus one invalid file and confirm partial success with detailed errors.
- Import a duplicate slug and confirm the existing article remains unchanged while the imported slug receives a suffix.
- Confirm live preview updates before saving and that desktop/mobile layouts have no horizontal overflow.
