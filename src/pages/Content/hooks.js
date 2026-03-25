const LOAD_DEFERRED_IMAGES_START_EVENT = "ld-load-deferred-images-start";
const LOAD_DEFERRED_IMAGES_END_EVENT = "ld-load-deferred-images-end";
const LOAD_DEFERRED_IMAGES_KEEP_ZOOM_LEVEL_START_EVENT = "ld-load-deferred-images-keep-zoom-level-start";
const LOAD_DEFERRED_IMAGES_KEEP_ZOOM_LEVEL_END_EVENT = "ld-load-deferred-images-keep-zoom-level-end";
const LOAD_DEFERRED_IMAGES_RESET_ZOOM_LEVEL_EVENT = "ld-load-deferred-images-keep-zoom-level-reset";
const LOAD_DEFERRED_IMAGES_RESET_EVENT = "ld-load-deferred-images-reset";
const BLOCK_COOKIES_START_EVENT = "ld-block-cookies-start";
const BLOCK_COOKIES_END_EVENT = "ld-block-cookies-end";
const BLOCK_STORAGE_START_EVENT = "ld-block-storage-start";
const BLOCK_STORAGE_END_EVENT = "ld-block-storage-end";
const DISPATCH_SCROLL_START_EVENT = "ld-dispatch-scroll-event-start";
const DISPATCH_SCROLL_END_EVENT = "ld-dispatch-scroll-event-end";
const LAZY_LOAD_ATTRIBUTE = "ld-lazy-load";
const LOAD_IMAGE_EVENT = "ld-load-image";
const IMAGE_LOADED_EVENT = "ld-image-loaded";
const NEW_FONT_FACE_EVENT = "ld-new-font-face";
const DELETE_FONT_EVENT = "ld-delete-font";
const CLEAR_FONTS_EVENT = "ld-clear-fonts";
const FONT_STYLE_PROPERTIES = {
  family: "font-family",
  style: "font-style",
  weight: "font-weight",
  stretch: "font-stretch",
  unicodeRange: "unicode-range",
  variant: "font-variant",
  featureSettings: "font-feature-settings"
};


function setupHooks(config) {

  if (window.FontFace) {
    const FontFace = config.window.FontFace;
    let warningFontFaceDisplayed;
    config.window.FontFace = function () {

      if (!warningFontFaceDisplayed) {

        warn("LiveDemo is hooking the FontFace constructor, document.fonts.delete and document.fonts.clear to handle dynamically loaded fonts.");
        warningFontFaceDisplayed = true;
      }
      getDetailObject(...arguments).then(detail => dispatchEvent(new CustomEvent(NEW_FONT_FACE_EVENT, { detail })));
      return new FontFace(...arguments);
    };
    config.window.FontFace.toString = function () { return "function FontFace() { [native code] }"; };
    const deleteFont = document.fonts.delete;
    document.fonts.delete = function (fontFace) {
      getDetailObject(fontFace.family).then(detail => dispatchEvent(new CustomEvent(DELETE_FONT_EVENT, { detail })));
      return deleteFont.call(document.fonts, fontFace);
    };
    document.fonts.delete.toString = function () { return "function delete() { [native code] }"; };
    const clearFonts = document.fonts.clear;
    document.fonts.clear = function () {
      dispatchEvent(new CustomEvent(CLEAR_FONTS_EVENT));
      return clearFonts.call(document.fonts);
    };
    document.fonts.clear.toString = function () { return "function clear() { [native code] }"; };
  }


  var fontFaces = config.fontFaces

  if (document instanceof Document) {

    addEventListener(NEW_FONT_FACE_EVENT, event => {

      const detail = event.detail;
      const key = Object.assign({}, detail);
      delete key.src;

      fontFaces.set(JSON.stringify(key), detail);
    });
    addEventListener(DELETE_FONT_EVENT, event => {

      const detail = event.detail;
      const key = Object.assign({}, detail);
      delete key.src;

      fontFaces.delete(JSON.stringify(key));
    });
    addEventListener(CLEAR_FONTS_EVENT, () => fontFaces = new Map());

    let scriptElement = document.createElement("script");

    // scriptElement.src = "data:," + "(" + injectedScript.toString() + ")()";
    //
    // (document.documentElement || document).appendChild(scriptElement);
    // scriptElement.remove();
    // if (browser && browser.runtime && browser.runtime.getURL) {
    //   scriptElement = document.createElement("script");
    //   scriptElement.src = browser.runtime.getURL("/lib/single-file-hooks-frames.js");
    //   scriptElement.async = false;
    //   (document.documentElement || document).appendChild(scriptElement);
    //   scriptElement.remove();
    // }
  }






  async function getDetailObject(fontFamily, src, descriptors) {
    const detail = {};
    detail["font-family"] = fontFamily;
    detail.src = src;
    if (descriptors) {
      Object.keys(descriptors).forEach(descriptor => {
        if (FONT_STYLE_PROPERTIES[descriptor]) {
          detail[FONT_STYLE_PROPERTIES[descriptor]] = descriptors[descriptor];
        }
      });
    }
    return new Promise(resolve => {
      if (detail.src instanceof ArrayBuffer) {
        const reader = new FileReader();
        reader.readAsDataURL(new Blob([detail.src]));
        reader.addEventListener("load", () => {
          detail.src = "url(" + reader.result + ")";
          resolve(detail);
        });
      } else {
        resolve(detail);
      }
    });
  }

}

export default {
  setupHooks: setupHooks
}
