/* ========================================
   PageLoader - Full-page boot / loading screen
   - Animated crest + progress while profile data loads
   - API: window.__pageLoader = { stage(n), setStage(label,floor), setReady(), hide() }
     stage: 0 assets, 1 database, 2 officer data, 3 payment checks
   ======================================== */

(function () {
    var overlay = document.getElementById('pageLoader');
    if (!overlay) return;

    /* Guard against double-init (e.g. hot reload) */
    if (window.__pageLoader) return;

    var fill = document.getElementById('plFill');
    var status = document.getElementById('plStatus');
    var percentEl = document.getElementById('plPercent');

    var T_LOAD  = 'กำลังเริ่มระบบ…';
    var T_READY = 'พร้อมใช้งาน ✓';

    var current = 0;      /* shown % */
    var target  = 0;      /* goal % */
    var ended   = false;

    function clamp(v) { return Math.max(0, Math.min(100, v)); }

    function render() {
        percentEl.textContent = Math.round(current) + '%';
        fill.style.width = current + '%';
    }

    function ticker() {
        if (current < target) {
            current = Math.min(target, current + Math.max(1.2, (target - current) * 0.06));
        } else if (current > target) {
            current = Math.max(target, current - 2);
        }
        render();
    }

    var timer = setInterval(ticker, 40);

    function setStage(label, floor) {
        if (ended) return;
        status.textContent = label;
        target = clamp(floor);
    }

    /* Boot sequence floors: assets -> db -> officer -> status checks */
    var STAGES = [
        [T_LOAD, 12], /* 0 assets  */
        [T_LOAD, 40], /* 1 database */
        [T_LOAD, 60], /* 2 officer  */
        [T_LOAD, 80]  /* 3 payments */
    ];

    function stage(n) {
        if (n >= 0 && n < STAGES.length) setStage(STAGES[n][0], STAGES[n][1]);
    }

    function setReady() {
        if (ended) return;
        setStage(T_READY, 100);
        setTimeout(end, 700);
    }

    function end() {
        if (ended) return;
        ended = true;
        overlay.classList.add('is-ready');
        setTimeout(function () { overlay.style.display = 'none'; }, 750);
        clearInterval(timer);
    }

    function hide() {
        if (ended) return;
        ended = true;
        overlay.style.display = 'none';
        clearInterval(timer);
    }

    /* Static assets finish loading (CSS, fonts, images, scripts) */
    window.addEventListener('load', function () { setStage(T_LOAD, 25); });

    setStage(T_LOAD, 12);

    window.__pageLoader = { stage: stage, setStage: setStage, setReady: setReady, hide: hide };
})();
