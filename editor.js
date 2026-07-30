/* ============================================================
   موتور توکنایزر (دقیقاً همون منطقی که جدا تست شد)
   ============================================================ */
function tokenize(code, rules) {
  var tokens = [];
  var i = 0;
  var n = code.length;

  while (i < n) {
    var matched = false;

    for (var r = 0; r < rules.length; r++) {
      var re = rules[r].regex;
      re.lastIndex = i;
      var m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        tokens.push({ type: rules[r].type, text: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      var ch = code.charAt(i);
      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'text') {
        tokens[tokens.length - 1].text += ch;
      } else {
        tokens.push({ type: 'text', text: ch });
      }
      i += 1;
    }
  }

  return tokens;
}

var JS_KEYWORDS = 'var|let|const|function|return|if|else|for|while|do|break|continue|switch|case|default|try|catch|finally|throw|new|delete|typeof|instanceof|in|of|class|extends|super|this|null|undefined|true|false|async|await|yield|import|export|from|as|static|get|set';
var PY_KEYWORDS = 'def|return|if|elif|else|for|while|break|continue|pass|import|from|as|class|try|except|finally|raise|with|lambda|yield|global|nonlocal|del|assert|True|False|None|and|or|not|in|is|async|await';
var PHP_KEYWORDS = 'abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|true|false|null|self|parent';

var VOID_ELEMENTS = {
  area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1,
  input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
};

var RULES = {
  html: [
    { type: 'comment', regex: /<!--[\s\S]*?-->/y },
    { type: 'tag', regex: /<\/?[a-zA-Z][a-zA-Z0-9-]*/y },
    { type: 'punctuation', regex: /\/?>/y },
    { type: 'attr', regex: /\b[a-zA-Z-][a-zA-Z0-9-]*(?=\s*=)/y },
    { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'punctuation', regex: /=/y }
  ],
  css: [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\//y },
    { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'atrule', regex: /@[a-zA-Z-]+/y },
    { type: 'hexcolor', regex: /#[0-9a-fA-F]{3,8}\b/y },
    { type: 'selector', regex: /[.#][a-zA-Z_-][a-zA-Z0-9_-]*/y },
    { type: 'property', regex: /\b[a-zA-Z-]+(?=\s*:)/y },
    { type: 'number', regex: /-?\b\d+\.?\d*(?:px|em|rem|%|vh|vw|vmin|vmax|s|ms|deg|fr)?\b/y },
    { type: 'punctuation', regex: /[{}()\[\];:,>+~]/y }
  ],
  js: [
    { type: 'comment', regex: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    { type: 'string', regex: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'number', regex: /\b(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/y },
    { type: 'keyword', regex: new RegExp('\\b(?:' + JS_KEYWORDS + ')\\b', 'y') },
    { type: 'punctuation', regex: /[(){}\[\];,.]/y },
    { type: 'operator', regex: /[+\-*/%=<>!&|^~?:]+/y }
  ],
  python: [
    { type: 'comment', regex: /#[^\n]*/y },
    { type: 'string', regex: /'''[\s\S]*?'''|"""[\s\S]*?"""|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'number', regex: /\b\d+\.?\d*\b/y },
    { type: 'keyword', regex: new RegExp('\\b(?:' + PY_KEYWORDS + ')\\b', 'y') },
    { type: 'punctuation', regex: /[(){}\[\]:,.]/y },
    { type: 'operator', regex: /[+\-*/%=<>!&|^~]+/y }
  ],
  php: [
    { type: 'comment', regex: /\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*/y },
    { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'variable', regex: /\$[a-zA-Z_][a-zA-Z0-9_]*/y },
    { type: 'number', regex: /\b(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)\b/y },
    { type: 'keyword', regex: new RegExp('\\b(?:' + PHP_KEYWORDS + ')\\b', 'iy') },
    { type: 'punctuation', regex: /[(){}\[\];,.]/y },
    { type: 'operator', regex: /[+\-*/%=<>!&|^~?:.]+/y }
  ],
  yaml: [
    { type: 'comment', regex: /#[^\n]*/y },
    { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/y },
    { type: 'anchor', regex: /[&*][a-zA-Z_][a-zA-Z0-9_-]*/y },
    { type: 'punctuation', regex: /---|\.\.\./y },
    { type: 'number', regex: /-?\b\d+\.?\d*\b/y },
    { type: 'keyword', regex: /\b(?:true|false|null|yes|no|on|off|True|False|Null|Yes|No|On|Off|TRUE|FALSE|NULL|YES|NO|ON|OFF)\b/y },
    { type: 'key', regex: /[a-zA-Z_][a-zA-Z0-9_-]*(?=\s*:(\s|$))/y },
    { type: 'punctuation', regex: /[:\[\]{},\-]/y }
  ]
};

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTokens(tokens) {
  var html = '';
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    var escaped = escapeHtml(t.text);
    html += (t.type === 'text') ? escaped : ('<span class="tok-' + t.type + '">' + escaped + '</span>');
  }
  return html;
}

function highlight(code, lang) {
  if (lang === 'php') return renderTokens(tokenizePhp(code));
  var rules = RULES[lang];
  if (!rules) return escapeHtml(code);
  return renderTokens(tokenize(code, rules));
}

/* ============================================================
   PHP دو حالته: بیرون از <?php ?> یعنی HTML، داخلش یعنی PHP
   ============================================================ */
function matchPhpOpenTagAt(code, idx) {
  if (code.slice(idx, idx + 5).toLowerCase() === '<?php') return code.slice(idx, idx + 5);
  if (code.slice(idx, idx + 3) === '<?=') return '<?=';
  return null;
}

function findNextPhpOpenTag(code, from) {
  var phpIdx = code.toLowerCase().indexOf('<?php', from);
  var echoIdx = code.indexOf('<?=', from);
  if (phpIdx === -1 && echoIdx === -1) return -1;
  if (phpIdx === -1) return echoIdx;
  if (echoIdx === -1) return phpIdx;
  return Math.min(phpIdx, echoIdx);
}

function tokenizePhpStateful(code, startInPhp) {
  var tokens = [];
  var i = 0;
  var n = code.length;
  var inPhp = !!startInPhp;

  while (i < n) {
    if (!inPhp) {
      var openIdx = findNextPhpOpenTag(code, i);
      if (openIdx === -1) {
        tokens = tokens.concat(tokenize(code.slice(i), RULES.html));
        i = n;
      } else {
        if (openIdx > i) tokens = tokens.concat(tokenize(code.slice(i, openIdx), RULES.html));
        var openTagText = matchPhpOpenTagAt(code, openIdx);
        tokens.push({ type: 'phptag', text: openTagText });
        i = openIdx + openTagText.length;
        inPhp = true;
      }
    } else {
      var closeIdx = code.indexOf('?>', i);
      if (closeIdx === -1) {
        tokens = tokens.concat(tokenize(code.slice(i), RULES.php));
        i = n;
      } else {
        if (closeIdx > i) tokens = tokens.concat(tokenize(code.slice(i, closeIdx), RULES.php));
        tokens.push({ type: 'phptag', text: '?>' });
        i = closeIdx + 2;
        inPhp = false;
      }
    }
  }
  return { tokens: tokens, endInPhp: inPhp };
}

function tokenizePhp(code) {
  return tokenizePhpStateful(code, false).tokens;
}

/* استخراج فقط بخش‌های PHP (بدون خودِ تگ‌ها) — برای اعتبارسنجی در script.js */
function extractPhpCode(code) {
  var result = '';
  var i = 0, n = code.length, inPhp = false;
  while (i < n) {
    if (!inPhp) {
      var openIdx = findNextPhpOpenTag(code, i);
      if (openIdx === -1) { i = n; }
      else {
        var openTagText = matchPhpOpenTagAt(code, openIdx);
        i = openIdx + openTagText.length;
        inPhp = true;
      }
    } else {
      var closeIdx = code.indexOf('?>', i);
      if (closeIdx === -1) { result += code.slice(i); i = n; }
      else { result += code.slice(i, closeIdx); i = closeIdx + 2; inPhp = false; }
    }
  }
  return result;
}

/* ============================================================
   فرمت‌کننده (دقیقاً همون منطقی که جدا تست شد)
   ============================================================ */
function repeatStr(str, n) {
  var s = '';
  for (var i = 0; i < n; i++) s += str;
  return s;
}

function reformatBraces(code, lang) {
  var lines = code.split('\n');
  var depth = 0;
  var out = [];

  for (var li = 0; li < lines.length; li++) {
    var trimmed = lines[li].replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (trimmed === '') { out.push(''); continue; }

    var startsWithCloser = /^[}\)\]]/.test(trimmed);
    var thisDepth = startsWithCloser ? Math.max(0, depth - 1) : depth;
    out.push(repeatStr('  ', thisDepth) + trimmed);

    var tokens = tokenize(trimmed, RULES[lang]);
    var net = 0;
    for (var ti = 0; ti < tokens.length; ti++) {
      var t = tokens[ti];
      if (t.type === 'punctuation') {
        if (t.text === '{' || t.text === '(' || t.text === '[') net++;
        else if (t.text === '}' || t.text === ')' || t.text === ']') net--;
      }
    }
    depth = Math.max(0, depth + net);
  }

  return out.join('\n');
}

function reformatHtml(code) {
  var lines = code.split('\n');
  var depth = 0;
  var out = [];

  for (var li = 0; li < lines.length; li++) {
    var trimmed = lines[li].replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (trimmed === '') { out.push(''); continue; }

    var tokens = tokenize(trimmed, RULES.html);
    var startsWithCloser = tokens.length > 0 && tokens[0].type === 'tag' && tokens[0].text.charAt(1) === '/';
    var thisDepth = startsWithCloser ? Math.max(0, depth - 1) : depth;
    out.push(repeatStr('  ', thisDepth) + trimmed);

    var net = 0;
    for (var ti = 0; ti < tokens.length; ti++) {
      var t = tokens[ti];
      if (t.type !== 'tag') continue;
      var isClosing = t.text.charAt(1) === '/';
      if (isClosing) {
        net -= 1;
      } else {
        var tagName = t.text.slice(1).toLowerCase();
        var nextTok = tokens[ti + 1];
        var selfClosed = nextTok && nextTok.type === 'punctuation' && nextTok.text === '/>';
        var isVoid = VOID_ELEMENTS[tagName] === 1;
        if (!selfClosed && !isVoid) net += 1;
      }
    }
    depth = Math.max(0, depth + net);
  }

  return out.join('\n');
}

function reformatPhp(code) {
  var lines = code.split('\n');
  var depth = 0;
  var inPhp = false;
  var out = [];

  for (var li = 0; li < lines.length; li++) {
    var trimmed = lines[li].replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (trimmed === '') { out.push(''); continue; }

    var startsWithCloser = /^[}\)\]]/.test(trimmed);
    var thisDepth = startsWithCloser ? Math.max(0, depth - 1) : depth;
    out.push(repeatStr('  ', thisDepth) + trimmed);

    var result = tokenizePhpStateful(trimmed, inPhp);
    inPhp = result.endInPhp;

    var net = 0;
    for (var ti = 0; ti < result.tokens.length; ti++) {
      var t = result.tokens[ti];
      if (t.type === 'punctuation') {
        if (t.text === '{' || t.text === '(' || t.text === '[') net++;
        else if (t.text === '}' || t.text === ')' || t.text === ']') net--;
      }
    }
    depth = Math.max(0, depth + net);
  }

  return out.join('\n');
}

function reformat(code, lang) {
  if (lang === 'html') return reformatHtml(code);
  if (lang === 'css' || lang === 'js') return reformatBraces(code, lang);
  if (lang === 'php') return reformatPhp(code);
  /* yaml عمداً فرمت نمی‌شه: فاصله‌گذاری در YAML معنی‌داره و تغییر
     خودکارش می‌تونه ساختار درست کاربر رو بی‌سروصدا خراب کنه. */
  return code;
}

/* ============================================================
   حفظ موقعیت مکان‌نما هنگام بازسازی HTML رنگی
   ============================================================ */
function getCaretOffset(el) {
  var sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  var range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  var pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

function setCaretOffset(el, offset) {
  var sel = window.getSelection();
  var range = document.createRange();
  var currentOffset = 0;
  var found = false;

  function walk(node) {
    if (found) return;
    if (node.nodeType === 3) {
      var next = currentOffset + node.textContent.length;
      if (offset <= next) {
        range.setStart(node, Math.max(0, offset - currentOffset));
        range.collapse(true);
        found = true;
        return;
      }
      currentOffset = next;
    } else {
      var children = node.childNodes;
      for (var i = 0; i < children.length && !found; i++) {
        walk(children[i]);
      }
    }
  }

  walk(el);

  if (!found) {
    range.selectNodeContents(el);
    range.collapse(false);
  }

  sel.removeAllRanges();
  sel.addRange(range);
}

/* ============================================================
   اتصال یک ادیتور قابل‌ویرایش + گاتر شماره خط
   ============================================================ */
function attachEditor(editorEl, gutterEl, lang, initialCode) {
  editorEl.contentEditable = 'true';
  editorEl.spellcheck = false;
  editorEl.setAttribute('dir', 'ltr');

  var debounceTimer = null;
  var RENDER_DEBOUNCE_MS = 60;

  function updateGutter(code) {
    var lineCount = code.length === 0 ? 1 : code.split('\n').length;
    var nums = [];
    for (var i = 1; i <= lineCount; i++) nums.push(i);
    gutterEl.textContent = nums.join('\n');
  }

  function render(preserveCaret) {
    var code = editorEl.textContent;
    var caret = preserveCaret ? getCaretOffset(editorEl) : null;
    editorEl.innerHTML = highlight(code, lang);
    if (caret !== null) setCaretOffset(editorEl, caret);
    updateGutter(code);
  }

  /* رنگ‌آمیزی رو کمی عقب می‌ندازیم (نه هر keystroke بی‌درنگ)، با یک
     تأخیر ثابت و واضح — نه وابسته به فریم نمایش مرورگر. تا وقتی تایپ
     ادامه داره (فاصله‌ی بین دو حرف کمتر از این تأخیره)، اصلاً به DOM
     دست نمی‌زنیم و تایپ خام و مطمئنِ خودِ مرورگر بدون مزاحمت ادامه پیدا
     می‌کنه؛ فقط وقتی یک مکث واقعی (هرچند کوتاه) پیش بیاد، رنگ‌آمیزی و
     بازسازی مکان‌نما اجرا می‌شه. این تأخیر برای انسان کاملاً نامحسوسه.
     شماره‌خط‌ها همون لحظه (سبک، بدون دست‌زدن به ادیتور) به‌روز می‌شن. */
  function scheduleRender() {
    updateGutter(editorEl.textContent);
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      render(true);
    }, RENDER_DEBOUNCE_MS);
  }

  editorEl.addEventListener('input', scheduleRender);

  /* درج مستقیم متن در محل مکان‌نما با Range API — همیشه قابل‌اعتماده،
     چون به رفتار native مرورگر برای متنی با کاراکتر \n دستی وابسته
     نیست (که مشخص شد گاهی محل درجِ تایپ بعدی رو اشتباه تشخیص می‌ده). */
  function insertTextAtCaret(text) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    range.deleteContents();
    var textNode = document.createTextNode(text);
    range.insertNode(textNode);

    var next = textNode.nextSibling;
    if (next && next.nodeType === 3 && next.textContent === '') {
      next.parentNode.removeChild(next);
    }
    var prev = textNode.previousSibling;
    if (prev && prev.nodeType === 3 && prev.textContent === '') {
      prev.parentNode.removeChild(prev);
    }

    var newRange = document.createRange();
    newRange.setStart(textNode, textNode.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  /* به‌جای تکیه بر تایپ خودکار مرورگر (که چون این ادیتور از کاراکتر
     \n خام به‌جای <div>/<br> استفاده می‌کنه، گاهی محل درج حرف بعدی رو
     اشتباه تشخیص می‌داد)، با beforeinput همه‌ی نوع‌های درج متن —
     تایپ عادی، Enter، و هر ورودی دیگه‌ای — رو از یک مسیر واحد و
     همیشه-درست عبور می‌دیم. این یعنی رفتار تایپ عادی و Enter دقیقاً
     یکسان و قابل‌پیش‌بینیه، نه اینکه یکی native باشه و یکی دستی. */
  editorEl.addEventListener('beforeinput', function (e) {
    if (e.inputType === 'insertText' || e.inputType === 'insertCompositionText') {
      e.preventDefault();
      insertTextAtCaret(e.data || '');
      scheduleRender();
    } else if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      e.preventDefault();
      insertTextAtCaret('\n');
      scheduleRender();
    }
    /* سایر انواع (حذف با backspace/delete، paste، undo و...) به رفتار
       پیش‌فرض مرورگر سپرده می‌شن؛ رویداد input معمولی بعدشون شلیک
       می‌شه و scheduleRender از همون مسیر عادی صدا زده می‌شه. */
  });

  editorEl.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      insertTextAtCaret('  ');
      scheduleRender();
    }
  });

  editorEl.addEventListener('scroll', function () {
    gutterEl.scrollTop = editorEl.scrollTop;
  });

  editorEl.textContent = initialCode || '';
  render(false);

  return {
    getCode: function () { return editorEl.textContent; },
    setCode: function (code) {
      editorEl.textContent = code;
      render(false);
    },
    format: function () {
      var formatted = reformat(editorEl.textContent, lang);
      editorEl.textContent = formatted;
      render(false);
      return formatted;
    }
  };
}

/* ============================================================
   راه‌اندازی چهار ادیتور
   ============================================================ */
var DEFAULT_CODE = {
  html: '<h1>سلام دنیا!</h1>\n<p>این یک متن نمونه\u200cست.</p>\n<button onclick="sayHi()">کلیک کن</button>',
  css: 'body {\n  font-family: sans-serif;\n  background: #f4f4fb;\n  color: #22223b;\n  padding: 24px;\n  text-align: center;\n}\nh1 { color: #e8a33d; }\nbutton {\n  background: #e8a33d;\n  color: #1a1305;\n  border: none;\n  padding: 10px 20px;\n  border-radius: 6px;\n  cursor: pointer;\n  font-weight: bold;\n}',
  js: 'function sayHi() {\n  alert("سلام! این پیام از جاوااسکریپت اومد.");\n}\nconsole.log("صفحه لود شد");',
  python: 'print("سلام دنیا از پایتون!")\n\nfor i in range(5):\n    print("i =", i)',
  php: '<?php\n$players = ["علی" => 10, "سارا" => 8];\n\nforeach ($players as $name => $score) {\n    echo $name . ": " . $score . "\\n";\n}\n?>',
  yaml: 'player:\n  name: علی\n  score: 10\n  skills:\n    - php\n    - python\n    - javascript'
};

window.editors = {
  html: attachEditor(document.getElementById('editor-html'), document.getElementById('ln-html'), 'html', DEFAULT_CODE.html),
  css: attachEditor(document.getElementById('editor-css'), document.getElementById('ln-css'), 'css', DEFAULT_CODE.css),
  js: attachEditor(document.getElementById('editor-js'), document.getElementById('ln-js'), 'js', DEFAULT_CODE.js),
  python: attachEditor(document.getElementById('editor-python'), document.getElementById('ln-python'), 'python', DEFAULT_CODE.python),
  php: attachEditor(document.getElementById('editor-php'), document.getElementById('ln-php'), 'php', DEFAULT_CODE.php),
  yaml: attachEditor(document.getElementById('editor-yaml'), document.getElementById('ln-yaml'), 'yaml', DEFAULT_CODE.yaml)
};

/* توابع خام رو هم قابل‌دسترس می‌ذاریم تا در صورت نیاز از script.js هم استفاده بشن */
window.codeReformat = reformat;
window.extractPhpCode = extractPhpCode;
