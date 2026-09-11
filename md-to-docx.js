#!/usr/bin/env node

/**
 * Markdown to DOCX Converter
 *
 * Converts Markdown files to DOCX format using:
 * - markdown-it (same package used in index.html for displaying MD as HTML)
 * - html-to-docx for DOCX generation
 *
 * Usage:
 *   node md-to-docx.js <input.md> [output.docx]
 *
 * If output filename is not provided, it will use the input filename with .docx extension
 */

import fs from "fs";
import path from "path";
import MarkdownIt from "markdown-it";
import HTMLtoDOCX from "html-to-docx";
import { blockedImageFormat, classifyDataUrl, extToMime } from "./image-guard.js";

// Initialize markdown-it with default options (same as index.html)
const md = new MarkdownIt();

/**
 * Generate a complete HTML document with proper styling for DOCX conversion
 * @param {string} htmlContent - The HTML content from markdown-it
 * @param {string} title - Document title
 * @returns {string} Complete HTML document
 */
function generateStyledHTML(htmlContent, title) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #333;
    }
    h1 {
      font-size: 24pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
      color: #2c3e50;
    }
    h2 {
      font-size: 18pt;
      font-weight: bold;
      margin-top: 18pt;
      margin-bottom: 10pt;
      color: #34495e;
    }
    h3 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 14pt;
      margin-bottom: 8pt;
    }
    h4 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 6pt;
    }
    p {
      margin-top: 0;
      margin-bottom: 10pt;
      text-align: justify;
    }
    ul, ol {
      margin-top: 0;
      margin-bottom: 10pt;
      padding-left: 20pt;
    }
    li {
      margin-bottom: 4pt;
    }
    blockquote {
      margin: 10pt 0;
      padding-left: 15pt;
      border-left: 3px solid #3498db;
      color: #666;
      font-style: italic;
    }
    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background-color: #f4f4f4;
      padding: 2pt 4pt;
    }
    pre {
      font-family: 'Courier New', Courier, monospace;
      font-size: 10pt;
      background-color: #f4f4f4;
      padding: 10pt;
      margin: 10pt 0;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    pre code {
      padding: 0;
      background: none;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8pt;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 20pt 0;
    }
    a {
      color: #3498db;
      text-decoration: underline;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    strong {
      font-weight: bold;
    }
    em {
      font-style: italic;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * Extract title from markdown content (first H1 heading)
 * @param {string} markdown - The markdown content
 * @returns {string} The title or default
 */
/**
 * Fetch only the leading bytes of a remote image (enough for magic-byte
 * classification), with a timeout. Returns null when unavailable.
 */
async function fetchFirstBytes(url, n = 64, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    return value ? value.slice(0, n) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read only the leading bytes of a local file. Returns null when unreadable.
 */
function readFirstBytes(filePath, n = 64) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(n);
    const read = fs.readSync(fd, buf, 0, n, 0);
    fs.closeSync(fd);
    return read > 0 ? buf.slice(0, read) : null;
  } catch {
    return null;
  }
}

/**
 * Pre-screen <img> sources for formats whose parsers loop forever in the
 * bundled image-size (ICNS, JPEG-XL, HEIF family — see image-guard.js).
 * Blocked images are replaced with a text placeholder so html-to-docx
 * never receives those bytes. Safe local files are embedded as data:
 * URLs because html-to-docx crashes on filesystem paths and file://
 * URLs (pre-existing limitation); missing files become placeholders
 * instead of crashing the conversion. Anything uninspectable passes
 * through with a warning (fail-open for availability, same as before).
 */
async function sanitizeImages(htmlContent, baseDir) {
  const warnings = [];
  const imgRe = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gis;
  const matches = [...htmlContent.matchAll(imgRe)];
  if (matches.length === 0) return { html: htmlContent, warnings };

  const replacements = [];
  for (const m of matches) {
    const src = m[2];
    const tag = m[0];
    const setSrc = (newSrc) => {
      const attr = /src\s*=\s*(['"])/i.exec(tag);
      const start = attr.index + attr[0].length;
      return tag.slice(0, start) + newSrc + tag.slice(start + src.length);
    };
    const dropTag = (text) => ({ drop: true, text });
    const keepTag = () => ({ drop: false });

    if (/^data:/i.test(src)) {
      const r = classifyDataUrl(src);
      if (r.format) {
        warnings.push(`Image omitted (${r.format.toUpperCase()} not supported)`);
        replacements.push({ match: m, ...dropTag(
          `[Image omitted: ${r.format.toUpperCase()} images are not supported for DOCX conversion]`) });
      } else {
        if (r.undecodable) warnings.push(`Image could not be inspected, passing through: ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...keepTag() });
      }
    } else if (/^https?:\/\//i.test(src)) {
      const bytes = await fetchFirstBytes(src);
      if (bytes && bytes.length >= 4 && blockedImageFormat(bytes)) {
        const format = blockedImageFormat(bytes);
        warnings.push(`Image omitted (${format.toUpperCase()} not supported): ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...dropTag(
          `[Image omitted: ${format.toUpperCase()} images are not supported for DOCX conversion]`) });
      } else {
        if (!bytes) warnings.push(`Image could not be inspected, passing through: ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...keepTag() });
      }
    } else {
      // Local file (relative, absolute, or file://) or unknown scheme.
      // NOTE: Windows drive-letter paths (C:\...) resemble URL schemes,
      // so absolute-path detection runs before the scheme test.
      let filePath = null;
      const fileMatch = /^file:\/\//i.test(src)
        ? src.replace(/^file:\/\//i, "").replace(/^\/([A-Za-z]:\/)/, "$1")
        : src;
      const clean = fileMatch.split(/[?#]/)[0];
      if (/^file:\/\//i.test(src) || path.isAbsolute(clean)) {
        try {
          filePath = decodeURIComponent(clean);
        } catch {
          filePath = clean;
        }
      } else if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
        warnings.push(`Image omitted (unsupported URL scheme): ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...dropTag("[Image omitted: unsupported URL scheme]") });
        continue;
      } else {
        try {
          filePath = path.join(baseDir, decodeURIComponent(clean));
        } catch {
          filePath = null;
        }
      }
      const bytes = filePath ? readFirstBytes(filePath, 65536) : null;
      if (!bytes) {
        warnings.push(`Image file not found, omitting: ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...dropTag(`[Image missing: ${src.slice(0, 80)}]`) });
        continue;
      }
      const format = bytes.length >= 4 ? blockedImageFormat(bytes) : null;
      if (format) {
        warnings.push(`Image omitted (${format.toUpperCase()} not supported): ${src.slice(0, 80)}`);
        replacements.push({ match: m, ...dropTag(
          `[Image omitted: ${format.toUpperCase()} images are not supported for DOCX conversion]`) });
        continue;
      }
      const mime = extToMime(clean) || "application/octet-stream";
      const full = fs.readFileSync(filePath);
      replacements.push({
        match: m,
        drop: false,
        tag: setSrc(`data:${mime};base64,${full.toString("base64")}`),
      });
    }
  }

  let html = htmlContent;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const { match: m, drop, text, tag } = replacements[i];
    const replacement = drop ? text : tag || m[0];
    html = html.slice(0, m.index) + replacement + html.slice(m.index + m[0].length);
  }
  return { html, warnings };
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Document";
}

/**
 * Convert a Markdown file to DOCX
 * @param {string} inputPath - Path to the input markdown file
 * @param {string} outputPath - Path to the output DOCX file
 */
async function convertMdToDocx(inputPath, outputPath) {
  try {
    // Validate input file exists
    if (!fs.existsSync(inputPath)) {
      console.error(`Error: Input file not found: ${inputPath}`);
      process.exit(1);
    }

    console.log(`Reading markdown file: ${inputPath}`);

    // Read the markdown file
    const markdown = fs.readFileSync(inputPath, "utf-8");

    // Extract title from markdown
    const title = extractTitle(markdown);
    console.log(`Document title: ${title}`);

    // Convert markdown to HTML using markdown-it (same as index.html)
    console.log("Converting markdown to HTML...");
    const rawHtml = md.render(markdown);

    // Pre-screen images for formats with known-infinite-loop parsers
    // before html-to-docx (bundled image-size) ever sees them.
    const { html: htmlContent, warnings } = await sanitizeImages(
      rawHtml,
      path.dirname(inputPath),
    );
    for (const w of warnings) console.log(`[guard] ${w}`);

    // Generate complete styled HTML document
    const fullHtml = generateStyledHTML(htmlContent, title);

    // Convert HTML to DOCX
    console.log("Converting HTML to DOCX...");
    const docxBuffer = await HTMLtoDOCX(fullHtml, null, {
      title: title,
      subject: "Converted from Markdown",
      creator: "Marky MD to DOCX Converter",
      keywords: ["markdown", "document"],
      description: `Document converted from ${path.basename(inputPath)}`,
      orientation: "portrait",
      margins: {
        top: 1440, // 1 inch in TWIP
        right: 1440,
        bottom: 1440,
        left: 1440,
        header: 720, // 0.5 inch in TWIP
        footer: 720, // 0.5 inch in TWIP
        gutter: 0,
      },
      font: "Times New Roman",
      fontSize: 24, // 12pt in HIP (Half of point)
      table: {
        row: {
          cantSplit: true,
        },
      },
    });

    // Write the DOCX file
    fs.writeFileSync(outputPath, docxBuffer);

    console.log(`✓ Successfully created: ${outputPath}`);
    console.log(`  File size: ${(docxBuffer.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("Error converting file:", error.message);
    process.exit(1);
  }
}

/**
 * Main function - parse arguments and run conversion
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
Marky - Markdown to DOCX Converter

Usage:
  node md-to-docx.js <input.md> [output.docx]

Arguments:
  input.md     Path to the input Markdown file
  output.docx  Path to the output DOCX file (optional)
               If not provided, uses input filename with .docx extension

Examples:
  node md-to-docx.js document.md
  node md-to-docx.js document.md output.docx
  node md-to-docx.js ./docs/readme.md ./exports/readme.docx
`);
    process.exit(0);
  }

  const inputPath = path.resolve(args[0]);

  // Generate output path if not provided
  let outputPath;
  if (args[1]) {
    outputPath = path.resolve(args[1]);
  } else {
    const inputDir = path.dirname(inputPath);
    const inputName = path.basename(inputPath, path.extname(inputPath));
    outputPath = path.join(inputDir, `${inputName}.docx`);
  }

  await convertMdToDocx(inputPath, outputPath);
}

// Run the main function
main();
