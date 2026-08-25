/* ============================================================
   عناصر DOM
   ============================================================ */
var railTabs = document.querySelectorAll('.rail-tab');
var editorPanes = {
  html: document.getElementById('pane-html'),
  css: document.getElementById('pane-css'),
  js: document.getElementById('pane-js'),
  python: document.getElementById('pane-python'),
  upload: document.getElementById('pane-upload')
};
var dots = {
  html: document.getElementById('dot-html'),
  css: document.getElementById('dot-css'),
  js: document.getElementById('dot-js'),
  python: document.getElementById('dot-python'),
  upload: document.getElementById('dot-upload'),
  current: document.getElementById('dot-current'),
  status: document.getElementById('dot-status')
};
var statusLabel = document.getElementById('statusLabel');
var placeholder = document.getElementById('placeholder');
var previewFrame = document.getElementById('previewFrame');
var consoleBox = document.getElementById('consoleBox');
var errorList = document.getElementById('errorList');
var openWindowBtn = document.getElementById('openWindowBtn');
var runBtn = document.getElementById('runBtn');
var cancelBtn = document.getElementById('cancelBtn');
var formatBtn = document.getElementById('formatBtn');
var divider = document.getElementById('divider');

var WEB_LANGS = { html: 1, css: 1, js: 1, upload: 1 };

var currentLang = 'html';
var lastGoodWebDoc = null;
var webIsLive = false;
var liveWebTab = null;
var pythonIsPending = false;
var runToken = 0;

var DEFAULT_PLACEHOLDER_HTML = 'کد رو بنویس، بعد دکمه <strong>▶ اجرا</strong> رو بزن تا وضعیت مدار رو ببینی.';
var CANCELLED_PLACEHOLDER_HTML = 'اجرا لغو شد. کد جدید رو بنویس و دوباره <strong>▶ اجرا</strong> رو بزن.';

/* ============================================================
   حالت روشن/تیره
   ============================================================ */
var THEME_STORAGE_KEY = 'circuitPlaygroundTheme';
var themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
    theme = 'dark';
  }
  themeToggleBtns.forEach(function (b) {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (e) { /* ignore */ }
}

themeToggleBtns.forEach(function (btn) {
  btn.addEventListener('click', function () { applyTheme(btn.dataset.theme); });
});

(function () {
  var saved = null;
  try { saved = localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { /* ignore */ }
  applyTheme(saved === 'light' ? 'light' : 'dark');
})();

/* ============================================================
   کشوی کناری (باز/بسته شدن)
   ============================================================ */
var drawer = document.getElementById('drawer');
var drawerOverlay = document.getElementById('drawerOverlay');
var hamburgerBtn = document.getElementById('hamburgerBtn');
var drawerCloseBtn = document.getElementById('drawerCloseBtn');
var currentLangBtn = document.getElementById('currentLangBtn');
var currentLangText = document.getElementById('currentLangText');

var LANG_LABELS = { html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python', upload: 'آپلود' };

function openDrawer() {
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

hamburgerBtn.addEventListener('click', openDrawer);
currentLangBtn.addEventListener('click', openDrawer);
drawerCloseBtn.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeDrawer();
});

/* ============================================================
   تعویض تب‌ها
   ============================================================ */
railTabs.forEach(function (tab) {
  tab.addEventListener('click', function () {
    railTabs.forEach(function (t) { t.classList.remove('active'); });
    tab.classList.add('active');

    Object.values(editorPanes).forEach(function (p) { p.classList.remove('active'); });
    currentLang = tab.dataset.lang;
    editorPanes[currentLang].classList.add('active');

    currentLangText.textContent = LANG_LABELS[currentLang] || currentLang;
    formatBtn.disabled = (currentLang === 'upload');
    setDot('current', null);
    var currentTabDot = document.getElementById('dot-' + currentLang);
    if (currentTabDot && currentTabDot.classList.contains('live')) setDot('current', 'live');
    if (currentTabDot && currentTabDot.classList.contains('trip')) setDot('current', 'trip');

    syncOpenWindowBtn();
    updateCancelVisibility();
    closeDrawer();
  });
});

/* ============================================================
   اعتبارسنجی HTML: تعادل تگ‌های باز و بسته
   ============================================================ */
var VOID_ELEMENTS = {
  area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1,
  input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
};

function validateHTML(code) {
  var stripped = code.replace(/<!--[\s\S]*?-->/g, '');
  var tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>/g;
  var stack = [];
  var match;

  while ((match = tagRegex.exec(stripped)) !== null) {
    var raw = match[0];
    var tagName = match[1].toLowerCase();
    var selfClosingSlash = match[2];
    var isClosingTag = raw.charAt(1) === '/';

    if (isClosingTag) {
      if (stack.length === 0) {
        return {
          ok: false,
          message: 'تگ بسته «</' + tagName + '>» پیدا شد، ولی هیچ تگ بازی برای بستن وجود نداشت.'
        };
      }
      var top = stack[stack.length - 1];
      if (top !== tagName) {
        return {
          ok: false,
          message: 'تگ «<' + top + '>» هنوز باز بود؛ انتظار «</' + top + '>» می‌رفت ولی «</' + tagName + '>» پیدا شد.'
        };
      }
      stack.pop();
    } else {
      var isVoid = VOID_ELEMENTS[tagName] === 1 || selfClosingSlash === '/';
      if (!isVoid) {
        stack.push(tagName);
      }
    }
  }

  if (stack.length > 0) {
    var unclosed = stack[stack.length - 1];
    return {
      ok: false,
      message: 'تگ «<' + unclosed + '>» باز شده ولی تا آخر کد با «</' + unclosed + '>» بسته نشده.'
    };
  }

  return { ok: true };
}

/* ============================================================
   اعتبارسنجی CSS: تعادل { } ( ) [ ]
   ============================================================ */
function validateCSS(code) {
  var stripped = code.replace(/\/\*[\s\S]*?\*\//g, '');
  stripped = stripped.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");

  var pairs = { '{': '}', '(': ')', '[': ']' };
  var closers = { '}': '{', ')': '(', ']': '[' };
  var stack = [];

  for (var i = 0; i < stripped.length; i++) {
    var ch = stripped.charAt(i);
    if (pairs[ch]) {
      stack.push(ch);
    } else if (closers[ch]) {
      var top = stack.pop();
      if (top !== closers[ch]) {
        return {
          ok: false,
          message: 'کاراکتر «' + ch + '» بدون جفت باز متناظرش پیدا شد؛ احتمالاً یک «' + closers[ch] + '» جا افتاده یا این یکی اضافه‌ست.'
        };
      }
    }
  }

  if (stack.length > 0) {
    var unclosed = stack[stack.length - 1];
    return {
      ok: false,
      message: 'کاراکتر «' + unclosed + '» باز شده ولی تا آخر کد با «' + pairs[unclosed] + '» بسته نشده.'
    };
  }

  return { ok: true };
}

/* ============================================================
   اعتبارسنجی JavaScript: نحو (syntax) از طریق موتور خود مرورگر
   ============================================================ */
function validateJS(code) {
  if (!code.trim()) return { ok: true };
  try {
    new Function(code);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

/* ============================================================
   نمایش وضعیت‌های پنل خروجی
   ============================================================ */
function hideAllOutputViews() {
  placeholder.style.display = 'none';
  previewFrame.style.display = 'none';
  consoleBox.style.display = 'none';
  errorList.style.display = 'none';
}

function setDot(name, state) {
  var el = dots[name];
  if (!el) return;
  el.classList.remove('live', 'trip');
  if (state === 'live' || state === 'trip') el.classList.add(state);

  if (name === currentLang && dots.current) {
    dots.current.classList.remove('live', 'trip');
    if (state === 'live' || state === 'trip') dots.current.classList.add(state);
  }
}

function setStatusLabel(text, state) {
  statusLabel.childNodes[statusLabel.childNodes.length - 1].textContent = ' ' + text;
  setDot('status', state);
}

function syncOpenWindowBtn() {
  openWindowBtn.disabled = !(WEB_LANGS[currentLang] && lastGoodWebDoc);
}

function updateCancelVisibility() {
  var shouldShow = false;
  if (currentLang === 'python') shouldShow = pythonIsPending;
  else if (WEB_LANGS[currentLang]) shouldShow = webIsLive;
  cancelBtn.classList.toggle('visible', !!shouldShow);
}

function showPlaceholderView(html) {
  hideAllOutputViews();
  placeholder.innerHTML = html || DEFAULT_PLACEHOLDER_HTML;
  placeholder.style.display = 'flex';
  syncOpenWindowBtn();
}

function showPreviewView(docString) {
  hideAllOutputViews();
  previewFrame.style.display = 'block';
  previewFrame.srcdoc = docString;
  lastGoodWebDoc = docString;
  syncOpenWindowBtn();
}

function showConsoleView(text) {
  hideAllOutputViews();
  consoleBox.style.display = 'block';
  consoleBox.textContent = text;
  syncOpenWindowBtn();
}

function showErrorsView(problems) {
  hideAllOutputViews();
  errorList.style.display = 'flex';
  errorList.innerHTML = '';
  problems.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'error-card';

    var tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'این بخش خرابه: ' + p.section;
    card.appendChild(tag);

    var msg = document.createElement('p');
    msg.textContent = p.message;
    card.appendChild(msg);

    errorList.appendChild(card);
  });
  syncOpenWindowBtn();
}

/* ============================================================
   ساخت سند ترکیبی HTML+CSS+JS برای iframe
   ============================================================ */
function buildWebDocString(html, css, js) {
  var openTag = '<' + 'script>';
  var closeTag = '<' + '/script>';

  var parts = [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>',
    css,
    '</style></head><body>',
    html,
    openTag,
    'window.onerror = function (msg, url, line) {',
    '  parent.postMessage({ type: "runtime-error", msg: msg + " (خط " + line + ")" }, "*");',
    '  return true;',
    '};',
    'try {',
    js,
    '} catch (e) {',
    '  parent.postMessage({ type: "runtime-error", msg: e.message }, "*");',
    '}',
    closeTag,
    '</body></html>'
  ];

  return parts.join('\n');
}

window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'runtime-error' && webIsLive) {
    var section = liveWebTab === 'upload' ? 'کد آپلودی (هنگام اجرا)' : 'JavaScript (هنگام اجرا)';
    setDot(liveWebTab === 'upload' ? 'upload' : 'js', 'trip');
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    webIsLive = false;
    showErrorsView([{
      section: section,
      message: e.data.msg
    }]);
    updateCancelVisibility();
  }
});

/* ============================================================
   بازسازی iframe پیش‌نمایش از صفر
   ============================================================ */
function resetPreviewFrame() {
  var fresh = document.createElement('iframe');
  fresh.id = 'previewFrame';
  fresh.className = 'preview-frame';
  fresh.setAttribute('sandbox', 'allow-scripts allow-modals allow-forms');
  previewFrame.replaceWith(fresh);
  previewFrame = fresh;
}

/* ============================================================
   اجرای HTML/CSS/JS
   ============================================================ */
function runWeb() {
  resetPreviewFrame();

  var html = window.editors.html.getCode();
  var css = window.editors.css.getCode();
  var js = window.editors.js.getCode();

  var htmlResult = validateHTML(html);
  var cssResult = validateCSS(css);
  var jsResult = validateJS(js);

  setDot('html', htmlResult.ok ? 'live' : 'trip');
  setDot('css', cssResult.ok ? 'live' : 'trip');
  setDot('js', jsResult.ok ? 'live' : 'trip');

  var problems = [];
  if (!htmlResult.ok) problems.push({ section: 'HTML', message: htmlResult.message });
  if (!cssResult.ok) problems.push({ section: 'CSS', message: cssResult.message });
  if (!jsResult.ok) problems.push({ section: 'JavaScript', message: jsResult.message });

  if (problems.length > 0) {
    webIsLive = false;
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView(problems);
    updateCancelVisibility();
    return;
  }

  webIsLive = true;
  liveWebTab = 'js';
  setStatusLabel('مدار وصله — همه‌چی درست کار می‌کنه', 'live');
  showPreviewView(buildWebDocString(html, css, js));
  updateCancelVisibility();
}

function cancelWeb() {
  resetPreviewFrame();
  webIsLive = false;
  if (liveWebTab === 'upload') {
    setDot('upload', null);
  } else {
    setDot('html', null);
    setDot('css', null);
    setDot('js', null);
  }
  liveWebTab = null;
  setStatusLabel('لغو شد — آماده‌ی اجرای جدید', null);
  showPlaceholderView(CANCELLED_PLACEHOLDER_HTML);
  updateCancelVisibility();
}

openWindowBtn.addEventListener('click', function () {
  if (!lastGoodWebDoc) return;
  var w = window.open('', '_blank');
  w.document.open();
  w.document.write(lastGoodWebDoc);
  w.document.close();
});

/* ============================================================
   اجرای Python از طریق Pyodide (بارگذاری تنبل/lazy)
   ============================================================ */
var pyodideInstance = null;
var pyodideLoadPromise = null;

function ensurePyodideScriptTag() {
  return new Promise(function (resolve, reject) {
    if (window.loadPyodide) { resolve(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
    s.onload = function () { resolve(); };
    s.onerror = function () {
      reject(new Error('بارگذاری فایل پایتون از سرور ناموفق بود. اتصال اینترنتت رو چک کن.'));
    };
    document.head.appendChild(s);
  });
}

function ensurePyodide() {
  if (pyodideInstance) return Promise.resolve(pyodideInstance);
  if (pyodideLoadPromise) return pyodideLoadPromise;

  showConsoleView('در حال بارگذاری پایتون... چند ثانیه صبر کن.');

  pyodideLoadPromise = ensurePyodideScriptTag()
    .then(function () { return loadPyodide(); })
    .then(function (py) {
      pyodideInstance = py;
      return py;
    })
    .catch(function (err) {
      pyodideLoadPromise = null;
      throw err;
    });

  return pyodideLoadPromise;
}

function runPython() {
  var code = window.editors.python.getCode();
  var myToken = ++runToken;

  pythonIsPending = true;
  setStatusLabel('در حال اجرا...', null);
  updateCancelVisibility();

  ensurePyodide().then(function (py) {
    if (myToken !== runToken) return;

    var output = '';
    py.setStdout({ batched: function (s) { output += s + '\n'; } });
    py.setStderr({ batched: function (s) { output += s + '\n'; } });

    return py.runPythonAsync(code).then(function () {
      if (myToken !== runToken) return;
      pythonIsPending = false;
      setDot('python', 'live');
      setStatusLabel('مدار وصله — کد درست اجرا شد', 'live');
      showConsoleView(output || '(کد اجرا شد ولی هیچ چیزی چاپ نکرد)');
      updateCancelVisibility();
    }, function (err) {
      if (myToken !== runToken) return;
      pythonIsPending = false;
      setDot('python', 'trip');
      setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
      showErrorsView([{ section: 'Python', message: err.message }]);
      updateCancelVisibility();
    });
  }).catch(function (err) {
    if (myToken !== runToken) return;
    pythonIsPending = false;
    setDot('python', 'trip');
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView([{ section: 'Python', message: err.message }]);
    updateCancelVisibility();
  });
}

function cancelPython() {
  runToken++;
  pythonIsPending = false;
  setDot('python', null);
  setStatusLabel('لغو شد — آماده‌ی اجرای جدید', null);
  showPlaceholderView(CANCELLED_PLACEHOLDER_HTML);
  updateCancelVisibility();
}

/* ============================================================
   دکمه‌ی مرتب‌سازی
   HTML/CSS/JS: فرمت‌کننده‌ی محلی (بدون نیاز به اینترنت)
   Python: از طریق ast.unparse در همون Pyodide که برای اجرا لود می‌شه
   (توجه: این روش کامنت‌های پایتون رو حذف می‌کنه)
   ============================================================ */
function formatWebLang(lang) {
  window.editors[lang].format();
}

function formatPython() {
  var code = window.editors.python.getCode();
  setStatusLabel('در حال مرتب‌سازی...', null);

  ensurePyodide().then(function (py) {
    var formatted;
    try {
      py.globals.set('__format_input__', code);
      formatted = py.runPython('import ast\nast.unparse(ast.parse(__format_input__))');
    } catch (e) {
      setStatusLabel('مرتب‌سازی انجام نشد', 'trip');
      showErrorsView([{ section: 'Python (مرتب‌سازی)', message: 'کد پایتون معتبر نیست، پس نمی‌شه مرتبش کرد: ' + e.message }]);
      return;
    }
    window.editors.python.setCode(formatted);
    setStatusLabel('کد پایتون مرتب شد (کامنت‌ها در این فرآیند حذف می‌شن)', null);
  }).catch(function (err) {
    setStatusLabel('مرتب‌سازی انجام نشد', 'trip');
    showErrorsView([{ section: 'Python (مرتب‌سازی)', message: err.message }]);
  });
}

formatBtn.addEventListener('click', function () {
  if (currentLang === 'python') {
    formatPython();
  } else {
    formatWebLang(currentLang);
  }
});

/* ============================================================
   تب آپلود فایل: چندفایلی، بدون اعتبارسنجی، فقط اجرا
   ============================================================ */
var uploadZone = document.getElementById('uploadZone');
var uploadFilesInput = document.getElementById('uploadFilesInput');
var uploadFolderInput = document.getElementById('uploadFolderInput');
var pickFilesBtn = document.getElementById('pickFilesBtn');
var pickFolderBtn = document.getElementById('pickFolderBtn');
var uploadListHeader = document.getElementById('uploadListHeader');
var uploadHintText = document.getElementById('uploadHintText');
var uploadClearBtn = document.getElementById('uploadClearBtn');
var uploadFileListEl = document.getElementById('uploadFileList');

var UPLOAD_KIND_LABELS = { html: 'HTML', css: 'CSS', js: 'JS', image: 'IMG', media: 'MEDIA', json: 'JSON', other: 'FILE' };

var UPLOAD_ERROR_CATCHER_JS =
  'window.onerror = function (msg, url, line) {' +
  '  parent.postMessage({ type: "runtime-error", msg: msg + " (خط " + line + ")" }, "*");' +
  '  return true;' +
  '};' +
  'window.addEventListener("unhandledrejection", function (e) {' +
  '  var m = (e.reason && e.reason.message) ? e.reason.message : String(e.reason);' +
  '  parent.postMessage({ type: "runtime-error", msg: "یک Promise رد شد: " + m }, "*");' +
  '});';

var uploadedFiles = {};        // path -> { path, file, kind, _resolvedText یا _resolvedDataUrl بعد از خونده‌شدن }
var uploadOrder = [];          // ترتیب اولین‌بار آپلود شدن، برای نمایش
var uploadJsManualOrder = [];  // ترتیب اجرای فایل‌های js؛ اول با تشخیص خودکار وابستگی مرتب می‌شه، بعد قابل جابه‌جایی دستیه
var uploadJsReadGeneration = 0; // برای نادیده گرفتن نتیجه‌ی تشخیص وابستگیِ آپلودهای قدیمی‌تر

function uploadGuessKind(path) {
  var ext = (path.split('.').pop() || '').toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js' || ext === 'mjs') return 'js';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].indexOf(ext) !== -1) return 'image';
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm'].indexOf(ext) !== -1) return 'media';
  if (ext === 'json') return 'json';
  return 'other';
}

function uploadFileSizeLabel(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function uploadDirName(path) {
  var idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

function uploadResolvePath(baseDir, ref) {
  ref = ref.split('?')[0].split('#')[0];
  var segments = (baseDir ? baseDir.split('/') : []).concat(ref.split('/'));
  var stack = [];
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { stack.pop(); continue; }
    stack.push(seg);
  }
  return stack.join('/');
}

/* ---- تشخیص خودکار ترتیب فایل‌های js بر اساس وابستگی ----
   هیچ اجرای واقعی کدی انجام نمی‌شه؛ فقط با یک regex ساده اسم‌های
   تعریف‌شده (function/const/let/var) و اسم‌های استفاده‌شده تو هر فایل
   استخراج می‌شن، بعد یک مرتب‌سازی توپولوژیک ساده انجام می‌شه:
   اگه فایل B اسمی رو استفاده کنه که فایل A تعریفش کرده، A زودتر میاد.
   نتیجه فقط یک حدس اولیه‌ست؛ کاربر همیشه می‌تونه با ▲▼ دستی عوضش کنه. */
var JS_RESERVED_WORDS = {
  'var': 1, 'let': 1, 'const': 1, 'function': 1, 'return': 1, 'if': 1, 'else': 1,
  'for': 1, 'while': 1, 'do': 1, 'break': 1, 'continue': 1, 'switch': 1, 'case': 1,
  'default': 1, 'try': 1, 'catch': 1, 'finally': 1, 'throw': 1, 'new': 1, 'delete': 1,
  'typeof': 1, 'instanceof': 1, 'in': 1, 'of': 1, 'class': 1, 'extends': 1, 'super': 1,
  'this': 1, 'null': 1, 'undefined': 1, 'true': 1, 'false': 1, 'async': 1, 'await': 1,
  'yield': 1, 'import': 1, 'export': 1, 'from': 1, 'as': 1, 'static': 1, 'get': 1,
  'set': 1, 'window': 1, 'document': 1, 'console': 1, 'Math': 1, 'JSON': 1, 'Array': 1,
  'Object': 1, 'String': 1, 'Number': 1, 'Boolean': 1, 'Promise': 1, 'Date': 1,
  'Error': 1, 'Map': 1, 'Set': 1, 'Symbol': 1, 'parseInt': 1, 'parseFloat': 1,
  'isNaN': 1, 'setTimeout': 1, 'setInterval': 1, 'clearTimeout': 1, 'clearInterval': 1
};

function uploadStripJsNoise(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, ' ');
}

function uploadExtractJsNames(code) {
  var clean = uploadStripJsNoise(code);
  var defined = {};
  var defRe = /\bfunction\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|\b(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
  var m;
  while ((m = defRe.exec(clean)) !== null) {
    defined[m[1] || m[2]] = true;
  }

  var used = {};
  var idRe = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\b\s*(?=\()/g;
  while ((m = idRe.exec(clean)) !== null) {
    var name = m[1];
    if (!JS_RESERVED_WORDS[name] && !defined[name]) used[name] = true;
  }

  return { defined: defined, used: used };
}

/* مرتب‌سازی توپولوژیک ساده با شناسایی وابستگی؛ در صورت وجود چرخه یا
   نامشخص بودن، همون ترتیب ورودی (پایدار) حفظ می‌شه */
function uploadAutoOrderJsPaths(paths, namesByPath) {
  var indexOf = {};
  paths.forEach(function (p, i) { indexOf[p] = i; });

  var edges = {}; // path -> فهرست path هایی که باید زودتر بیان
  paths.forEach(function (p) { edges[p] = {}; });

  paths.forEach(function (consumer) {
    var usedNames = namesByPath[consumer].used;
    paths.forEach(function (provider) {
      if (provider === consumer) return;
      for (var name in usedNames) {
        if (namesByPath[provider].defined[name]) {
          edges[consumer][provider] = true;
          break;
        }
      }
    });
  });

  var visited = {};
  var visiting = {};
  var result = [];
  var hasCycle = false;

  function visit(p) {
    if (visited[p]) return;
    if (visiting[p]) { hasCycle = true; return; }
    visiting[p] = true;
    var deps = Object.keys(edges[p]).sort(function (a, b) { return indexOf[a] - indexOf[b]; });
    deps.forEach(visit);
    visiting[p] = false;
    visited[p] = true;
    result.push(p);
  }

  paths.slice().sort(function (a, b) { return indexOf[a] - indexOf[b]; }).forEach(visit);

  if (hasCycle) return paths.slice(); // مطمئن‌ترین حالت: ترتیب اصلی رو دست‌نخورده برگردون

  return result;
}

function uploadReadOrderFromHtmlEntry(htmlEntry, jsPaths) {
  return htmlEntry.file.text().then(function (htmlText) {
    var doc = new DOMParser().parseFromString(htmlText, 'text/html');
    var baseDir = uploadDirName(htmlEntry.path);
    var seen = [];
    doc.querySelectorAll('script[src]').forEach(function (el) {
      var raw = el.getAttribute('src');
      if (!raw) return;
      if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(raw) || /^data:/i.test(raw)) return;
      var key = uploadResolvePath(baseDir, raw.split('?')[0].split('#')[0]);
      if (jsPaths.indexOf(key) !== -1 && seen.indexOf(key) === -1) seen.push(key);
    });
    jsPaths.forEach(function (p) { if (seen.indexOf(p) === -1) seen.push(p); });
    return seen;
  }).catch(function () { return jsPaths.slice(); });
}

function uploadRecomputeJsOrder() {
  var jsPaths = uploadOrder.filter(function (p) { return uploadedFiles[p].kind === 'js'; });
  if (jsPaths.length < 2) {
    uploadJsManualOrder = jsPaths.slice();
    return Promise.resolve();
  }

  var htmlEntry = uploadFindHtmlEntry();
  if (htmlEntry) {
    // وقتی HTML هست، ترتیب پیش‌فرض همون ترتیبیه که خود <script src> نوشته؛
    // این دقیق‌ترین منبعه و تا کاربر دستی چیزی رو جابه‌جا نکنه همینو نشون می‌دیم
    var myGeneration = uploadJsReadGeneration;
    return uploadReadOrderFromHtmlEntry(htmlEntry, jsPaths).then(function (order) {
      if (myGeneration !== uploadJsReadGeneration) return; // آپلود جدیدتری وسط اومده
      uploadJsManualOrder = order;
    });
  }

  var namesByPath = {};
  var missingNames = false;
  jsPaths.forEach(function (p) {
    if (uploadedFiles[p].jsNames) {
      namesByPath[p] = uploadedFiles[p].jsNames;
    } else {
      missingNames = true;
    }
  });

  if (missingNames) {
    // هنوز محتوای بعضی فایل‌ها خونده نشده؛ فعلاً ترتیب فعلی رو نگه می‌داریم
    // تا بعد از خوندن محتوا دوباره محاسبه بشه
    var known = uploadJsManualOrder.filter(function (p) { return jsPaths.indexOf(p) !== -1; });
    jsPaths.forEach(function (p) { if (known.indexOf(p) === -1) known.push(p); });
    uploadJsManualOrder = known;
    return Promise.resolve();
  }

  uploadJsManualOrder = uploadAutoOrderJsPaths(jsPaths, namesByPath);
  return Promise.resolve();
}

/* ---- افزودن/حذف فایل‌ها ---- */
function uploadUpsertEntry(path, file) {
  var isNew = !uploadedFiles[path];
  uploadedFiles[path] = { path: path, file: file, kind: uploadGuessKind(path) };
  if (isNew) {
    uploadOrder.push(path);
    if (uploadedFiles[path].kind === 'js') uploadJsManualOrder.push(path);
  }
}

function uploadAddFileArray(items) {
  var validItems = items.filter(function (item) { return item.file && item.path; });
  validItems.forEach(function (item) { uploadUpsertEntry(item.path, item.file); });
  uploadRender();

  var newJsPaths = validItems
    .map(function (item) { return item.path; })
    .filter(function (p) { return uploadedFiles[p] && uploadedFiles[p].kind === 'js'; });

  var newHtmlAdded = validItems.some(function (item) { return uploadedFiles[item.path] && uploadedFiles[item.path].kind === 'html'; });

  if (newJsPaths.length === 0 && !newHtmlAdded) return;

  var myGeneration = ++uploadJsReadGeneration;
  Promise.all(newJsPaths.map(function (p) {
    return uploadedFiles[p].file.text().then(function (text) {
      if (uploadedFiles[p]) uploadedFiles[p].jsNames = uploadExtractJsNames(text);
    }).catch(function () { /* اگه خونده نشد، بی‌خیال ترتیب خودکار همین فایل می‌شیم */ });
  })).then(function () {
    if (myGeneration !== uploadJsReadGeneration) return; // آپلود جدیدتری وسط اومده، این نتیجه دیگه معتبر نیست
    return uploadRecomputeJsOrder();
  }).then(function () {
    if (myGeneration !== uploadJsReadGeneration) return;
    uploadRender();
  });
}

function uploadRemoveFile(path) {
  delete uploadedFiles[path];
  uploadOrder = uploadOrder.filter(function (p) { return p !== path; });
  uploadJsManualOrder = uploadJsManualOrder.filter(function (p) { return p !== path; });
  uploadJsReadGeneration++;
  var myGeneration = uploadJsReadGeneration;
  uploadRender(); // نمایش فوری با ترتیب فعلی، بدون منتظر موندن برای محاسبه‌ی مجدد
  uploadRecomputeJsOrder().then(function () {
    if (myGeneration !== uploadJsReadGeneration) return;
    uploadRender();
  });
}

function uploadClearAll() {
  uploadedFiles = {};
  uploadOrder = [];
  uploadJsManualOrder = [];
  uploadJsReadGeneration++;
  uploadRender();
}

function uploadMoveJs(path, dir) {
  var idx = uploadJsManualOrder.indexOf(path);
  if (idx === -1) return;
  var swapWith = idx + dir;
  if (swapWith < 0 || swapWith >= uploadJsManualOrder.length) return;
  var tmp = uploadJsManualOrder[idx];
  uploadJsManualOrder[idx] = uploadJsManualOrder[swapWith];
  uploadJsManualOrder[swapWith] = tmp;
  uploadRender();
}

function uploadFindHtmlEntry() {
  var htmlPaths = uploadOrder.filter(function (p) { return uploadedFiles[p].kind === 'html'; });
  if (htmlPaths.length === 0) return null;
  var indexMatches = htmlPaths.filter(function (p) {
    return p.toLowerCase() === 'index.html' || /\/index\.html$/i.test(p);
  });
  if (indexMatches.length > 0) {
    indexMatches.sort(function (a, b) { return a.split('/').length - b.split('/').length; });
    return uploadedFiles[indexMatches[0]];
  }
  return uploadedFiles[htmlPaths[0]];
}

/* ---- نمایش لیست فایل‌ها ---- */
function uploadRender() {
  var hasFiles = uploadOrder.length > 0;
  uploadListHeader.style.display = hasFiles ? 'flex' : 'none';
  uploadFileListEl.innerHTML = '';
  if (!hasFiles) return;

  var htmlEntry = uploadFindHtmlEntry();
  var jsCount = uploadOrder.filter(function (p) { return uploadedFiles[p].kind === 'js'; }).length;
  var showJsArrows = jsCount >= 2;

  if (htmlEntry) {
    uploadHintText.textContent = showJsArrows
      ? ('ورودی: ' + htmlEntry.path + ' — ترتیب لود JS از خود HTML خونده شد؛ با ▲▼ می‌تونی عوضش کنی')
      : ('ورودی: ' + htmlEntry.path + ' — مسیر فایل‌ها از خودش خونده می‌شه');
  } else if (showJsArrows) {
    uploadHintText.textContent = 'بدون HTML — ترتیب اجرای JS با تشخیص خودکار حدس زده شد؛ با ▲▼ می‌تونی عوضش کنی';
  } else {
    uploadHintText.textContent = 'بدون HTML — فایل موجود اجرا می‌شه';
  }

  var displayOrder;
  if (showJsArrows) {
    var jsQueue = uploadJsManualOrder.slice();
    displayOrder = uploadOrder.map(function (path) {
      return uploadedFiles[path].kind === 'js' ? jsQueue.shift() : path;
    });
  } else {
    displayOrder = uploadOrder;
  }

  displayOrder.forEach(function (path) {
    var entry = uploadedFiles[path];
    var row = document.createElement('div');
    row.className = 'upload-file-row';
    row.dataset.path = path;

    var kindTag = document.createElement('span');
    kindTag.className = 'upload-file-kind';
    kindTag.textContent = UPLOAD_KIND_LABELS[entry.kind] || 'FILE';
    row.appendChild(kindTag);

    var info = document.createElement('div');
    info.className = 'upload-file-info';
    var nameEl = document.createElement('div');
    nameEl.className = 'upload-file-name';
    nameEl.textContent = path;
    var sizeEl = document.createElement('div');
    sizeEl.className = 'upload-file-size';
    sizeEl.textContent = uploadFileSizeLabel(entry.file.size);
    info.appendChild(nameEl);
    info.appendChild(sizeEl);
    row.appendChild(info);

    if (showJsArrows && entry.kind === 'js') {
      var idx = uploadJsManualOrder.indexOf(path);
      var arrows = document.createElement('div');
      arrows.className = 'upload-reorder-btns';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'upload-reorder-btn';
      upBtn.textContent = '▲';
      upBtn.title = 'زودتر اجرا بشه';
      upBtn.disabled = idx <= 0;
      upBtn.dataset.action = 'up';
      upBtn.dataset.path = path;

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'upload-reorder-btn';
      downBtn.textContent = '▼';
      downBtn.title = 'دیرتر اجرا بشه';
      downBtn.disabled = idx === -1 || idx >= uploadJsManualOrder.length - 1;
      downBtn.dataset.action = 'down';
      downBtn.dataset.path = path;

      arrows.appendChild(upBtn);
      arrows.appendChild(downBtn);
      row.appendChild(arrows);
    }

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'upload-file-remove';
    removeBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    removeBtn.title = 'حذف';
    removeBtn.dataset.action = 'remove';
    removeBtn.dataset.path = path;
    row.appendChild(removeBtn);

    uploadFileListEl.appendChild(row);
  });
}

function uploadMarkUnusedRows(unusedPaths) {
  var rows = uploadFileListEl.querySelectorAll('.upload-file-row');
  rows.forEach(function (row) {
    row.classList.toggle('upload-file-unused', unusedPaths.indexOf(row.dataset.path) !== -1);
  });
  if (unusedPaths.length > 0) {
    uploadHintText.textContent += '  ·  ' + unusedPaths.length + ' فایل استفاده نشد';
  }
}

uploadFileListEl.addEventListener('click', function (e) {
  var btn = e.target.closest('button');
  if (!btn) return;
  var action = btn.dataset.action;
  var path = btn.dataset.path;
  if (action === 'remove') uploadRemoveFile(path);
  else if (action === 'up') uploadMoveJs(path, -1);
  else if (action === 'down') uploadMoveJs(path, 1);
});

/* ---- ورودی‌ها: کلیک، انتخاب پوشه، درگ‌اند‌دراپ ---- */
function uploadZoneShouldIgnoreClick(e) {
  var el = e.target;
  while (el && el !== uploadZone) {
    if (el.tagName === 'BUTTON') return true;
    el = el.parentNode;
  }
  return false;
}

uploadZone.addEventListener('click', function (e) {
  if (uploadZoneShouldIgnoreClick(e)) return;
  uploadFilesInput.click();
});

uploadZone.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    uploadFilesInput.click();
  }
});

pickFilesBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  uploadFilesInput.click();
});

pickFolderBtn.addEventListener('click', function (e) {
  e.stopPropagation();
  uploadFolderInput.click();
});

uploadFilesInput.addEventListener('change', function () {
  var items = [];
  for (var i = 0; i < this.files.length; i++) {
    items.push({ file: this.files[i], path: this.files[i].name });
  }
  uploadAddFileArray(items);
  this.value = '';
});

uploadFolderInput.addEventListener('change', function () {
  var items = [];
  for (var i = 0; i < this.files.length; i++) {
    var f = this.files[i];
    items.push({ file: f, path: f.webkitRelativePath || f.name });
  }
  uploadAddFileArray(items);
  this.value = '';
});

uploadClearBtn.addEventListener('click', uploadClearAll);

function uploadCollectEntries(entries) {
  var result = [];
  function walk(entry, prefix) {
    return new Promise(function (resolve) {
      if (entry.isFile) {
        entry.file(function (file) {
          result.push({ file: file, path: prefix + entry.name });
          resolve();
        }, function () { resolve(); });
      } else if (entry.isDirectory) {
        var reader = entry.createReader();
        var collected = [];
        function readBatch() {
          reader.readEntries(function (children) {
            if (!children.length) {
              Promise.all(collected.map(function (child) { return walk(child, prefix + entry.name + '/'); }))
                .then(function () { resolve(); });
              return;
            }
            collected = collected.concat(children);
            readBatch();
          }, function () { resolve(); });
        }
        readBatch();
      } else {
        resolve();
      }
    });
  }
  return Promise.all(entries.map(function (entry) { return walk(entry, ''); })).then(function () { return result; });
}

uploadZone.addEventListener('dragover', function (e) {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', function (e) {
  if (e.target === uploadZone) uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', function (e) {
  e.preventDefault();
  uploadZone.classList.remove('dragover');

  var dt = e.dataTransfer;
  if (dt.items && dt.items.length && dt.items[0].webkitGetAsEntry) {
    var entries = [];
    for (var i = 0; i < dt.items.length; i++) {
      var entry = dt.items[i].webkitGetAsEntry && dt.items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    uploadCollectEntries(entries).then(function (items) { uploadAddFileArray(items); });
  } else {
    var items = [];
    for (var j = 0; j < dt.files.length; j++) {
      items.push({ file: dt.files[j], path: dt.files[j].name });
    }
    uploadAddFileArray(items);
  }
});

/* ---- ساخت سند نهایی برای iframe ---- */
/* ---- خوندن محتوای فایل‌ها برای embed کردن مستقیم در سند نهایی ----
   نکته‌ی مهم: پیش‌نمایش داخل یک <iframe sandbox="..."> بدون allow-same-origin
   نمایش داده می‌شه (برای امنیت، چون کد آپلودی از منبع نامعتبره). تو این حالت
   iframe یک origin کاملاً جدا و مجزا می‌گیره، و blob: URL ها فقط از همون
   origin ای که ساخته شدن قابل fetch شدن هستن -- یعنی اگه از blob URL برای
   src/href استفاده کنیم، مرورگر لودش نمی‌کنه (نه CSS نه JS خارجی)، دقیقاً
   همون مشکلی که باعث میشه استایل و اسکریپت خارجی لود نشه.
   برای رفع این مشکل، دیگه از blob URL استفاده نمی‌کنیم: محتوای متنی (CSS/JS)
   مستقیم inline میشه تو خود سند (دقیقاً مثل buildWebDocString برای تب‌های
   عادی)، و فایل‌های باینری (عکس/صدا/ویدیو) با data: URL (base64) جاگذاری
   می‌شن -- چون data: URL هم فچ نمی‌کنه، مستقیم decode میشه، پس محدودیت
   same-origin روش اثر نمی‌ذاره. */
function uploadFileToDataUrl(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(reader.result); };
    reader.onerror = function () { reject(reader.error || new Error('خوندن فایل شکست خورد')); };
    reader.readAsDataURL(file);
  });
}

function uploadLoadFileContents() {
  var reads = [];
  uploadOrder.forEach(function (path) {
    var entry = uploadedFiles[path];
    if (entry.kind === 'html') return; // خود HTML جدا خونده می‌شه
    if (entry._contentForFile === entry.file && (entry._resolvedText !== undefined || entry._resolvedDataUrl !== undefined)) return; // قبلاً خونده و کش شده

    var promise;
    if (entry.kind === 'js' || entry.kind === 'css') {
      promise = entry.file.text().then(function (text) { entry._resolvedText = text; });
    } else {
      promise = uploadFileToDataUrl(entry.file).then(function (dataUrl) { entry._resolvedDataUrl = dataUrl; });
    }
    entry._contentForFile = entry.file;
    reads.push(promise);
  });
  return Promise.all(reads);
}

function uploadResolveAttr(el, attr, baseDir, usedPaths) {
  // برمی‌گردونه: { key: مسیر شناخته‌شده‌ی فایل } اگه resolve بشه، وگرنه null.
  // خود جایگذاری (inline یا data URL) رو تابع صدازننده انجام می‌ده، چون نوع
  // جایگذاری بسته به این‌که تگ چیه (link/img/script) فرق می‌کنه.
  var raw = el.getAttribute(attr);
  if (!raw) return null;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(raw) || /^data:/i.test(raw) || /^#/.test(raw) || /^(mailto|tel|javascript):/i.test(raw)) return null;

  var key = uploadResolvePath(baseDir, raw);
  if (uploadedFiles[key]) { usedPaths[key] = true; return key; }
  var flatKey = raw.replace(/^\.?\//, '');
  if (uploadedFiles[flatKey]) { usedPaths[flatKey] = true; return flatKey; }
  return null;
}

function uploadBuildDocFromHtml(htmlEntry) {
  return Promise.all([htmlEntry.file.text(), uploadLoadFileContents()]).then(function (results) {
    var htmlText = results[0];
    var doc = new DOMParser().parseFromString(htmlText, 'text/html');
    var baseDir = uploadDirName(htmlEntry.path);
    var usedPaths = {};

    var scriptEls = Array.prototype.slice.call(doc.querySelectorAll('script[src]'));
    var scriptPaths = scriptEls.map(function (el) {
      var raw = el.getAttribute('src');
      var key = uploadResolvePath(baseDir, raw.split('?')[0].split('#')[0]);
      return (uploadedFiles[key] && uploadedFiles[key].kind === 'js') ? key : null;
    });

    // اسکریپت‌های خارجی: src حذف می‌شه و محتوای واقعی js به‌جاش inline می‌شه؛
    // خود تگ <script> سرجای اصلیش می‌مونه (برای این‌که بعداً بشه بر اساس
    // موقعیتش تو سند، ترتیب دستی رو روش اعمال کرد)
    scriptEls.forEach(function (el, i) {
      var key = scriptPaths[i];
      if (!key) return;
      usedPaths[key] = true;
      el.removeAttribute('src');
      el.textContent = uploadedFiles[key]._resolvedText || '';
    });

    // لینک CSS: خود تگ <link> با یک <style> جایگزین می‌شه که محتوای واقعی CSS رو داره
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      var key = uploadResolveAttr(el, 'href', baseDir, usedPaths);
      if (!key || !uploadedFiles[key] || uploadedFiles[key].kind !== 'css') return;
      var styleEl = doc.createElement('style');
      styleEl.textContent = uploadedFiles[key]._resolvedText || '';
      el.parentNode.insertBefore(styleEl, el);
      el.parentNode.removeChild(el);
    });

    // عکس/صدا/ویدیو: src با data: URL (base64) جایگزین می‌شه
    function inlineAsDataUrl(el, attr) {
      var key = uploadResolveAttr(el, attr, baseDir, usedPaths);
      if (!key || !uploadedFiles[key] || !uploadedFiles[key]._resolvedDataUrl) return;
      el.setAttribute(attr, uploadedFiles[key]._resolvedDataUrl);
    }
    doc.querySelectorAll('img[src]').forEach(function (el) { inlineAsDataUrl(el, 'src'); });
    doc.querySelectorAll('source[src]').forEach(function (el) { inlineAsDataUrl(el, 'src'); });
    doc.querySelectorAll('video[src], audio[src]').forEach(function (el) { inlineAsDataUrl(el, 'src'); });

    // اگه کاربر با ▲▼ ترتیب لود جاوااسکریپت‌ها رو دستی عوض کرده باشه (متفاوت از
    // ترتیبی که تو خود HTML نوشته شده)، همون تگ‌های <script> که resolve شدن رو
    // به ترتیب جدید دوباره می‌چینیم؛ فقط تگ‌هایی که به یه فایل js شناخته‌شده وصل
    // بودن (قبل از inline شدن)، اسکریپت‌های inline اصلی یا لینک به خارج دست‌نخورده می‌مونن
    var recognizedInDocOrder = [];
    var recognizedPathsInDocOrder = [];
    scriptEls.forEach(function (el, i) {
      if (scriptPaths[i]) { recognizedInDocOrder.push(el); recognizedPathsInDocOrder.push(scriptPaths[i]); }
    });
    var manualOrderForThese = uploadJsManualOrder.filter(function (p) { return recognizedPathsInDocOrder.indexOf(p) !== -1; });

    var orderDiffers = manualOrderForThese.length === recognizedPathsInDocOrder.length &&
      manualOrderForThese.some(function (p, i) { return p !== recognizedPathsInDocOrder[i]; });

    if (orderDiffers && recognizedInDocOrder.length >= 2) {
      var elByPath = {};
      recognizedInDocOrder.forEach(function (el, i) { elByPath[recognizedPathsInDocOrder[i]] = el; });
      var anchorParent = recognizedInDocOrder[0].parentNode;
      var anchorNext = recognizedInDocOrder[recognizedInDocOrder.length - 1].nextSibling;
      recognizedInDocOrder.forEach(function (el) { el.parentNode.removeChild(el); });
      manualOrderForThese.forEach(function (p) { anchorParent.insertBefore(elByPath[p], anchorNext); });
    }

    var head = doc.querySelector('head');
    if (!head) {
      head = doc.createElement('head');
      doc.documentElement.insertBefore(head, doc.body);
    }
    var errScript = doc.createElement('script');
    errScript.textContent = UPLOAD_ERROR_CATCHER_JS;
    head.insertBefore(errScript, head.firstChild);

    var unusedPaths = uploadOrder.filter(function (p) {
      return p !== htmlEntry.path && uploadedFiles[p].kind !== 'html' && !usedPaths[p];
    });

    return { doc: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, unusedPaths: unusedPaths };
  });
}

function uploadBuildDocFromFilesOnly() {
  var cssPaths = uploadOrder.filter(function (p) { return uploadedFiles[p].kind === 'css'; });
  var jsPaths = uploadJsManualOrder.slice();

  return uploadLoadFileContents().then(function () {
    var parts = ['<!DOCTYPE html><html><head><meta charset="UTF-8">'];
    parts.push('<' + 'script>' + UPLOAD_ERROR_CATCHER_JS + '</' + 'script>');
    cssPaths.forEach(function (p) {
      if (uploadedFiles[p] && uploadedFiles[p]._resolvedText !== undefined) {
        parts.push('<style>' + uploadedFiles[p]._resolvedText + '</style>');
      }
    });
    parts.push('</head><body>');
    jsPaths.forEach(function (p) {
      if (uploadedFiles[p] && uploadedFiles[p]._resolvedText !== undefined) {
        parts.push('<' + 'script>' + uploadedFiles[p]._resolvedText + '</' + 'script>');
      }
    });
    parts.push('</body></html>');

    var usedSet = {};
    cssPaths.forEach(function (p) { usedSet[p] = true; });
    jsPaths.forEach(function (p) { usedSet[p] = true; });
    var unusedPaths = uploadOrder.filter(function (p) { return !usedSet[p]; });

    return { doc: parts.join('\n'), unusedPaths: unusedPaths };
  });
}

/* ---- اجرا: هیچ اعتبارسنجی‌ای انجام نمی‌شه، فقط سند ساخته و نشون داده می‌شه ---- */
function runUpload() {
  var myToken = ++runToken;
  resetPreviewFrame();

  if (uploadOrder.length === 0) {
    setDot('upload', 'trip');
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView([{ section: 'آپلود', message: 'هنوز هیچ فایلی آپلود نکردی. اول فایل(ها) رو اضافه کن.' }]);
    updateCancelVisibility();
    return;
  }

  var htmlEntry = uploadFindHtmlEntry();
  var hasRunnable = htmlEntry || uploadOrder.some(function (p) {
    return uploadedFiles[p].kind === 'js' || uploadedFiles[p].kind === 'css';
  });

  if (!hasRunnable) {
    setDot('upload', 'trip');
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView([{ section: 'آپلود', message: 'هیچ‌کدوم از فایل‌های آپلودی html/css/js نیستن، چیزی برای اجرا نیست.' }]);
    updateCancelVisibility();
    return;
  }

  setStatusLabel('در حال آماده‌سازی فایل‌ها...', null);

  (htmlEntry ? uploadBuildDocFromHtml(htmlEntry) : uploadBuildDocFromFilesOnly())
    .then(function (result) {
      if (myToken !== runToken || !result) return;
      webIsLive = true;
      liveWebTab = 'upload';
      setDot('upload', 'live');
      setStatusLabel('مدار وصله — همه‌چی درست کار می‌کنه', 'live');
      showPreviewView(result.doc);
      updateCancelVisibility();
      uploadMarkUnusedRows(result.unusedPaths);
    })
    .catch(function (err) {
      if (myToken !== runToken) return;
      setDot('upload', 'trip');
      setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
      showErrorsView([{ section: 'آپلود', message: 'خوندن یا اجرای فایل‌ها به مشکل خورد: ' + err.message }]);
      updateCancelVisibility();
    });
}

/* ============================================================
   دکمه‌های اجرا و لغو
   ============================================================ */
runBtn.addEventListener('click', function () {
  if (currentLang === 'python') {
    runPython();
  } else if (currentLang === 'upload') {
    runUpload();
  } else {
    runWeb();
  }
});

cancelBtn.addEventListener('click', function () {
  if (currentLang === 'python') {
    cancelPython();
  } else {
    cancelWeb();
  }
});

/* ============================================================
   تغییر اندازه‌ی پنل خروجی: کشیدن + دکمه‌های پله‌ای
   ============================================================ */
(function () {
  var outputRegion = document.querySelector('.output-region');
  var workspace = document.querySelector('.workspace');
  var dividerHit = document.getElementById('dividerHit');
  var growBtn = document.getElementById('growOutputBtn');
  var shrinkBtn = document.getElementById('shrinkOutputBtn');
  var RESIZE_STEP = 70;

  function clampHeight(px) {
    var rect = workspace.getBoundingClientRect();
    var min = 90;
    var max = rect.height - 140;
    return Math.max(min, Math.min(max, px));
  }

  function setHeightFromPointerY(clientY) {
    var rect = workspace.getBoundingClientRect();
    outputRegion.style.flexBasis = clampHeight(rect.bottom - clientY) + 'px';
  }

  function stepHeight(delta) {
    var current = outputRegion.getBoundingClientRect().height;
    outputRegion.style.flexBasis = clampHeight(current + delta) + 'px';
  }

  growBtn.addEventListener('click', function () { stepHeight(RESIZE_STEP); });
  shrinkBtn.addEventListener('click', function () { stepHeight(-RESIZE_STEP); });

  dividerHit.addEventListener('pointerdown', function (e) {
    dividerHit.setPointerCapture(e.pointerId);
    divider.classList.add('dragging');
  });

  dividerHit.addEventListener('pointermove', function (e) {
    if (!dividerHit.hasPointerCapture(e.pointerId)) return;
    setHeightFromPointerY(e.clientY);
  });

  function endPointerDrag(e) {
    if (dividerHit.hasPointerCapture(e.pointerId)) {
      dividerHit.releasePointerCapture(e.pointerId);
    }
    divider.classList.remove('dragging');
  }

  dividerHit.addEventListener('pointerup', endPointerDrag);
  dividerHit.addEventListener('pointercancel', endPointerDrag);

  dividerHit.addEventListener('touchstart', function (e) {
    divider.classList.add('dragging');
    e.preventDefault();
  }, { passive: false });

  dividerHit.addEventListener('touchmove', function (e) {
    if (!e.touches || !e.touches[0]) return;
    setHeightFromPointerY(e.touches[0].clientY);
    e.preventDefault();
  }, { passive: false });

  function endTouchDrag() { divider.classList.remove('dragging'); }
  dividerHit.addEventListener('touchend', endTouchDrag);
  dividerHit.addEventListener('touchcancel', endTouchDrag);
})();

/* ============================================================
   حالت اولیه: هیچ اجرایی خودکار انجام نمی‌شود
   ============================================================ */
showPlaceholderView();
syncOpenWindowBtn();
updateCancelVisibility();
