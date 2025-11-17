import { script } from './playcanvas-stable.min.mjs';

/* loading-screen.js — Classic PlayCanvas Loading Screen
   Converted from ESM module version to classic Editor script.

   Usage: In the PlayCanvas Editor, create a Script asset with this code.
   Then open Project Settings → Loading Screen → select “Use custom loading screen”.
*/ script.createLoadingScreen(function(app) {
    // ---------------------------
    // State / element references
    // ---------------------------
    var root = null;
    var text = null;
    var fill = null;
    var css = null;
    // ---------------------------
    // Helpers
    // ---------------------------
    function createStyles() {
        css = document.createElement('style');
        css.id = 'loading-screen-styles';
        css.textContent = [
            ".pc-loading-root{position:fixed;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,#1d292c 0%,#2a3f47 100%);z-index:9999;transition:opacity .5s ease;font-family:system-ui,-apple-system,sans-serif}",
            ".pc-loading-box{text-align:center;background:rgba(0,0,0,.55);padding:24px 32px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.4);backdrop-filter:blur(10px)}",
            ".pc-loading-logo{width:140px;height:auto;margin-bottom:16px;filter:drop-shadow(0 2px 6px rgba(0,0,0,.6))}",
            ".pc-loading-text{font:600 16px/1.4 system-ui,sans-serif;color:#e9eef5;margin:8px 0;text-shadow:0 1px 3px rgba(0,0,0,.5)}",
            ".pc-loading-bar{width:280px;height:12px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden;margin:12px auto 0;border:1px solid rgba(255,255,255,.1)}",
            ".pc-loading-fill{height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#06b6d4);transition:width .15s ease;border-radius:inherit}"
        ].join("");
        document.head.appendChild(css);
    }
    function createDOM() {
        root = document.createElement('div');
        root.className = 'pc-loading-root';
        root.id = 'pc-loading-screen';
        root.innerHTML = '<div class="pc-loading-box">' + '<img class="pc-loading-logo" ' + 'src="./logo.png" ' + 'alt="Game Logo" />' + '<div class="pc-loading-text" id="pcText">Loading… 0%</div>' + '<div class="pc-loading-bar">' + '<div class="pc-loading-fill" id="pcFill"></div>' + '</div>' + '</div>';
        document.body.appendChild(root);
        text = root.querySelector('#pcText');
        fill = root.querySelector('#pcFill');
    }
    function setMessage(msgHtml) {
        if (text) text.textContent = msgHtml;
    }
    function setProgress01(p) {
        var pct = Math.max(0, Math.min(1, p));
        if (fill) fill.style.width = Math.round(pct * 100) + '%';
    }
    function show() {
        if (root) {
            root.style.opacity = '1';
            root.style.display = 'grid';
        }
    }
    function destroy() {
        if (root && root.parentNode) {
            root.parentNode.removeChild(root);
        }
        if (css && css.parentNode) {
            css.parentNode.removeChild(css);
        }
        root = text = fill = css = null;
    }
    function hide() {
        if (!root) return;
        root.style.opacity = '0';
        // Match CSS transition (0.5s) + small buffer
        setTimeout(destroy, 550);
    }
    // ---------------------------
    // Create UI immediately
    // ---------------------------
    createStyles();
    createDOM();
    show();
    // ---------------------------
    // Hook PlayCanvas lifecycle
    // ---------------------------
    app.on('preload:start', function() {
        setMessage('Loading… 0%');
        setProgress01(0);
    });
    app.on('preload:progress', function(value) {
        var pct = Math.round((value || 0) * 100);
        setMessage('Loading… ' + pct + '%');
        setProgress01(value || 0);
    });
    app.on('preload:end', function() {
        setMessage('Starting…');
    });
    app.on('start', function() {
        hide();
    });
});
