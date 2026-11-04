const { Plugin, ItemView, TFile, Notice, normalizePath, PluginSettingTab, Setting } = require("obsidian");

const VIEW_TYPE = "sidebar-note-placeholder";
const ICON = "notebook-pen";

const DEFAULT_SETTINGS = {
  where: "sidebar", // "sidebar" or "split"
  notesFolder: "PDF Notes",
  hideFolder: true,
  template: "", // new notes start empty
};

/** Shown in the note pane when the current PDF has no note yet. */
class PlaceholderView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.pdfPath = null;
  }
  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "PDF note"; }
  getIcon() { return ICON; }
  getState() { return { pdf: this.pdfPath }; }

  async setState(state, result) {
    await super.setState(state, result);
    this.pdfPath = state?.pdf ?? null;
    this.render();
  }

  render() {
    const el = this.contentEl;
    el.empty();
    el.addClass("sidebar-note-placeholder");
    const pdf = this.pdfPath ? this.app.vault.getFileByPath(this.pdfPath) : null;
    if (!pdf) {
      el.createEl("p", { text: "Open a PDF to see its note here." });
      return;
    }
    el.createEl("p", { text: `No note for “${pdf.basename}” yet.` });
    el.createEl("button", { text: "Create note", cls: "mod-cta" })
      .addEventListener("click", () => this.plugin.createAndOpen(pdf));
  }
}

module.exports = class SidebarNote extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.buttons = new Map(); // PDF view -> header button

    this.registerView(VIEW_TYPE, (leaf) => new PlaceholderView(leaf, this));

    const ws = this.app.workspace;
    this.registerEvent(ws.on("file-open", (file) => {
      if (file?.extension === "pdf") this.showForPdf(file);
    }));
    this.registerEvent(ws.on("layout-change", () => this.addHeaderButtons()));
    ws.onLayoutReady(() => this.addHeaderButtons());

    // Keep the note's name in sync when a PDF is renamed.
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onRename(file, oldPath)));

    this.addCommand({
      id: "create-or-open-note",
      name: "Create or open note for current PDF",
      checkCallback: (checking) => {
        const file = ws.getActiveFile();
        if (file?.extension !== "pdf") return false;
        if (!checking) this.createAndOpen(file);
        return true;
      },
    });

    this.styleEl = document.head.createEl("style");
    this.register(() => this.styleEl.remove());
    this.updateHideStyle();

    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload() {
    this.buttons.forEach((el) => el.remove());
  }

  /* ---------- Paths ---------- */

  folder() {
    return normalizePath(this.settings.notesFolder.trim() || DEFAULT_SETTINGS.notesFolder);
  }

  notePath(name) {
    return normalizePath(`${this.folder()}/${name}.md`);
  }

  getNote(pdf) {
    return this.app.vault.getFileByPath(this.notePath(pdf.basename));
  }

  /* ---------- Note pane ---------- */

  /** Finds the pane we use for notes, optionally creating it. */
  getNoteLeaf(create) {
    const ws = this.app.workspace;
    const sidebar = this.settings.where === "sidebar";
    const root = sidebar ? ws.rightSplit : ws.rootSplit;
    const prefix = this.folder() + "/";

    let found = null;
    ws.iterateAllLeaves((leaf) => {
      if (found || leaf.getRoot() !== root) return;
      const view = leaf.view;
      if (view.getViewType() === VIEW_TYPE || view.file?.path.startsWith(prefix)) found = leaf;
    });
    if (found || !create) return found;
    return sidebar ? ws.getRightLeaf(false) : ws.getLeaf("split", "vertical");
  }

  isOpen(file) {
    let open = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.file?.path === file.path) open = true;
    });
    return open;
  }

  async showForPdf(pdf) {
    const note = this.getNote(pdf);
    if (note && this.isOpen(note)) return;

    // In split mode, don't open a whole pane just to show the "Create note" button.
    const leaf = this.getNoteLeaf(!!note || this.settings.where === "sidebar");
    if (!leaf) return;

    try {
      if (note) await leaf.openFile(note, { active: false });
      else await leaf.setViewState({ type: VIEW_TYPE, state: { pdf: pdf.path }, active: false });
      if (this.settings.where === "sidebar") await this.app.workspace.revealLeaf(leaf);
    } catch (e) {
      console.error("Sidebar Note:", e);
    }
  }

  async createAndOpen(pdf) {
    try {
      let note = this.getNote(pdf);
      if (!note) {
        if (!this.app.vault.getFolderByPath(this.folder())) {
          await this.app.vault.createFolder(this.folder());
        }
        const body = this.settings.template
          .replaceAll("{{pdf}}", pdf.path)
          .replaceAll("{{title}}", pdf.basename);
        note = await this.app.vault.create(this.notePath(pdf.basename), body);
      }
      const leaf = this.getNoteLeaf(true);
      await leaf.openFile(note, { active: true });
      if (this.settings.where === "sidebar") await this.app.workspace.revealLeaf(leaf);
    } catch (e) {
      console.error("Sidebar Note:", e);
      new Notice(`Sidebar Note: couldn't create the note (${e.message})`);
    }
  }

  async onRename(file, oldPath) {
    if (!(file instanceof TFile) || file.extension !== "pdf") return;
    const oldName = oldPath.split("/").pop().replace(/\.pdf$/i, "");
    if (oldName === file.basename || this.getNote(file)) return;
    const oldNote = this.app.vault.getFileByPath(this.notePath(oldName));
    if (oldNote) {
      await this.app.fileManager.renameFile(oldNote, this.notePath(file.basename));
    }
  }

  /* ---------- PDF header button ---------- */

  addHeaderButtons() {
    const pdfViews = new Set(this.app.workspace.getLeavesOfType("pdf").map((l) => l.view));
    for (const view of pdfViews) {
      if (this.buttons.has(view)) continue;
      const button = view.addAction(ICON, "Create / open PDF note", () => {
        if (view.file) this.createAndOpen(view.file);
      });
      this.buttons.set(view, button);
    }
    for (const view of this.buttons.keys()) {
      if (!pdfViews.has(view)) this.buttons.delete(view); // tab was closed
    }
  }

  /* ---------- Hide notes folder ---------- */

  updateHideStyle() {
    const path = this.folder().replace(/["\\]/g, "\\$&");
    this.styleEl.textContent = this.settings.hideFolder
      ? `.nav-folder:has(> .nav-folder-title[data-path="${path}"]) { display: none !important; }`
      : "";
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateHideStyle();
  }
};

class SettingsTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const save = (key) => async (value) => {
      s[key] = value;
      await this.plugin.saveSettings();
    };
    containerEl.empty();

    new Setting(containerEl)
      .setName("Where to show the note")
      .addDropdown((d) => d
        .addOption("sidebar", "Right sidebar")
        .addOption("split", "Split pane next to the PDF")
        .setValue(s.where)
        .onChange(save("where")));

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("All PDF notes are stored here, named after their PDF.")
      .addText((t) => t
        .setPlaceholder(DEFAULT_SETTINGS.notesFolder)
        .setValue(s.notesFolder)
        .onChange(save("notesFolder")));

    new Setting(containerEl)
      .setName("Hide notes folder in file explorer")
      .setDesc("Notes still work with links, search and backlinks; the folder is just not shown.")
      .addToggle((t) => t.setValue(s.hideFolder).onChange(save("hideFolder")));

    new Setting(containerEl)
      .setName("New note template")
      .setDesc("Optional text for new notes (empty by default). {{title}} = PDF file name, {{pdf}} = PDF path.")
      .addTextArea((t) => {
        t.setValue(s.template).onChange(save("template"));
        t.inputEl.rows = 8;
        t.inputEl.addClass("sidebar-note-template");
      });
  }
}
