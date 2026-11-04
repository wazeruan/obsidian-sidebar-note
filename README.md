# PDF Companion Note

An [Obsidian](https://obsidian.md) plugin that keeps a note next to every PDF you read.

- **Open a PDF → its note appears in the right sidebar** (or a split pane, if you prefer).
- **No note yet?** The sidebar shows a **Create note** button. Nothing is created until you click it.
- **Notes button in the PDF header:** every PDF tab gets a notebook icon that creates or opens its note.
- **Tidy vault:** all notes live in one folder (`PDF Notes` by default), hidden from the file explorer. They still work with links, search, backlinks and the graph.

Works well with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus): copy a link to a text selection in the PDF and paste it into the companion note to get a highlight that jumps back to the passage.

## Install

### From Community plugins
Search for **PDF Companion Note** in *Settings → Community plugins → Browse* (once it's listed).

### With BRAT
1. Install the **BRAT** community plugin.
2. Run **BRAT: Add a beta plugin for testing** and enter `wazeruan/obsidian-pdf-companion-note`.
3. Enable **PDF Companion Note** in *Settings → Community plugins*.

### Manually
1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/wazeruan/obsidian-pdf-companion-note/releases/latest).
2. Put them in `<your vault>/.obsidian/plugins/pdf-companion-note/`.
3. Reload Obsidian and enable **PDF Companion Note** in *Settings → Community plugins*.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Where to show the note | Right sidebar | Right sidebar, or a split pane next to the PDF |
| Notes folder | `PDF Notes` | Where notes are stored; each note is named after its PDF |
| Hide notes folder in file explorer | On | Hides the folder from the file explorer only |
| New note template | Empty | Optional starting text. `{{title}}` = PDF name, `{{pdf}}` = PDF path |

Command: **Create or open note for current PDF** (assign a hotkey if you like).

## Notes

- Notes are matched to PDFs by file name, so two PDFs with the same name in different folders share a note.
- Renaming a PDF inside Obsidian renames its note too.
- To also keep the notes out of search and the graph, add the folder under *Settings → Files and links → Excluded files*.

## Releasing

1. Bump `version` in `manifest.json` (and add it to `versions.json`).
2. Commit, then push a tag with the same version: `git tag 1.0.1 && git push origin 1.0.1`.
3. GitHub Actions creates the release with `main.js`, `manifest.json` and `styles.css` attached.

## License

MIT
