/* Shared Marketing Agent language definitions. Availability is separate from approval. */
(function (root) {
  "use strict";
  var languages = Object.freeze([
    Object.freeze({code:"en",name:"English",direction:"ltr"}),
    Object.freeze({code:"es",name:"Español",direction:"ltr"}),
    Object.freeze({code:"fr",name:"Français",direction:"ltr"}),
    Object.freeze({code:"ar",name:"العربية",direction:"rtl"}),
    Object.freeze({code:"pt",name:"Português",direction:"ltr"}),
    Object.freeze({code:"zh",name:"简体中文",direction:"ltr"}),
    Object.freeze({code:"hi",name:"हिन्दी",direction:"ltr"}),
    Object.freeze({code:"de",name:"Deutsch",direction:"ltr"}),
    Object.freeze({code:"ja",name:"日本語",direction:"ltr"})
  ]);
  function resolve(code) {
    var normalized=String(code||"").toLowerCase().split("-")[0];
    return languages.find(function (language) { return language.code===normalized; }) || languages[0];
  }
  var registry=Object.freeze({languages:languages,resolve:resolve,defaultCode:"en"});
  if (typeof module!=="undefined" && module.exports) module.exports=registry;
  root.DEMEOSLanguageRegistry=registry;
}(typeof window!=="undefined"?window:{}));
