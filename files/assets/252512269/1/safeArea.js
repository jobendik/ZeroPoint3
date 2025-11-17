/* global pc */
// SafeArea.js — legger marginer for safe-area (notch/avrundede hjørner) på en Group (Element)
// Fest på: UI/SafeAreaContainer (Element: Group, anchor [0,0,1,1])

var SafeArea = pc.createScript('safeArea');

SafeArea.prototype.initialize = function () {
    this._onResize = this._updateSafeArea.bind(this);
    window.addEventListener('resize', this._onResize);
    if (screen.orientation && screen.orientation.addEventListener) {
        screen.orientation.addEventListener('change', this._onResize);
    }
    this._updateSafeArea();
    this.on('destroy', this._cleanup, this);
};

SafeArea.prototype._cleanup = function () {
    window.removeEventListener('resize', this._onResize);
    if (screen.orientation && screen.orientation.removeEventListener) {
        screen.orientation.removeEventListener('change', this._onResize);
    }
};

SafeArea.prototype._readInset = function (varName) {
    // CSS env() returnerer f.eks. "44px". parseFloat håndterer både "0" og "0px".
    const s = getComputedStyle(document.documentElement).getPropertyValue(`env(${varName})`);
    const v = parseFloat(s || '0');
    return isNaN(v) ? 0 : v;
};

SafeArea.prototype._updateSafeArea = function () {
    if (!this.entity.element) return;

    const left   = this._readInset('safe-area-inset-left');
    const right  = this._readInset('safe-area-inset-right');
    const top    = this._readInset('safe-area-inset-top');
    const bottom = this._readInset('safe-area-inset-bottom');

    // Merk: Element.margin = Vec4(left, bottom, right, top) i PlayCanvas
    this.entity.element.margin = new pc.Vec4(left, bottom, right, top);
};
