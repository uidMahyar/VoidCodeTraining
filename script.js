/* ============================================================
   عناصر DOM
   ============================================================ */
var railTabs = document.querySelectorAll('.rail-tab');
var editorPanes = {
  html: document.getElementById('pane-html'),
  css: document.getElementById('pane-css'),
  js: document.getElementById('pane-js'),
  python: document.getElementById('pane-python')
};
var dots = {
  html: document.getElementById('dot-html'),
  css: document.getElementById('dot-css'),
  js: document.getElementById('dot-js'),
  python: document.getElementById('dot-python'),
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

var WEB_LANGS = { html: 1, css: 1, js: 1 };

var currentLang = 'html';
var lastGoodWebDoc = null;
var webIsLive = false;
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

var LANG_LABELS = { html: 'HTML', css: 'CSS', js: 'JavaScript', python: 'Python' };

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
    setDot('js', 'trip');
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    webIsLive = false;
    showErrorsView([{
      section: 'JavaScript (هنگام اجرا)',
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
  setStatusLabel('مدار وصله — همه‌چی درست کار می‌کنه', 'live');
  showPreviewView(buildWebDocString(html, css, js));
  updateCancelVisibility();
}

function cancelWeb() {
  resetPreviewFrame();
  webIsLive = false;
  setDot('html', null);
  setDot('css', null);
  setDot('js', null);
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
   دکمه‌های اجرا و لغو
   ============================================================ */
runBtn.addEventListener('click', function () {
  if (currentLang === 'python') {
    runPython();
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
