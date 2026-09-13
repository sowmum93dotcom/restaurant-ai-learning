function addText(document, parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
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
  const response = await fetch(`/api/customer/work/${encodeURIComponent(work.workItemId)}/participation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: work.participationAction })
  });
  if (!response.ok) throw new Error("DEMEOS could not share your interest. Please try again.");
}

function renderCustomerWork(document, work, customerPackages, participationRecorder) {
  const status = document.getElementById("customer-work-status");
  const list = document.getElementById("customer-work-list");
  list.textContent = "";
  if (!work.length) {
    status.className = "customer-empty-state";
    status.innerHTML = "<strong>Nothing to discover just yet</strong><span>No approved customer work is available. Please check back soon.</span>";
    return;
  }
  status.textContent = "";
  status.className = "customer-work-status";
  work.forEach(function (item, index) {
    list.appendChild(createCustomerWorkCard(document, item, customerPackages, participationRecorder, index === 0));
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
    if (!response.ok || !Array.isArray(data.work) || !Array.isArray(data.customerPackages)) throw new Error();
    renderCustomerWork(document, data.work, getServerCustomerPackages(data), recordParticipation);
  } catch (error) {
    status.className = "customer-empty-state customer-load-error";
    status.textContent = "DEMEOS could not load approved work. Please try again.";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createCustomerWorkCard, getServerCustomerPackages, loadCustomerWork, recordParticipation, renderCustomerWork };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  loadCustomerWork(document, fetch);
});
