# 📝 Markey-Mod - Simple & Free Markdown Editor

A powerful WYSIWYG markdown editor that runs entirely in your browser. No installation, no sign-up required!

**The ultimate tool for collaborative document workflows.** Markey-Mod lets you create markdown documents and export them as **fully editable HTML files** that anyone can modify and return to you. Perfect for spec-driven AI development, stakeholder reviews, and collaborative editing - share HTML exports with colleagues who can edit and send back their changes as markdown.

## 🚀 Try It Now

**[Launch Markey-Mod Editor](https://jottavia.github.io/marky-mod/)** - Start editing markdown instantly!

**Backup site:** [marky-md.web.app](https://marky-md.web.app/) — the original upstream project's deployment, kept here only as a fallback mirror.

## 🙏 Credits

Markey-Mod is a fork of **[Marky by Tommertom](https://github.com/Tommertom/marky)**. Credit is due: the original WYSIWYG editor, its offline-first design, and the editable-HTML workflow are upstream's work. This fork adds 22 themes, text obfuscation, password-based encryption, page setup for PDF/DOCX, DOCX in HTML exports.

## ✨ What You Can Do

### 📋 Import Your Content
- **Paste from Clipboard** - Click "Paste MD" to load markdown directly from your clipboard
- **Upload Files** - Import existing `.md`, `.markdown`, or `.txt` files with one click

### ✏️ Edit with Ease
- **WYSIWYG Editing** - See your formatted text as you type, no preview pane needed
- **Formatting Toolbar** - Select any text to reveal formatting options (headings, bold, italic, lists, code blocks)
- **Live Updates** - Changes appear instantly as you type
- **Auto-Save** - Your work is automatically saved to your browser every second
- **22 Themes** - Light, Dark, and 20 Fable-inspired color schemes from the theme dropdown; your choice is saved and travels inside exported HTML files
- **Clear Document** - Start fresh with a single click

### 🔒 Obfuscate & Encrypt

- **Obfuscate** - Playful text transforms (ROT13, ROT47, Caesar, Atbash, Reverse, Base64, Hex, Binary, URL encoding, Leet speak) applied to your selection or the whole document. Obfuscation only — not secure encryption
- **Real encryption** - Password-based encryption (AES-256-GCM, AES-256-CBC, ChaCha20, Rabbit, Speck, XTEA, XXTEA, Trivium, RC4) packed as `MK2$...` envelopes. ⚠️ **Security untested — use at own risk.** Only AES-GCM detects wrong passwords

### 📄 Page Setup

- Click **Page** to choose paper size (Letter, Legal, Tabloid, A4, A5 — Letter 8.5 × 11 in by default) and per-side margins in inches (1 inch by default). PDF and DOCX exports honor these settings

### 💾 Export Your Work
- **Download as Markdown** - Save your work as a `.md` file
- **Copy to Clipboard** - Instantly copy all your markdown with one click
- **Export as HTML** - Generate standalone, **fully editable** HTML files that recipients can modify and send back. Perfect for collaborative workflows - they can edit the HTML directly in their browser, make changes, and return it to you as markdown!
- **Export as PDF** - Generate professional, print-ready PDF documents with one click, using your page setup (paper size and margins). Images are automatically optimized to ensure reasonable file sizes while maintaining quality
- **Export as DOCX** - Generate Word documents with your page setup applied. Standalone HTML exports include the DOCX button too

### 🎨 What You Can Format
- **Headings** (H1, H2, H3) - Organize your content with hierarchy
- **Bold & Italic** - Emphasize important text
- **Lists** - Create bullet points or numbered lists
- **Code Blocks** - Display code snippets beautifully
- **Tables** - Organize data in structured tables
- **Links & Images** - Add hyperlinks and embed images
- **Blockquotes** - Highlight quotes or important notes
- Mermaid diagrams
- Latex math formulas

### Mermain examples
```mermaid
  graph TD;
      A-->B;
      A-->C;
      B-->D;
      C-->D;
```

### LaTeX examples
```latex
$$\mathbb{N} = \{ a \in \mathbb{Z} : a > 0 \}$$
```

$$\mathbb{N} = \{ a \in \mathbb{Z} : a > 0 \}$$

## ⌨️ Keyboard Shortcuts

Make your workflow even faster:

- **Ctrl+S** (Cmd+S on Mac) - Download as markdown file
- **Ctrl+O** (Cmd+O on Mac) - Upload/open a markdown file
- **Ctrl+Shift+P** (Cmd+Shift+P on Mac) - Export as PDF file
- **Ctrl+Z** (Cmd+Z on Mac) - Undo
- **Ctrl+Y** or **Ctrl+Shift+Z** (Cmd+Shift+Z on Mac) - Redo

## 🎯 Perfect For

- 📚 Writing README files for GitHub projects
- 📖 Creating documentation and guides
- 📝 Taking notes and writing articles
- ✍️ Drafting blog posts in markdown
- 📊 Creating technical documentation
- 🎓 Academic writing and research notes
- 🤖 **Collaborative Workflows** - Export as editable HTML, share with colleagues who can make changes directly in their browser, then receive their edits back as markdown
- 🔄 **Spec-Driven AI Development** - Create specs, export as editable HTML for stakeholder review and editing, receive their modified versions back, and seamlessly continue your AI development workflow

## ✨ Features

- ✅ **Editable HTML Exports** - Recipients can edit exported HTML files and send changes back
- ✅ **No Account Required** - Start using immediately
- ✅ **Works Offline** - After first load, works without internet
- ✅ **No Data Sent to Servers** - All editing happens locally in your browser
- ✅ **Free Forever** - No subscriptions, no hidden fees
- ✅ **Open Source** - Transparent and community-driven
- ✅ **22 Themes** - Light, Dark, and 20 Fable-inspired schemes with manual override
- ✅ **Obfuscation & Encryption** - ROT13-to-Base64 play plus password-based AES/ChaCha20/Rabbit/Speck/XTEA/XXTEA/Trivium/RC4 (security untested — use at own risk)
- ✅ **Page Setup** - Letter/Legal/Tabloid/A4/A5 with per-side inch margins for PDF and DOCX

## 🛠️ Quick Start Guide

1. **Open the editor** - Visit [marky-md.web.app](https://marky-md.web.app/)
2. **Start typing** - Your content appears formatted in real-time
3. **Select text** - Use the formatting toolbar for quick styling
4. **Save your work** - Click "Download MD" or use Ctrl+S to export

That's it! No tutorials needed.

## 🌟 Why Markey-Mod?

Unlike other markdown editors:
- **Editable HTML exports** - Share documents that recipients can modify and return
- No complicated split-pane views - just pure WYSIWYG
- No account creation or login required
- Completely self-contained - one HTML file does it all
- Lightning fast - no server roundtrips
- Your markdown data never leaves your device

## 💡 Pro Tips

- Select any text to see the formatting toolbar appear above it
- Use the "Paste MD" button to quickly load markdown from anywhere
- Your work auto-saves to localStorage - but download important files as a backup
- Click "Clear" to start fresh with a new document
- Pick a theme from the dropdown — it persists and travels inside exported HTML files
- Select text, then **Obfuscate** for ciphers or **Encrypt** (with a password) for real encryption; decrypt `MK2$...` envelopes with the same password
- Click **Page** to set paper size and margins before exporting PDF/DOCX
- **Collaborative HTML Workflow**: Export as HTML and share with colleagues. They can open it in any browser, edit the content directly, save their changes, and send the modified HTML back to you. You can then extract their changes as markdown!

## 🤝 For Developers

Built with vanilla JavaScript and modern web standards. Check out the [GitHub repository](https://github.com/jottavia/marky-mod) to:
- Report bugs or issues
- Suggest new features
- Contribute code improvements
- Fork and customize for your needs

## 📄 License

Free and open source under the MIT License.

---

**Ready to write?** [Launch Marky Editor Now →](https://marky-md.web.app/)
