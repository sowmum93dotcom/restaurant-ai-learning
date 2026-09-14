function addText(document, parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function normalizedRequiredString(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

const CUSTOMER_STAGE_ONE_COPY = Object.freeze({
  stageLabel: "Stage 1 · Your intention",
  question: "What would you like to do today?",
  trust: "Tell DEMEOS what you need. You stay in control.",
  intentionLegend: "Choose an intention",
  intentions: Object.freeze([
    "Eat & enjoy", "Take care of myself", "Spend time together",
    "Get something done", "Go somewhere", "Discover something new"
  ]),
  textLabel: "Describe what you need in your own words (optional)",
  textPlaceholder: "For example, I would like a relaxed place to spend time together.",
  locationAction: "Use my location",
  locationAvailable: "Location available for this session.",
  locationOptional: "Location is optional. You can continue without it.",
  continueAction: "Continue",
  continueReady: "Your intention is ready. No information has been sent.",
  approvedWorkLink: "View approved work",
  greetings: Object.freeze({ morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" })
});

function getLocalGreeting(value) {
  const hour = value instanceof Date ? value.getHours() : Number(value);
  if (Number.isFinite(hour) && hour >= 5 && hour < 12) return CUSTOMER_STAGE_ONE_COPY.greetings.morning;
  if (Number.isFinite(hour) && hour >= 12 && hour < 18) return CUSTOMER_STAGE_ONE_COPY.greetings.afternoon;
  return CUSTOMER_STAGE_ONE_COPY.greetings.evening;
}

function getPreferredLanguage(navigatorValue) {
  if (!navigatorValue || typeof navigatorValue !== "object") return "en";
  const languages = Array.isArray(navigatorValue.languages) ? navigatorValue.languages : [];
  return normalizedRequiredString(languages[0]) || normalizedRequiredString(navigatorValue.language) || "en";
}

function normalizedCustomerIntention(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ");
}

function selectCustomerIntention(value) {
  return CUSTOMER_STAGE_ONE_COPY.intentions.includes(value) ? value : "";
}

function requestCustomerLocation(geolocation, onState) {
  if (!geolocation || typeof geolocation.getCurrentPosition !== "function") {
    onState("optional");
    return;
  }
  geolocation.getCurrentPosition(function () { onState("available"); }, function () { onState("optional"); });
}

function initializeCustomerIntention(document, navigatorValue, now) {
  const greeting = document.getElementById("customer-greeting");
  if (!greeting) return;
  document.querySelectorAll("[data-stage-copy]").forEach(function (element) {
    element.textContent = CUSTOMER_STAGE_ONE_COPY[element.getAttribute("data-stage-copy")] || "";
  });
  document.querySelectorAll("[data-stage-placeholder]").forEach(function (element) {
    element.setAttribute("placeholder", CUSTOMER_STAGE_ONE_COPY[element.getAttribute("data-stage-placeholder")] || "");
  });
  greeting.textContent = getLocalGreeting(now || new Date());
  document.documentElement.dataset.preferredLanguage = getPreferredLanguage(navigatorValue);

  const options = document.getElementById("customer-intention-options");
  let selectedIntention = "";
  CUSTOMER_STAGE_ONE_COPY.intentions.forEach(function (label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "customer-intention-option";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", function () {
      selectedIntention = selectCustomerIntention(label);
      Array.from(options.children).forEach(function (option) {
        option.setAttribute("aria-pressed", String(option === button));
      });
    });
    options.appendChild(button);
  });

  const locationStatus = document.getElementById("customer-location-status");
  document.getElementById("customer-location-button").addEventListener("click", function () {
    requestCustomerLocation(navigatorValue && navigatorValue.geolocation, function (state) {
      locationStatus.textContent = state === "available" ? CUSTOMER_STAGE_ONE_COPY.locationAvailable : CUSTOMER_STAGE_ONE_COPY.locationOptional;
    });
  });
  document.getElementById("customer-intention-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const freeText = normalizedCustomerIntention(document.getElementById("customer-intention-text").value);
    document.getElementById("customer-intention-status").textContent = (selectedIntention || freeText) ? CUSTOMER_STAGE_ONE_COPY.continueReady : "";
  });
}

function toCustomerWorkItem(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const workItemId = normalizedRequiredString(item.workItemId);
  const businessName = normalizedRequiredString(item.businessName);
  const content = normalizedRequiredString(item.content);
  if (!workItemId || !businessName || !content || item.participationAction !== "Interested") return null;

  const publicItem = { workItemId, businessName, content, participationAction: "Interested" };
  if (typeof item.location === "string" && item.location.trim()) publicItem.location = item.location.trim();
  return publicItem;
}

function getValidCustomerWork(work) {
  if (!Array.isArray(work)) return [];
  return work.map(toCustomerWorkItem).filter(Boolean);
}

function createCustomerWorkCard(document, work, customerPackages, recordParticipation, anchorJourney) {
  const card = document.createElement("article");
  card.className = "customer-work-card";

  const context = document.createElement("header");
  context.className = "customer-work-context";
  if (anchorJourney) context.id = "understand";
  const identity = document.createElement("div");
  addText(document, identity, "p", "customer-step", "02 · Understand");
  addText(document, identity, "h3", "customer-business-name", work.businessName);
  if (work.location) addText(document, identity, "p", "customer-work-location", work.location);
  context.appendChild(identity);
  addText(document, context, "span", "customer-approved-mark", "Approved for customers");

  const message = document.createElement("section");
  message.className = "customer-message";
  message.setAttribute("aria-label", `Message from ${work.businessName}`);
  addText(document, message, "p", "customer-message-label", "Customer message");
  addText(document, message, "p", "customer-work-content", work.content);

  const choice = document.createElement("section");
  choice.className = "customer-choice";
  if (anchorJourney) choice.id = "choose";
  addText(document, choice, "p", "customer-step", "03 · Choose");
  addText(document, choice, "h4", "customer-choice-title", "Customer options");
  const packageRegion = document.createElement("div");
  packageRegion.className = "customer-package-region";
  packageRegion.setAttribute("aria-live", "polite");
  if (!customerPackages.length) {
    addText(document, packageRegion, "p", "customer-package-empty", "Customer options will appear here when available.");
  }
  choice.appendChild(packageRegion);

  const participation = document.createElement("section");
  participation.className = "customer-participation";
  if (anchorJourney) participation.id = "participate";
  const participationCopy = document.createElement("div");
  addText(document, participationCopy, "p", "customer-step", "04 · Participate");
  addText(document, participationCopy, "h4", "customer-participation-title", "Interested in this work?");
  addText(document, participationCopy, "p", "customer-participation-copy", "Interested is an interest signal only. It is not a purchase, booking or sale.");
  const action = document.createElement("button");
  action.className = "customer-participation-button";
  action.textContent = work.participationAction;
  action.type = "button";
  participation.append(participationCopy, action);

  const result = document.createElement("p");
  result.className = "customer-participation-confirmation";
  result.setAttribute("aria-live", "polite");
  action.addEventListener("click", async function () {
    action.disabled = true;
    try {
      await recordParticipation(work);
      action.textContent = "Interest shared";
      result.textContent = "Thank you. Your participation signal has been shared with this business.";
      card.className += " is-participating";
    } catch (error) {
      action.disabled = false;
      result.textContent = error.message;
    }
  });

  card.append(context, message, choice, participation, result);
  return card;
}

async function recordParticipation(work) {
  const workItemId = work && normalizedRequiredString(work.workItemId);
  if (!workItemId || work.participationAction !== "Interested") {
    throw new Error("DEMEOS could not share your interest. Please try again.");
  }
  const response = await fetch(`/api/customer/work/${encodeURIComponent(workItemId)}/participation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "Interested" })
  });
  if (!response.ok) throw new Error("DEMEOS could not share your interest. Please try again.");
}

function renderCustomerWork(document, work, customerPackages, participationRecorder) {
  const status = document.getElementById("customer-work-status");
  const list = document.getElementById("customer-work-list");
  list.textContent = "";
  const validWork = getValidCustomerWork(work);
  const validPackages = Array.isArray(customerPackages) ? customerPackages : [];
  if (!validWork.length) {
    status.className = "customer-empty-state";
    status.innerHTML = "<strong>Nothing to discover just yet</strong><span>No approved customer work is available. Please check back soon.</span>";
    return;
  }
  status.textContent = "";
  status.className = "customer-work-status";
  validWork.forEach(function (item, index) {
    list.appendChild(createCustomerWorkCard(document, item, validPackages, participationRecorder, index === 0));
  });
}

function getServerCustomerPackages(data) {
  return Array.isArray(data.customerPackages) ? data.customerPackages : [];
}

async function loadCustomerWork(document, fetcher) {
  const status = document.getElementById("customer-work-status");
  try {
    const response = await fetcher("/api/customer/work");
    const data = await response.json();
    if (!response.ok || !data || !Array.isArray(data.work)) throw new Error();
    renderCustomerWork(document, data.work, getServerCustomerPackages(data), recordParticipation);
  } catch (error) {
    status.className = "customer-empty-state customer-load-error";
    status.textContent = "DEMEOS could not load approved work. Please try again.";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { CUSTOMER_STAGE_ONE_COPY, createCustomerWorkCard, getLocalGreeting, getPreferredLanguage,
    getServerCustomerPackages, getValidCustomerWork, initializeCustomerIntention, loadCustomerWork,
    normalizedCustomerIntention, recordParticipation, renderCustomerWork, requestCustomerLocation,
    selectCustomerIntention, toCustomerWorkItem };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  initializeCustomerIntention(document, navigator, new Date());
  loadCustomerWork(document, fetch);
});
