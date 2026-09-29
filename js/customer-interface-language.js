/* A1-20: explicit customer interface language, separate from business-provided content. */
(function (root) {
  "use strict";
  var supported = ["en", "fr", "ar"];
  var copy = {
    en: ["Discover", "I know what I want", "My DEMEOS", "Language", "Explore businesses", "What would you like to do today?", "Tell DEMEOS what you need. You stay in control.", "Town or city (optional, exact business-listed location)", "Continue", "Use my location", "Clear location"],
    fr: ["Découvrir", "Je sais ce que je veux", "Mon DEMEOS", "Langue", "Explorer les entreprises", "Que souhaitez-vous faire aujourd’hui ?", "Dites à DEMEOS ce dont vous avez besoin. Vous gardez le contrôle.", "Ville (facultatif, lieu exact indiqué par l’entreprise)", "Continuer", "Utiliser ma position", "Effacer la position"],
    ar: ["استكشف", "أعرف ما أريد", "حسابي في DEMEOS", "اللغة", "استكشف الأنشطة التجارية", "ماذا تود أن تفعل اليوم؟", "أخبر DEMEOS بما تحتاج إليه. أنت المتحكم.", "المدينة (اختياري، الموقع المحدد من النشاط التجاري)", "متابعة", "استخدم موقعي", "مسح الموقع"]
  };
  var selectors = [".customer-journey-nav a:nth-child(1)", ".customer-journey-nav a:nth-child(2)", ".customer-journey-nav a:nth-child(3)", "#customer-language-label", "#customer-work-heading", "#customer-intention-heading", "#customer-intention-lead", "label[for=customer-place]", "#customer-intention-continue", "#customer-use-location", "#customer-clear-location"];
  function normalize(value) { var code = String(value || "").toLowerCase().split("-")[0]; return supported.indexOf(code) >= 0 ? code : "en"; }
  function getSaved() { try { return root.localStorage.getItem("demeos-customer-language"); } catch (_) { return null; } }
  function setSaved(value) { try { root.localStorage.setItem("demeos-customer-language", value); } catch (_) {} }
  function apply(language) {
    var code = normalize(language);
    root.document.documentElement.lang = code;
    root.document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    selectors.forEach(function (selector, index) {
      var element = root.document.querySelector(selector);
      if (element) element.textContent = copy[code][index];
    });
    var control = root.document.getElementById("customer-language");
    if (control) control.value = code;
    return code;
  }
  function start() {
    var nav = root.document.querySelector(".customer-journey-nav");
    if (!nav) return;
    var wrapper = root.document.createElement("div");
    wrapper.className = "customer-language-control";
    var label = root.document.createElement("label");
    label.id = "customer-language-label";
    label.htmlFor = "customer-language";
    var select = root.document.createElement("select");
    select.id = "customer-language";
    select.setAttribute("aria-label", "Customer interface language");
    [["en","English"],["fr","Français"],["ar","العربية"]].forEach(function (pair) {
      var option = root.document.createElement("option"); option.value = pair[0]; option.textContent = pair[1]; select.appendChild(option);
    });
    wrapper.appendChild(label); wrapper.appendChild(select);
    nav.parentNode.insertBefore(wrapper, nav.nextSibling);
    var preferred = getSaved() || (root.navigator && root.navigator.language) || "en";
    apply(preferred);
    select.addEventListener("change", function () { var code = apply(select.value); setSaved(code); });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { normalize: normalize, copy: copy };
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start);
    else start();
  }
}(typeof window !== "undefined" ? window : {}));
