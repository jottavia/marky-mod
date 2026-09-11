const defaultContent = `<h1>👋 Welcome to Markey-Mod</h1>
<p>A simple markdown editor that runs in your browser. Start typing and see your formatted text in real-time!</p>
<h2>✨ Quick Start</h2>
<ul>
<li><strong>Select text</strong> to see formatting options appear above</li>
<li><strong>Paste MD</strong> - Load markdown from your clipboard</li>
<li><strong>Upload MD</strong> - Import existing markdown files</li>
<li><strong>Download MD</strong> - Save your work (or press <strong>Ctrl+S</strong>)</li>
<li><strong>Copy MD</strong> - Copy to clipboard instantly</li>
<li><strong>Export HTML</strong> - Generate editable HTML files that anyone can modify and return to you!</li>
<li><strong>PDF / DOCX</strong> - Export print-ready documents with your page setup</li>
</ul>
<h2>🎨 Themes</h2>
<p>Markey-Mod ships with 22 themes: Light, Dark, and 20 Fable-inspired color schemes. Open the theme dropdown in the toolbar to switch — your choice is saved and even travels inside exported HTML files.</p>
<h2>🔒 Obfuscate</h2>
<p>Click <strong>Obfuscate</strong> for playful text transforms: ROT13, ROT47, Caesar, Atbash, Reverse, Base64, Hex, Binary, URL encoding, and Leet speak. Applies to your selection, or the whole document. Obfuscation only — not secure encryption.</p>
<h2>🔐 Real encryption</h2>
<p>The same panel offers password-based encryption: AES-256-GCM, AES-256-CBC, ChaCha20, Rabbit, Speck, XTEA, XXTEA, Trivium, and RC4. Results are packed as <code>MK2$...</code> envelopes you can decrypt with the same password.</p>
<p><strong>Warning:</strong> this implementation is <strong>security untested — use at own risk</strong>. Only AES-GCM detects wrong passwords; the rest return garbage instead of failing.</p>
<h2>📄 Page setup</h2>
<p>Click <strong>Page</strong> to choose paper size (Letter, Legal, Tabloid, A4, A5 — Letter 8.5 × 11 in by default) and per-side margins in inches (1 inch by default). PDF and DOCX exports honor these settings.</p>
<h2>Latex and Mermaid Support - including docx export!</h2>
<p>Markey-Mod supports rendering LaTeX math and Mermaid diagrams. You can include LaTeX using <code>$$...$$</code> for block math or <code>$...$</code> for inline math. Mermaid diagrams can be included using fenced code blocks with <code>mermaid</code> as the language.</p>
<p>When exporting to docx, Markey-Mod will convert LaTeX and Mermaid diagrams into images, ensuring that your formatted content is preserved across platforms.</p>
<p>Sample Mermaid diagram:</p>
<pre><code class="language-mermaid">graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;</code></pre>
<p>Sample LaTeX math:</p>
$$\\mathbb{N} = \\{ a \\in \\mathbb{Z} : a > 0 \\}$$
<h2>⌨️ Keyboard Shortcuts</h2>
<ul>
<li><strong>Ctrl+S</strong> (Cmd+S on Mac) - Download markdown</li>
<li><strong>Ctrl+O</strong> (Cmd+O on Mac) - Upload file</li>
<li><strong>Ctrl+Z</strong> (Cmd+Z on Mac) - Undo</li>
<li><strong>Ctrl+Y</strong> or <strong>Ctrl+Shift+Z</strong> (Cmd+Shift+Z on Mac) - Redo</li>
</ul>
<h2>🔄 Collaborative Workflow</h2>
<p>Export as HTML or DOCX to share editable documents. Recipients can open the files in any browser or Word, make their edits, and send them back to you. No markdown knowledge required! All editing happens locally - no data sent to servers.</p>
<p><strong>Ready to write?</strong> Click "Clear" to start with a blank document, or just start typing!</p>
`;
