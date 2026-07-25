/* ============================================================
   عناصر DOM
   این فایل روی چهار صفحه‌ی جدا (html.html / css.html /
   javascript.html / python.html) لود میشه. هر صفحه با
   body[data-lang="..."] مشخص می‌کنه مخصوص کدوم زبونه، و
   فقط همون یک ادیتور رو داره (هیچ نواری برای سوییچ بین
   زبون‌ها وجود نداره — برگشتن به صفحه‌ی اصلی از طریق
   دکمه‌ی خونه انجام میشه).
   ============================================================ */
var currentLang = document.body.dataset.lang || 'html';

var editorCode = document.getElementById('editor-code');
var dots = {
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
var divider = document.getElementById('divider');

var lastGoodWebDoc = null;
var webIsLive = false;
var pythonIsPending = false;
var runToken = 0;

var DEFAULT_PLACEHOLDER_HTML = 'کد رو بنویس، بعد دکمه <strong>▶ اجرا</strong> رو بزن تا وضعیت مدار رو ببینی. بالای این پنل رو هم می‌تونی بکشی تا فاصله‌ی ادیتور و نمایشگر عوض بشه.';
var CANCELLED_PLACEHOLDER_HTML = 'اجرا لغو شد. کد جدید رو بنویس و دوباره <strong>▶ اجرا</strong> رو بزن.';

/* ============================================================
   محتوای پیش‌فرضِ ثابتِ دو مکملِ دیگه، برای زبون‌های وب
   (HTML/CSS/JS). وقتی کاربر مثلاً روی صفحه‌ی CSS داره فقط
   استایل می‌نویسه، این HTML و JS پیش‌فرض پشت صحنه استفاده
   میشن تا خروجی واقعی و قابل‌دیدن بمونه.
   ============================================================ */
var WEB_DEFAULTS = {
  html: '<h1>سلام دنیا!</h1>\n<p>این یک متن نمونه‌ست.</p>\n<button onclick="sayHi()">کلیک کن</button>',
  css: 'body {\n  font-family: sans-serif;\n  background: #f4f4fb;\n  color: #22223b;\n  padding: 24px;\n  text-align: center;\n}\nh1 { color: #e8a33d; }\nbutton {\n  background: #e8a33d;\n  color: #1a1305;\n  border: none;\n  padding: 10px 20px;\n  border-radius: 6px;\n  cursor: pointer;\n  font-weight: bold;\n}',
  js: 'function sayHi() {\n  alert("سلام! این پیام از جاوااسکریپت اومد.");\n}\nconsole.log("صفحه لود شد");'
};

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
}

function setStatusLabel(text, state) {
  statusLabel.childNodes[statusLabel.childNodes.length - 1].textContent = ' ' + text;
  setDot('status', state);
}

function syncOpenWindowBtn() {
  openWindowBtn.disabled = !(currentLang !== 'python' && lastGoodWebDoc);
}

function updateCancelVisibility() {
  var shouldShow = (currentLang === 'python') ? pythonIsPending : webIsLive;
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
   بدون هیچ رشته‌ی تگ اسکریپت لفظی در همین فایل، تا پارسر
   مرورگر گیج نشود.
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
   بازسازی iframe پیش‌نمایش از صفر.
   این کار هر تایمر، صدا، یا رویدادِ در حال اجرا در پیش‌نمایش
   قبلی را کاملاً متوقف می‌کند (چون کل زمینه‌ی مرورگرِ آن
   iframe از بین می‌رود)، پیش از هر اجرای جدید یا لغو.
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
   اجرای HTML/CSS/JS — فقط زبونِ همین صفحه اعتبارسنجی میشه؛
   دو تای دیگه از WEB_DEFAULTS (که همیشه سالمن) گرفته میشن.
   ============================================================ */
var SECTION_NAMES = { html: 'HTML', css: 'CSS', js: 'JavaScript' };

function runWeb() {
  resetPreviewFrame();

  var userCode = editorCode.value;
  var html = currentLang === 'html' ? userCode : WEB_DEFAULTS.html;
  var css = currentLang === 'css' ? userCode : WEB_DEFAULTS.css;
  var js = currentLang === 'js' ? userCode : WEB_DEFAULTS.js;

  var result = currentLang === 'html' ? validateHTML(userCode)
    : currentLang === 'css' ? validateCSS(userCode)
    : validateJS(userCode);

  if (!result.ok) {
    webIsLive = false;
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView([{ section: SECTION_NAMES[currentLang], message: result.message }]);
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
  var code = editorCode.value;
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
      setStatusLabel('مدار وصله — کد درست اجرا شد', 'live');
      showConsoleView(output || '(کد اجرا شد ولی هیچ چیزی چاپ نکرد)');
      updateCancelVisibility();
    }, function (err) {
      if (myToken !== runToken) return;
      pythonIsPending = false;
      setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
      showErrorsView([{ section: 'Python', message: err.message }]);
      updateCancelVisibility();
    });
  }).catch(function (err) {
    if (myToken !== runToken) return;
    pythonIsPending = false;
    setStatusLabel('قطعی توی مدار پیدا شد', 'trip');
    showErrorsView([{ section: 'Python', message: err.message }]);
    updateCancelVisibility();
  });
}

function cancelPython() {
  runToken++;
  pythonIsPending = false;
  setStatusLabel('لغو شد — آماده‌ی اجرای جدید', null);
  showPlaceholderView(CANCELLED_PLACEHOLDER_HTML);
  updateCancelVisibility();
}

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
   تغییر اندازه‌ی پنل خروجی: هم با کشیدن، هم با دو دکمه‌ی پله‌ای
   (دکمه‌ها همیشه کار می‌کنند، چون فقط یک تپ ساده‌اند و به هیچ
   ژست خاصی وابسته نیستند — پشتیبان مطمئن برای کشیدن)
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

  /* Pointer Events: مسیر اصلی برای ماوس، قلم و بیشتر مرورگرهای لمسی */
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

  /* Touch Events: پشتیبان صریح برای مرورگرهای/وب‌ویوهایی که
     Pointer Events یا touch-action را کامل رعایت نمی‌کنند */
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
