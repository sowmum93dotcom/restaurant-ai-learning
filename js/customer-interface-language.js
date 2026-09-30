/* A1-20: explicit customer interface language, separate from business-provided content. */
(function (root) {
  "use strict";
  var supported = ["en", "fr", "ar", "es", "pt", "zh", "hi", "de", "ja"];
  var selectable = ["en", "fr", "ar"];
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
    var key = Object.keys(resultCopy.en).find(function (item) { return supported.some(function (source) { return resultCopy[source] && resultCopy[source][item] === value; }); });
    return key ? resultCopy[code][key] : value;
  }
  var staticCopy = {
    en: { saveButton: "Save to My DEMEOS", saveHelp: "Save this confirmed intention to your DEMEOS relationship.", signIn: "Sign in to My DEMEOS if you want to keep this intention across visits.", gallery: "When a relevant business product or service has a business-provided image, you will see that image with the possibility. DEMEOS does not invent product images." },
    fr: { saveButton: "Enregistrer dans Mon DEMEOS", saveHelp: "Enregistrez cette intention confirmée dans votre espace DEMEOS.", signIn: "Connectez-vous à Mon DEMEOS pour conserver cette intention entre vos visites.", gallery: "Lorsqu’un produit ou service pertinent possède une image fournie par l’entreprise, elle apparaît avec la possibilité. DEMEOS n’invente pas d’images de produits." },
    ar: { saveButton: "حفظ في حسابي في DEMEOS", saveHelp: "احفظ هذه النية المؤكدة في حسابك في DEMEOS.", signIn: "سجّل الدخول إلى حسابك في DEMEOS للاحتفاظ بهذه النية بين الزيارات.", gallery: "عندما تتوفر صورة مقدمة من النشاط التجاري لمنتج أو خدمة ذات صلة، ستظهر مع الإمكانية. لا ينشئ DEMEOS صورًا للمنتجات من عنده." }
  };
  var staticSelectors = { saveButton: "#customer-intention-save-button", saveHelp: "#customer-intention-save > p:not([id])", signIn: "#customer-intention-sign-in-note", gallery: ".customer-product-gallery-guide" };
  var possibilityCopy = {
    en: { stageLabel: "Stage 3 · Your possibilities", introduction: "DEMEOS has brought forward a small set of possibilities around your intention.", changeAction: "Change what I’m looking for" },
    fr: { stageLabel: "Étape 3 · Vos possibilités", introduction: "DEMEOS présente un petit ensemble de possibilités liées à votre intention.", changeAction: "Modifier ma recherche" },
    ar: { stageLabel: "المرحلة 3 · إمكانياتك", introduction: "يعرض DEMEOS مجموعة محدودة من الإمكانيات المرتبطة بنيتك.", changeAction: "تغيير ما أبحث عنه" }
  };
  var noMatchCopy = {
    en: { place: "No result matches both your request and the exact town or city you entered. This is not a nearby search. Change or clear the town or city in I know what I want to search without that restriction.", guidance: "You can add useful details such as your location, preferred date, product or service requirements, or change your request. DEMEOS will check again without inventing a match.", detail: "Add more detail", change: "Change my intention", label: "Add customer-provided context about what you want", continue: "Continue", cancel: "Cancel" },
    fr: { place: "Aucun résultat ne correspond à la fois à votre demande et à la ville exacte saisie. Il ne s’agit pas d’une recherche à proximité. Modifiez ou effacez la ville pour supprimer cette restriction.", guidance: "Vous pouvez préciser le lieu, la date souhaitée, le produit ou le service, ou modifier votre demande. DEMEOS vérifiera à nouveau sans inventer de correspondance.", detail: "Ajouter des précisions", change: "Modifier mon intention", label: "Ajoutez des précisions sur votre besoin", continue: "Continuer", cancel: "Annuler" },
    ar: { place: "لا توجد نتيجة تطابق طلبك والمدينة المحددة التي أدخلتها معًا. هذا ليس بحثًا عن الأماكن القريبة. غيّر المدينة أو امسحها للبحث دون هذا القيد.", guidance: "يمكنك إضافة تفاصيل عن الموقع أو التاريخ المفضل أو متطلبات المنتج أو الخدمة، أو تغيير طلبك. سيتحقق DEMEOS مجددًا دون اختلاق تطابق.", detail: "إضافة تفاصيل", change: "تغيير نيتي", label: "أضف تفاصيل عن طلبك", continue: "متابعة", cancel: "إلغاء" }
  };
  var noMatchSelectors = { place: "#customer-no-place-match-note", guidance: ".customer-no-match-guidance", detail: "#customer-add-detail", change: "#customer-empty-change-intention", label: "label[for=customer-add-detail-text]", continue: "#customer-add-detail-form button[type=submit]", cancel: "#customer-add-detail-cancel" };
  var statusCopy = {
    en: ["DEMEOS understands your intention.", "Saved to My Intentions.", "Add a little more detail so DEMEOS can understand your intention.", "Add some detail before continuing.", "Keep your combined detail within 500 characters.", "Your intention could not be saved. Please try again."],
    fr: ["DEMEOS comprend votre intention.", "Enregistré dans Mes intentions.", "Ajoutez quelques précisions pour que DEMEOS comprenne votre intention.", "Ajoutez des précisions avant de continuer.", "Limitez l’ensemble de vos précisions à 500 caractères.", "Votre intention n’a pas pu être enregistrée. Veuillez réessayer."],
    ar: ["يفهم DEMEOS نيتك.", "تم الحفظ في نياتي.", "أضف مزيدًا من التفاصيل حتى يفهم DEMEOS نيتك.", "أضف تفاصيل قبل المتابعة.", "اجعل مجموع التفاصيل في حدود 500 حرف.", "تعذّر حفظ نيتك. يرجى المحاولة مجددًا."]
  };
  var additionalStatuses = {
    en: ["Your intention is ready. No information has been sent.", "Tell DEMEOS what you need before continuing.", "Location cleared for this session.", "Location is optional. You can continue without it.", "Location permission granted. GPS-based matching is not enabled. You can enter a town or city above to filter by an exact business-listed place."],
    fr: ["Votre intention est prête. Aucune information n’a été envoyée.", "Indiquez à DEMEOS ce dont vous avez besoin avant de continuer.", "La position a été effacée pour cette session.", "La position est facultative. Vous pouvez continuer sans elle.", "Autorisation de localisation accordée. La recherche par GPS n’est pas activée. Saisissez une ville ci-dessus pour filtrer selon le lieu exact indiqué par l’entreprise."],
    ar: ["نيتك جاهزة. لم تُرسل أي معلومات.", "أخبر DEMEOS بما تحتاج إليه قبل المتابعة.", "تم مسح الموقع لهذه الجلسة.", "الموقع اختياري. يمكنك المتابعة دونه.", "تم منح إذن الموقع. المطابقة باستخدام GPS غير مفعلة. يمكنك إدخال مدينة أعلاه للتصفية حسب الموقع المحدد من النشاط التجاري."]
  };
  function localizeStatus(value, language) {
    var code = normalize(language);
    var index = -1;
    supported.some(function (source) { index = statusCopy[source] ? statusCopy[source].indexOf(value) : -1; return index >= 0; });
    if (index >= 0) return statusCopy[code][index];
    supported.some(function (source) { index = additionalStatuses[source] ? additionalStatuses[source].indexOf(value) : -1; return index >= 0; });
    return index >= 0 ? additionalStatuses[code][index] : value;
  }
  var feedbackCopy = {
    en: ["Stage 6 · Continue with DEMEOS", "Help DEMEOS understand better", "Did this possibility fit what you were looking for?", "Yes, this was relevant", "Not quite", "I need something different", "Tell DEMEOS a little more (optional)", "Share feedback", "Choose one response before sharing feedback.", "DEMEOS could not share your feedback. Please try again.", "Thank you. Your feedback will help DEMEOS understand better.", "Explore my possibilities", "Start with a new intention"],
    fr: ["Étape 6 · Continuer avec DEMEOS", "Aidez DEMEOS à mieux comprendre", "Cette possibilité correspondait-elle à votre recherche ?", "Oui, c’était pertinent", "Pas tout à fait", "J’ai besoin d’autre chose", "Donnez quelques précisions à DEMEOS (facultatif)", "Envoyer mon avis", "Choisissez une réponse avant d’envoyer votre avis.", "DEMEOS n’a pas pu envoyer votre avis. Veuillez réessayer.", "Merci. Votre avis aidera DEMEOS à mieux comprendre.", "Explorer mes possibilités", "Commencer avec une nouvelle intention"],
    ar: ["المرحلة 6 · المتابعة مع DEMEOS", "ساعد DEMEOS على فهمك بشكل أفضل", "هل كانت هذه الإمكانية مناسبة لما تبحث عنه؟", "نعم، كانت ذات صلة", "ليس تمامًا", "أحتاج إلى شيء مختلف", "أخبر DEMEOS بالمزيد (اختياري)", "إرسال الملاحظات", "اختر إجابة قبل إرسال الملاحظات.", "تعذّر إرسال ملاحظاتك إلى DEMEOS. يرجى المحاولة مجددًا.", "شكرًا لك. ستساعد ملاحظاتك DEMEOS على فهمك بشكل أفضل.", "استكشاف إمكانياتي", "البدء بنية جديدة"]
  };
  function localizeFeedback(value, language) {
    var code = normalize(language), index = -1;
    supported.some(function (source) { index = feedbackCopy[source] ? feedbackCopy[source].indexOf(value) : -1; return index >= 0; });
    return index >= 0 ? feedbackCopy[code][index] : value;
  }
  var discoverCopy = {
    en: ["Discover", "Explore business images, products and services.", "Tell DEMEOS", "Describe what you want for relevant possibilities.", "My DEMEOS", "Keep your confirmed interests in your private space.", "Looking for something specific?", "Tell DEMEOS what you need and explore supported business possibilities.", "I know what I want", "Nothing to discover just yet", "There is nothing new to explore right now. Please check back soon.", "Loading approved work…"],
    fr: ["Découvrir", "Explorez les images, produits et services des entreprises.", "Parlez à DEMEOS", "Décrivez votre besoin pour découvrir des possibilités pertinentes.", "Mon DEMEOS", "Conservez vos intérêts confirmés dans votre espace privé.", "Vous cherchez quelque chose de précis ?", "Indiquez votre besoin à DEMEOS et explorez les possibilités proposées par les entreprises.", "Je sais ce que je veux", "Rien à découvrir pour le moment", "Il n’y a rien de nouveau à explorer actuellement. Revenez bientôt.", "Chargement des contenus approuvés…"],
    ar: ["استكشف", "استكشف صور الأنشطة التجارية ومنتجاتها وخدماتها.", "أخبر DEMEOS", "صف ما تريده للاطلاع على الإمكانيات ذات الصلة.", "حسابي في DEMEOS", "احتفظ باهتماماتك المؤكدة في مساحتك الخاصة.", "هل تبحث عن شيء محدد؟", "أخبر DEMEOS بما تحتاج إليه واستكشف الإمكانيات المدعومة من الأنشطة التجارية.", "أعرف ما أريد", "لا يوجد ما يمكن استكشافه بعد", "لا يوجد محتوى جديد لاستكشافه الآن. يرجى العودة لاحقًا.", "جارٍ تحميل المحتوى المعتمد…"]
  };
  var discoverSelectors = [".customer-section-heading .customer-step", ".customer-discover-entry-guide > div:nth-child(1) > span:last-child", ".customer-discover-entry-guide > div:nth-child(2) > strong", ".customer-discover-entry-guide > div:nth-child(2) > span:last-child", ".customer-discover-entry-guide > div:nth-child(3) > strong", ".customer-discover-entry-guide > div:nth-child(3) > span:last-child", ".customer-connection-entry > div > strong", ".customer-connection-entry > div > span", ".customer-connection-action"];
  function localizeDiscoverStatus(value, language) {
    var code = normalize(language), index = -1;
    supported.some(function (source) { index = discoverCopy[source] ? discoverCopy[source].indexOf(value) : -1; return index >= 0; });
    return index >= 0 ? discoverCopy[code][index] : value;
  }
  /* Register additional approved UI catalogues without enabling incomplete journeys. */
  function registerAdditional(target, source, field) {
    if (!source) return;
    ["es", "pt", "zh", "hi", "de", "ja"].forEach(function (code) {
      if (source[code] && (!field || source[code][field])) target[code] = field ? source[code][field] : source[code];
    });
  }
  var navigationKeys = ["discover","know","my","language","explore","question","trust","place","continue","useLocation","clearLocation"];
  if (root.DEMEOSNavigationAdditionalCopy) {
    ["es","pt","zh","hi","de","ja"].forEach(function (code) {
      var entry = root.DEMEOSNavigationAdditionalCopy[code];
      if (entry && navigationKeys.every(function (key) { return typeof entry[key] === "string"; })) {
        copy[code] = navigationKeys.map(function (key) { return entry[key]; });
      }
    });
  }
  registerAdditional(noMatchCopy, root.DEMEOSNoMatchAdditionalCopy);
  registerAdditional(staticCopy, root.DEMEOSSaveAdditionalCopy);
  if (root.DEMEOSFeedbackAdditionalCopy) {
    ["es","pt","zh","hi","de","ja"].forEach(function (code) {
      var entry = root.DEMEOSFeedbackAdditionalCopy[code];
      if (entry && entry.length === feedbackCopy.en.length) feedbackCopy[code] = entry;
    });
  }
  if (root.DEMEOSStatusAdditionalCopy) {
    ["es","pt","zh","hi","de","ja"].forEach(function (code) {
      var entry = root.DEMEOSStatusAdditionalCopy[code];
      if (entry && entry.status && entry.status.length === statusCopy.en.length && entry.additional && entry.additional.length === additionalStatuses.en.length) {
        statusCopy[code] = entry.status;
        additionalStatuses[code] = entry.additional;
      }
    });
  }
  registerAdditional(discoverCopy, root.DEMEOSDiscoverAdditionalCopy);
  registerAdditional(intentionLabels, root.DEMEOSIntentionAdditionalCopy, "intentionLabels");
  registerAdditional(confirmationCopy, root.DEMEOSConfirmationAdditionalCopy);
  registerAdditional(resultCopy, root.DEMEOSResultsAdditionalCopy);
  registerAdditional(possibilityCopy, root.DEMEOSPossibilitiesAdditionalCopy);
  var additionalJourneyKeys = Object.keys(journeyCopy.en);
  if (root.DEMEOSIntentionAdditionalCopy) {
    ["es", "pt", "zh", "hi", "de", "ja"].forEach(function (code) {
      var entry = root.DEMEOSIntentionAdditionalCopy[code];
      if (entry && entry.journeyCopy && entry.journeyCopy.length === additionalJourneyKeys.length) {
        journeyCopy[code] = {};
        additionalJourneyKeys.forEach(function (key, index) { journeyCopy[code][key] = entry.journeyCopy[index]; });
      }
    });
  }
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
    root.document.querySelectorAll("[data-possibilities-copy]").forEach(function (element) {
      var key = element.getAttribute("data-possibilities-copy");
      if (Object.prototype.hasOwnProperty.call(possibilityCopy[code], key)) element.textContent = possibilityCopy[code][key];
    });
    Object.keys(noMatchSelectors).forEach(function (key) {
      var element = root.document.querySelector(noMatchSelectors[key]);
      if (element) element.textContent = noMatchCopy[code][key];
    });
    root.document.querySelectorAll(".customer-feedback").forEach(function (panel) {
      panel.querySelectorAll(".customer-stage-label, .customer-feedback-heading, .customer-feedback-question, .customer-feedback-choice span, .customer-feedback-comment-label, .customer-feedback-submit, .customer-feedback-result, .customer-feedback-explore, .customer-feedback-restart").forEach(function (element) {
        element.textContent = localizeFeedback(element.textContent, code);
      });
    });
    discoverSelectors.forEach(function (selector, index) {
      var element = root.document.querySelector(selector);
      if (!element) return;
      if (index === 8) {
        var label = element.firstChild;
        if (label && label.nodeType === 3) label.textContent = discoverCopy[code][index] + " ";
      } else element.textContent = discoverCopy[code][index];
    });
    var firstGuide = root.document.querySelector(".customer-discover-entry-guide > div:nth-child(1) > strong");
    if (firstGuide) firstGuide.textContent = discoverCopy[code][0];
    var status = root.document.getElementById("customer-work-status");
    if (status) {
      if (status.classList.contains("customer-empty-state")) {
        var emptyTitle = status.querySelector("strong"), emptyBody = status.querySelector("span");
        if (emptyTitle) emptyTitle.textContent = discoverCopy[code][9];
        if (emptyBody) emptyBody.textContent = discoverCopy[code][10];
      } else status.textContent = localizeDiscoverStatus(status.textContent, code);
    }
    var heading = root.document.getElementById("customer-possibilities-heading");
    if (heading) heading.textContent = localizeResult(heading.textContent, code);
    var emptyHeading = root.document.getElementById("customer-no-possibilities-heading");
    if (emptyHeading) emptyHeading.textContent = resultCopy[code].none;
    ["customer-understanding-status", "customer-intention-save-status", "customer-add-detail-status", "customer-intention-status", "customer-location-status"].forEach(function (id) {
      var element = root.document.getElementById(id);
      if (element) element.textContent = localizeStatus(element.textContent, code);
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
    if (typeof root.MutationObserver === "function") {
      ["customer-understanding-status", "customer-intention-save-status", "customer-add-detail-status"].forEach(function (id) {
        var element = root.document.getElementById(id);
        if (!element) return;
        var observer = new root.MutationObserver(function () {
          var selected = root.document.getElementById("customer-language");
          var localized = localizeStatus(element.textContent, selected ? selected.value : "en");
          if (localized !== element.textContent) element.textContent = localized;
        });
        observer.observe(element, { childList: true, characterData: true, subtree: true });
      });
    }
    var focused = root.document.getElementById("customer-focused-possibility");
    if (focused && typeof root.MutationObserver === "function") {
      var feedbackObserver = new root.MutationObserver(function () {
        var selected = root.document.getElementById("customer-language");
        var code = selected ? selected.value : "en";
        focused.querySelectorAll(".customer-feedback .customer-stage-label, .customer-feedback .customer-feedback-heading, .customer-feedback .customer-feedback-question, .customer-feedback .customer-feedback-choice span, .customer-feedback .customer-feedback-comment-label, .customer-feedback .customer-feedback-submit, .customer-feedback .customer-feedback-result, .customer-feedback .customer-feedback-explore, .customer-feedback .customer-feedback-restart").forEach(function (element) {
          var localized = localizeFeedback(element.textContent, code);
          if (localized !== element.textContent) element.textContent = localized;
        });
      });
      feedbackObserver.observe(focused, { childList: true, characterData: true, subtree: true });
    }
    var discoverStatus = root.document.getElementById("customer-work-status");
    if (discoverStatus && typeof root.MutationObserver === "function") {
      var discoverObserver = new root.MutationObserver(function () {
        var selected = root.document.getElementById("customer-language");
        var code = selected ? selected.value : "en";
        if (discoverStatus.classList.contains("customer-empty-state")) {
          var title = discoverStatus.querySelector("strong"), body = discoverStatus.querySelector("span");
          if (title && title.textContent !== discoverCopy[code][9]) title.textContent = discoverCopy[code][9];
          if (body && body.textContent !== discoverCopy[code][10]) body.textContent = discoverCopy[code][10];
        } else {
          var translated = localizeDiscoverStatus(discoverStatus.textContent, code);
          if (translated !== discoverStatus.textContent) discoverStatus.textContent = translated;
        }
      });
      discoverObserver.observe(discoverStatus, { childList: true, characterData: true, subtree: true });
    }
    var preferred = getSaved() || (root.navigator && root.navigator.language) || "en";
    apply(preferred);
    select.addEventListener("change", function () { var code = apply(select.value); setSaved(code); });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { normalize: normalize, copy: copy, intentionLabels: intentionLabels, journeyCopy: journeyCopy, confirmationCopy: confirmationCopy, resultCopy: resultCopy, localizeResult: localizeResult, staticCopy: staticCopy, possibilityCopy: possibilityCopy, noMatchCopy: noMatchCopy, statusCopy: statusCopy, localizeStatus: localizeStatus, additionalStatuses: additionalStatuses, feedbackCopy: feedbackCopy, localizeFeedback: localizeFeedback, discoverCopy: discoverCopy, localizeDiscoverStatus: localizeDiscoverStatus };
  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start);
    else start();
  }
}(typeof window !== "undefined" ? window : {}));
