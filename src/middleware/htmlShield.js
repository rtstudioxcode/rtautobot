// src/middleware/htmlShield.js
// HTML Shield: minify rendered EJS output and optionally send full HTML pages as
// an encoded UTF-8 payload. This protects View Source / Network Response from
// exposing EJS-rendered layout, inline CSS and inline JS. DevTools Elements can
// still show the live DOM after rendering because browsers must build a DOM.

const DEFAULT_OPTIONS = {
  enabled: true,
  removeComments: true,
  collapseWhitespace: true,
  removeInterTagWhitespace: true,
  stripEjsPathComments: true,
  encodeFullPage: false,
  scrubInlineSources: true,
};

function protectBlocks(html) {
  const blocks = [];
  const tokenPrefix = "___HTML_SHIELD_BLOCK_";
  const protectedHtml = String(html).replace(
    /<(script|style|pre|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi,
    (block) => {
      const token = `${tokenPrefix}${blocks.length}___`;
      blocks.push(block);
      return token;
    }
  );
  return {
    html: protectedHtml,
    restore(value) {
      let out = value;
      blocks.forEach((block, i) => {
        out = out.replace(`${tokenPrefix}${i}___`, block);
      });
      return out;
    },
  };
}

function minifyHtml(rawHtml, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!opts.enabled || typeof rawHtml !== "string") return rawHtml;

  const { html: protectedHtml, restore } = protectBlocks(rawHtml);
  let html = protectedHtml;

  if (opts.stripEjsPathComments) {
    html = html.replace(/<!--\s*\/?src\/views\/[\s\S]*?-->/gi, "");
  }

  if (opts.removeComments) {
    html = html.replace(/<!--(?!\[if|<!|>)[\s\S]*?-->/g, "");
  }

  if (opts.collapseWhitespace) {
    html = html.replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ");
  }

  if (opts.removeInterTagWhitespace) {
    html = html.replace(/>\s+</g, "><").replace(/\s+>/g, ">").trim();
  }

  return restore(html);
}

function isFullHtmlDocument(html) {
  const value = String(html || "").trim().slice(0, 300).toLowerCase();
  return value.startsWith("<!doctype html") || value.startsWith("<html") || value.includes("<html");
}

function shouldEncodeRequest(req) {
  // Do not wrap AJAX/fetch/partial responses because many pages insert partial HTML directly.
  const accept = String(req.headers.accept || "");
  const xrw = String(req.headers["x-requested-with"] || "").toLowerCase();
  const secFetchDest = String(req.headers["sec-fetch-dest"] || "").toLowerCase();

  if (xrw === "xmlhttprequest") return false;
  if (accept.includes("application/json")) return false;
  if (secFetchDest && secFetchDest !== "document" && secFetchDest !== "empty") return false;

  return true;
}


function isClassicInlineScript(attrs = "") {
  const value = String(attrs || "");
  if (/\bsrc\s*=/i.test(value)) return false;
  const typeMatch = value.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  if (!typeMatch) return true;
  const type = String(typeMatch[1] || typeMatch[2] || typeMatch[3] || "").trim().toLowerCase();
  if (!type) return true;
  return type === "text/javascript" || type === "application/javascript" || type === "application/ecmascript" || type === "text/ecmascript";
}

function collectLexicalDeclarationNames(code = "") {
  const js = String(code || "");
  const names = [];
  const simpleDecl = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*(?:=|,|;)/g;
  const classDecl = /(^|[;\n\r])\s*class\s+([A-Za-z_$][\w$]*)\b/g;
  let m;
  while ((m = simpleDecl.exec(js))) names.push(m[1]);
  while ((m = classDecl.exec(js))) names.push(m[2]);
  return names;
}

function softenInlineScriptLexicalDeclarations(code = "", duplicateNames = new Set()) {
  // document.write() replays all classic inline scripts into one page parse flow.
  // Some EJS pages + layout both declare helpers such as `const $ = ...`.
  // In that replay mode Chromium can throw: Identifier '$' has already been declared.
  // For encoded pages only, convert only duplicate classic inline const/let/class
  // names to var-bound forms. This is safer than rewriting every const/let.
  let js = String(code || "");

  js = js.replace(/\b(const|let)\s+([A-Za-z_$][\w$]*)\s*(?==|,|;)/g, (full, kind, name) => {
    return duplicateNames.has(name) ? `var ${name}` : full;
  });

  js = js.replace(/(^|[;\n\r])(\s*)class\s+([A-Za-z_$][\w$]*)\b/g, (full, prefix, space, name) => {
    return duplicateNames.has(name) ? `${prefix}${space}var ${name} = class ${name}` : full;
  });

  return js;
}

function prepareInlineScriptsForEncodedDocument(html) {
  const source = String(html || "");
  const scripts = [];
  source.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (full, attrs, code) => {
    if (isClassicInlineScript(attrs) && !/data-html-shield-runtime\s*=/.test(attrs)) {
      scripts.push({ attrs, code });
    }
    return full;
  });

  const counts = new Map();
  for (const s of scripts) {
    for (const name of collectLexicalDeclarationNames(s.code)) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  const duplicateNames = new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));

  return source.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, code) => {
      if (!isClassicInlineScript(attrs)) return full;
      if (/data-html-shield-runtime\s*=/.test(attrs)) return full;
      return `<script${attrs}>${softenInlineScriptLexicalDeclarations(code, duplicateNames)}<\/script>`;
    }
  );
}

function makeScrubberScript() {
  // Runs after the decoded page has executed. It removes inline <script> tags from
  // Elements and moves inline <style> into adoptedStyleSheets when supported, so the
  // CSS keeps working while the raw style tag is removed in modern Chromium.
  return `\n<script data-html-shield-runtime="1">(function(){function r(){try{document.querySelectorAll('script:not([src])').forEach(function(s){if(s.dataset&&s.dataset.htmlShieldRuntime==='1')return;s.remove();});}catch(e){}}function y(){try{if(!('adoptedStyleSheets'in Document.prototype)||typeof CSSStyleSheet==='undefined')return;var a=Array.prototype.slice.call(document.adoptedStyleSheets||[]);document.querySelectorAll('style').forEach(function(st){var css=st.textContent||'';if(!css.trim())return;try{var sh=new CSSStyleSheet();sh.replaceSync(css);a.push(sh);st.remove();}catch(e){}});document.adoptedStyleSheets=a;}catch(e){}}function run(){y();setTimeout(r,120);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();})();<\/script>`;
}

function encodeFullHtmlDocument(html, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const htmlForDocumentWrite = prepareInlineScriptsForEncodedDocument(html);
  const source = opts.scrubInlineSources
    ? String(htmlForDocumentWrite).replace(/<\/body\s*>/i, `${makeScrubberScript()}</body>`)
    : String(htmlForDocumentWrite);
  const payload = Buffer.from(source, "utf8").toString("base64");

  // No const/let in wrapper to avoid redeclare issues from document.write pages.
  // The decoded page is written once, then the wrapper context disappears.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>(function(){var p="${payload}";var b=Uint8Array.from(atob(p),function(c){return c.charCodeAt(0)});var h=new TextDecoder("utf-8").decode(b);document.open();document.write(h);document.close();})();<\/script></head><body></body></html>`;
}

function shieldHtml(rawHtml, req, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!opts.enabled || typeof rawHtml !== "string") return rawHtml;

  const minified = minifyHtml(rawHtml, opts);

  if (opts.encodeFullPage && isFullHtmlDocument(minified) && shouldEncodeRequest(req)) {
    return encodeFullHtmlDocument(minified, opts);
  }

  return minified;
}

export function htmlShield(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return (req, res, next) => {
    const originalRender = res.render.bind(res);
    const originalSend = res.send.bind(res);

    res.render = (view, locals, callback) => {
      if (typeof locals === "function") {
        callback = locals;
        locals = undefined;
      }

      const renderCallback = (err, html) => {
        if (err) {
          if (callback) return callback(err);
          return next(err);
        }

        const out = shieldHtml(html, req, opts);
        if (callback) return callback(null, out);
        return originalSend(out);
      };

      return originalRender(view, locals, renderCallback);
    };

    next();
  };
}

export { minifyHtml, shieldHtml, encodeFullHtmlDocument };
