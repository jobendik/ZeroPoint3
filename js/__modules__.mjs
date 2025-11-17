import { WasmModule, basisInitialize, dracoInitialize } from './playcanvas-stable.min.mjs';

const loadModules = function(modules, urlPrefix) {
    return new Promise((resolve)=>{
        if (typeof modules === "undefined" || modules.length === 0) {
            resolve();
        } else {
            let remaining = modules.length;
            const moduleLoaded = ()=>{
                if (--remaining === 0) {
                    resolve();
                }
            };
            modules.forEach(function(m) {
                WasmModule.setConfig(m.moduleName, {
                    glueUrl: urlPrefix + m.glueUrl,
                    wasmUrl: urlPrefix + m.wasmUrl,
                    fallbackUrl: urlPrefix + m.fallbackUrl
                });
                if (!m.hasOwnProperty('preload') || m.preload) {
                    if (m.moduleName === 'BASIS') {
                        // preload basis transcoder
                        basisInitialize();
                        moduleLoaded();
                    } else if (m.moduleName === 'DracoDecoderModule') {
                        // preload draco decoder
                        if (dracoInitialize) {
                            // 1.63 onwards
                            dracoInitialize();
                            moduleLoaded();
                        } else {
                            // 1.62 and earlier
                            WasmModule.getInstance(m.moduleName, moduleLoaded);
                        }
                    } else {
                        // load remaining modules in global scope
                        WasmModule.getInstance(m.moduleName, moduleLoaded);
                    }
                } else {
                    moduleLoaded();
                }
            });
        }
    });
};

export { loadModules };
