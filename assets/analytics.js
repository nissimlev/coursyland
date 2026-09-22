/* ============================================================
   קורסילנד — Google Analytics 4 + Meta Pixel + באנר הסכמה
   ------------------------------------------------------------
   עקרון: איסוף נתונים הוא OPT-IN בלבד.
   כל עוד המבקר לא אישר במפורש — לא נטען gtag, לא נטען fbq,
   לא נשלחת שום בקשה ל-Google או ל-Facebook, ולא נשמרת אף עוגיית
   אנליטיקה/פרסום.

   Meta Pixel נטען רק בדפים שמפורטים ב-META_PIXEL_PAGES — לא בכל
   האתר. להוספת דף — מוסיפים את הנתיב שלו למערך, לא הופכים את זה
   לגלובלי.

   להחלפת נכס GA — יש לשנות רק את GA_MEASUREMENT_ID.
   ============================================================ */
(function () {
  'use strict';

  var GA_MEASUREMENT_ID = 'G-68WQD2QLSZ';
  var STORAGE_KEY       = 'coursyland.consent.v1';
  var PRIVACY_URL       = '/מסמכים/files/privacy.html';

  /* Meta Pixel (Facebook) — מדידת פרסום/רימרקטינג.
     בכוונה מוגבל לדפי נחיתה ספציפיים, לא לכל האתר.
     להוספת דף נוסף — הוסיפו את הנתיב למערך הזה בלבד. */
  var META_PIXEL_ID    = '795788145571339';
  var META_PIXEL_PAGES = [
    '/pages/dikla-teler/present-of-gaps.html'
  ];

  /* ---------- בדיקות סביבה ---------- */

  function measurable() {
    if (GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') return false;
    if (!/^G-[A-Z0-9]{6,}$/.test(GA_MEASUREMENT_ID)) return false;
    if (location.protocol === 'file:') return false;
    var h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local')) return false;
    if (/^\/(dashboard|admintools)\//.test(location.pathname)) return false;
    return true;
  }

  /* ---------- שמירת הבחירה ---------- */

  function readChoice() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeChoice(v) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch (e) { /* מצב פרטי — לא קריטי */ }
  }

  /* ---------- טעינת GA4 ---------- */

  var loaded = false;
  function loadGA() {
    if (loaded || !measurable()) return;
    loaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };

    window.gtag('js', new Date());
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    window.gtag('config', GA_MEASUREMENT_ID);

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(s);
  }

  /* ---------- טעינת Meta Pixel (מוגבל לדפים ב-META_PIXEL_PAGES) ---------- */

  function metaPixelApplies() {
    var path = location.pathname;
    for (var i = 0; i < META_PIXEL_PAGES.length; i++) {
      if (path === META_PIXEL_PAGES[i] || path.indexOf(META_PIXEL_PAGES[i]) !== -1) return true;
    }
    return false;
  }

  var metaLoaded = false;
  function loadMetaPixel() {
    if (metaLoaded || !measurable() || !metaPixelApplies()) return;
    metaLoaded = true;

    /* fbq לא מוגדר בכלל עד שיש הסכמה — כלומר שום קריאה לא יכולה
       לצאת ל-Facebook לפני הרגע הזה, בדיוק כמו gtag למעלה. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = true; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('consent', 'grant');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  /* ---------- עיצוב הבאנר ---------- */

  var CSS = [
    '.cl-consent{position:fixed;inset-inline:0;bottom:0;z-index:2147483000;',
    'display:flex;justify-content:center;padding:14px;pointer-events:none;',
    'font-family:Heebo,"Segoe UI",Arial,"Noto Sans Hebrew",sans-serif;direction:rtl}',
    '.cl-consent-card{pointer-events:auto;max-width:760px;width:100%;background:#ffffff;',
    'color:#1a1330;border:1px solid #d9d2e6;border-radius:14px;',
    'box-shadow:0 12px 40px rgba(20,0,30,.28);padding:20px 22px;',
    'display:flex;flex-wrap:wrap;align-items:center;gap:14px 18px;text-align:right}',
    '.cl-consent-text{flex:1 1 340px;font-size:15px;line-height:1.6;margin:0}',
    '.cl-consent-text a{color:#6b21a8;text-decoration:underline}',
    '.cl-consent-actions{display:flex;gap:10px;flex-wrap:wrap}',
    '.cl-consent-btn{font:inherit;font-size:15px;font-weight:700;cursor:pointer;',
    'border-radius:10px;padding:11px 20px;border:1.5px solid transparent;line-height:1.2}',
    '.cl-consent-btn:focus-visible{outline:3px solid #6b21a8;outline-offset:2px}',
    '.cl-consent-yes{background:#6b21a8;color:#fff}',
    '.cl-consent-yes:hover{background:#571888}',
    '.cl-consent-no{background:#fff;color:#3d2b52;border-color:#c9bfd8}',
    '.cl-consent-no:hover{background:#f4f0f8}',
    '.cl-consent-link{background:none;border:none;padding:0;font:inherit;font-size:14px;',
    'color:inherit;opacity:.75;text-decoration:underline;cursor:pointer}',
    '.cl-consent-link:focus-visible{outline:2px solid currentColor;outline-offset:2px}',
    '@media(max-width:560px){.cl-consent-card{padding:16px}.cl-consent-actions{width:100%}',
    '.cl-consent-btn{flex:1 1 auto}}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('cl-consent-css')) return;
    var st = document.createElement('style');
    st.id = 'cl-consent-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- הבאנר ---------- */

  var banner = null;

  function closeBanner() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function showBanner() {
    if (banner) return;
    injectCSS();

    banner = document.createElement('div');
    banner.className = 'cl-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-labelledby', 'cl-consent-title');

    var card = document.createElement('div');
    card.className = 'cl-consent-card';

    var text = document.createElement('p');
    text.className = 'cl-consent-text';
    text.id = 'cl-consent-title';
    var msg = 'אנחנו משתמשים ב-Google Analytics כדי להבין איך משתמשים באתר ולשפר אותו. ';
    if (metaPixelApplies()) {
      msg += 'בדף הזה אנחנו משתמשים גם בפיקסל פרסום של Facebook (Meta), לצורך מדידת פרסום ורימרקטינג. ' +
        'לא נאסף מידע מזהה, ורק אם תאשרו יופעל גם פרסום מותאם אישית ברשתות כמו פייסבוק. ';
    } else {
      msg += 'לא נאסף מידע מזהה, ואין פרסום מותאם אישית. ';
    }
    text.innerHTML = msg + '<a href="' + PRIVACY_URL + '">למדיניות הפרטיות</a>';

    var actions = document.createElement('div');
    actions.className = 'cl-consent-actions';

    var yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'cl-consent-btn cl-consent-yes';
    yes.textContent = 'אני מאשר';
    yes.onclick = function () { writeChoice('granted'); closeBanner(); loadGA(); loadMetaPixel(); };

    var no = document.createElement('button');
    no.type = 'button';
    no.className = 'cl-consent-btn cl-consent-no';
    no.textContent = 'רק ההכרחי';
    no.onclick = function () { writeChoice('denied'); closeBanner(); };

    actions.appendChild(yes);
    actions.appendChild(no);
    card.appendChild(text);
    card.appendChild(actions);
    banner.appendChild(card);
    document.body.appendChild(banner);
    yes.focus();
  }

  /* ---------- קישור "הגדרות פרטיות" בתחתית הדף ---------- */

  function addSettingsLink() {
    injectCSS();
    var host = document.querySelector('footer') ||
               document.querySelector('.wrap') ||
               document.body;

    var wrapper = document.createElement('div');
    wrapper.style.marginTop = '10px';
    wrapper.style.fontSize = '14px';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cl-consent-link';
    btn.textContent = 'הגדרות פרטיות';
    btn.onclick = function () { showBanner(); };

    wrapper.appendChild(btn);
    host.appendChild(wrapper);
  }

  /* ---------- API גלובלי ---------- */

  window.coursylandConsent = {
    status: function () { return readChoice() || 'unset'; },
    open:   showBanner,
    grant:  function () { writeChoice('granted'); closeBanner(); loadGA(); loadMetaPixel(); },
    revoke: function () { writeChoice('denied'); closeBanner(); }
  };

  /* ---------- הפעלה ---------- */

  function init() {
    if (!measurable()) return;      // סביבת פיתוח / אזור ניהול — אין באנר ואין מדידה
    addSettingsLink();
    var choice = readChoice();
    if (choice === 'granted') { loadGA(); loadMetaPixel(); }
    else if (choice !== 'denied') showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
