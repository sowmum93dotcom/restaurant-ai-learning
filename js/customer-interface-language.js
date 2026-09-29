/* A1-20: explicit customer interface language, separate from business-provided content. */
(function (root) {
  "use strict";
  var supported = ["en", "fr", "ar"];
  var copy = {
    en: ["Discover", "I know what I want", "My DEMEOS", "Language", "Explore businesses", "What would you like to do today?", "Tell DEMEOS what you need. You stay in control.", "Town or city (optional, exact business-listed location)", "Continue", "Use my location", "Clear location"],
    fr: ["Découvrir", "Je sais ce que je veux", "Mon DEMEOS", "Langue", "Explorer les entreprises", "Que souhaitez-vous faire aujourd’hui ?", "Dites à DEMEOS ce dont vous avez besoin. Vous gardez le contrôle.", "Ville (facultatif, lieu exact indiqué par l’entreprise)", "Continuer", "Utiliser ma position", "Effacer la position"],
    ar: ["استكشف", "أعرف ما أريد", "حسابي في DEMEOS", "اللغة", "استكشف الأنشطة التجارية", "ماذا تود أن تفعل اليوم؟", "أخبر DEMEOS بما تحتاج إليه. أنت المتحكم.", "المدينة (اختياري، الموقع المحدد من النشاط التجاري)", "متابعة", "استخدم موقعي", "مسح الموقع"]
  };
  var selectors = [".customer-journey-nav a:nth-child(1)", ".customer-journey-nav a:nth-child(2)", ".customer-journey-nav a:nth-child(3)", "#customer-language-label", "#customer-work-heading", "label[for=customer-place]", "#customer-location-clear"];
  var intentionLabels = {
    en: ["Eat & enjoy", "Take care of myself", "Spend time together", "Get something done", "Go somewhere", "Discover something new"],
    fr: ["Manger et profiter", "Prendre soin de moi", "Passer du temps ensemble", "Accomplir quelque chose", "Aller quelque part", "Découvrir quelque chose de nouveau"],
    ar: ["الطعام والاستمتاع", "العناية بنفسي", "قضاء الوقت معًا", "إنجاز شيء", "الذهاب إلى مكان ما", "اكتشاف شيء جديد"]
  };
  var journeyCopy = {
    en: { stageLabel: "Stage 1 · Your intention", question: "What would you like to do today?", trust: "Tell DEMEOS what you need. You stay in control.", intentionLegend: "Choose an intention", textLabel: "Describe what you need in your own words (optional)", textPlaceholder: "For example, I would like a relaxed place to spend time together.", locationAction: "Use my location", continueAction: "Continue" },
    fr: { stageLabel: "Étape 1 · Votre intention", question: "Que souhaitez-vous faire aujourd’hui ?", trust: "Dites à DEMEOS ce dont vous avez besoin. Vous gardez le contrôle.", intentionLegend: "Choisissez une intention", textLabel: "Décrivez votre besoin avec vos propres mots (facultatif)", textPlaceholder: "Par exemple, je souhaite trouver un endroit calme pour passer du temps ensemble.", locationAction: "Utiliser ma position", continueAction: "Continuer" },
    ar: { stageLabel: "المرحلة 1 · نيتك", question: "ماذا تود أن تفعل اليوم؟", trust: "أخبر DEMEOS بما تحتاج إليه. أنت المتحكم.", intentionLegend: "اختر نيتك", textLabel: "صف ما تحتاج إليه بكلماتك (اختياري)", textPlaceholder: "على سبيل المثال، أريد مكانًا هادئًا لقضاء الوقت معًا.", locationAction: "استخدم موقعي", continueAction: "متابعة" }
  };
  var confirmationCopy = {
    en: { stageLabel: "Stage 2 · DEMEOS understands", heading: "Here’s what DEMEOS understands.", clarificationLabel: "What would you like help getting done?", clarificationAction: "Update understanding", confirmAction: "Yes, continue", changeAction: "Change this", foundationTrust: "DEMEOS will use your intention to look for relevant Solution, Participation, Convenience and Experience." },
    fr: { stageLabel: "Étape 2 · DEMEOS comprend", heading: "Voici ce que DEMEOS a compris.", clarificationLabel: "Que souhaitez-vous accomplir ?", clarificationAction: "Mettre à jour", confirmAction: "Oui, continuer", changeAction: "Modifier", foundationTrust: "DEMEOS utilisera votre intention pour rechercher des solutions, des possibilités de participation, de la commodité et des expériences pertinentes." },
    ar: { stageLabel: "المرحلة 2 · يفهم DEMEOS", heading: "هذا ما فهمه DEMEOS.", clarificationLabel: "ما الذي تريد المساعدة في إنجازه؟", clarificationAction: "تحديث الفهم", confirmAction: "نعم، متابعة", changeAction: "تعديل", foundationTrust: "سيستخدم DEMEOS نيتك للبحث عن الحلول والمشاركة والراحة والتجارب ذات الصلة." }
  };
  var resultCopy = {
    en: { none: "DEMEOS doesn’t have a sufficiently supported possibility yet.", found: "Your possibilities", preparing: "Preparing possibilities connected to what you asked for…", error: "DEMEOS could not prepare possibilities. Please try again." },
    fr: { none: "DEMEOS ne dispose pas encore d’une possibilité suffisamment étayée.", found: "Vos possibilités", preparing: "Préparation des possibilités liées à votre demande…", error: "DEMEOS n’a pas pu préparer les possibilités. Veuillez réessayer." },
    ar: { none: "لا تتوفر لدى DEMEOS بعد إمكانية مدعومة بمعلومات كافية.", found: "إمكانياتك", preparing: "جارٍ إعداد الإمكانيات المرتبطة بطلبك…", error: "تعذّر على DEMEOS إعداد الإمكانيات. يرجى المحاولة مجددًا." }
  };
  function localizeResult(value, language) {
    var code = normalize(language);
    var key = Object.keys(resultCopy.en).find(function (item) { return supported.some(function (source) { return resultCopy[source][item] === value; }); });
    return key ? resultCopy[code][key] : value;
  }
  var staticCopy = {
    en: { saveButton: "Save to My DEMEOS", saveHelp: "Save this confirmed intention to your DEMEOS relationship.", signIn: "Sign in to My DEMEOS if you want to keep this intention across visits.", gallery: "When a relevant business product or service has a business-provided image, you will see that image with the possibility. DEMEOS does not invent product images." },
    fr: { saveButton: "Enregistrer dans Mon DEMEOS", saveHelp: "Enregistrez cette intention confirmée dans votre espace DEMEOS.", signIn: "Connectez-vous à Mon DEMEOS pour conserver cette intention entre vos visites.", gallery: "Lorsqu’un produit ou service pertinent possède une image fournie par l’entreprise, elle apparaît avec la possibilité. DEMEOS n’invente pas d’images de produits." },
    ar: { saveButton: "حفظ في حسابي في DEMEOS", saveHelp: "احفظ هذه النية المؤكدة في حسابك في DEMEOS.", signIn: "سجّل الدخول إلى حسابك في DEMEOS للاحتفاظ بهذه النية بين الزيارات.", gallery: "عندما تتوفر صورة مقدمة من النشاط التجاري لمنتج أو خدمة ذات صلة، ستظهر مع الإمكانية. لا ينشئ DEMEOS صورًا للمنتجات من عنده." }
  };
  var staticSelectors = { saveButton: "#customer-intention-save-button", saveHelp: "#customer-intention-save > p:not([id])", signIn: "#customer-intention-sign-in-note", gallery: ".customer-product-gallery-guide" };
  function normalize(value) { var code = String(value || "").toLowerCase().split("-")[0]; return supported.indexOf(code) >= 0 ? code : "en"; }
  function getSaved() { try { return root.localStorage.getItem("demeos-customer-language"); } catch (_) { return null; } }
  function setSaved(value) { try { root.localStorage.setItem("demeos-customer-language", value); } catch (_) {} }
  function apply(language) {
    var code = normalize(language);
    root.document.documentElement.lang = code;
    root.document.documentElement.dir = code === "ar" ? "rtl" : "ltr";
    selectors.forEach(function (selector, index) {
      var element = root.document.querySelector(selector);
      if (element) element.textContent = copy[code][index < 5 ? index : (index === 5 ? 7 : 10)];
    });
    root.document.querySelectorAll("#customer-intention-options .customer-intention-option").forEach(function (button) {
      var canonical = button.getAttribute("data-canonical-intention") || button.textContent;
      var index = intentionLabels.en.indexOf(canonical);
      if (index >= 0) { button.setAttribute("data-canonical-intention", canonical); button.textContent = intentionLabels[code][index]; }
    });
    root.document.querySelectorAll("[data-stage-copy]").forEach(function (element) {
      var key = element.getAttribute("data-stage-copy");
      if (Object.prototype.hasOwnProperty.call(journeyCopy[code], key)) element.textContent = journeyCopy[code][key];
    });
    root.document.querySelectorAll("[data-stage-placeholder]").forEach(function (element) {
      var key = element.getAttribute("data-stage-placeholder");
      if (Object.prototype.hasOwnProperty.call(journeyCopy[code], key)) element.setAttribute("placeholder", journeyCopy[code][key]);
    });
    root.document.querySelectorAll("[data-understanding-copy]").forEach(function (element) {
      var key = element.getAttribute("data-understanding-copy");
      if (Object.prototype.hasOwnProperty.call(confirmationCopy[code], key)) element.textContent = confirmationCopy[code][key];
    });
    Object.keys(staticSelectors).forEach(function (key) {
      var element = root.document.querySelector(staticSelectors[key]);
      if (element) element.textContent = staticCopy[code][key];
    });
    var heading = root.document.getElementById("customer-possibilities-heading");
    if (heading) heading.textContent = localizeResult(heading.textContent, code);
    var emptyHeading = root.document.getElementById("customer-no-possibilities-heading");
    if (emptyHeading) emptyHeading.textContent = resultCopy[code].none;
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
    var resultHeading = root.document.getElementById("customer-possibilities-heading");
    if (resultHeading && typeof root.MutationObserver === "function") {
      var resultObserver = new root.MutationObserver(function () {
        var current = resultHeading.textContent;
        var selected = root.document.getElementById("customer-language");
        var localized = localizeResult(current, selected ? selected.value : "en");
        if (localized !== current) resultHeading.textContent = localized;
      });
      resultObserver.observe(resultHeading, { childList: true, characterData: true, subtree: true });
    }
    var preferred = getSaved() || (root.navigator && root.navigator.language) || "en";
    apply(preferred);
    select.addEventListener("change", function () { var code = apply(select.value); setSaved(code); });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { normalize: normalize, copy: copy, intentionLabels: intentionLabels, journeyCopy: journeyCopy, confirmationCopy: confirmationCopy, resultCopy: resultCopy, localizeResult: localizeResult, staticCopy: staticCopy };
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start);
    else start();
  }
}(typeof window !== "undefined" ? window : {}));
