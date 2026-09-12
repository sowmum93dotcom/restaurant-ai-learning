function addText(document, parent, tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function createCustomerWorkCard(document, work, recordParticipation, anchorJourney) {
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
  const choiceCopy = document.createElement("div");
  addText(document, choiceCopy, "p", "customer-step", "03 · Choose");
  addText(document, choiceCopy, "p", "customer-choice-copy", "Does this interest you?");
  const action = addText(document, choice, "button", "customer-participation-button", work.participationAction);
  action.type = "button";
  choice.insertBefore(choiceCopy, action);

  const result = document.createElement("p");
  result.className = "customer-participation-confirmation";
  if (anchorJourney) result.id = "participate";
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

  card.append(context, message, choice, result);
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

function renderCustomerWork(document, work, participationRecorder) {
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
    list.appendChild(createCustomerWorkCard(document, item, participationRecorder, index === 0));
  });
}

async function loadCustomerWork(document, fetcher) {
  const status = document.getElementById("customer-work-status");
  try {
    const response = await fetcher("/api/customer/work");
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.work)) throw new Error();
    renderCustomerWork(document, data.work, recordParticipation);
  } catch (error) {
    status.className = "customer-empty-state customer-load-error";
    status.textContent = "DEMEOS could not load approved work. Please try again.";
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createCustomerWorkCard, loadCustomerWork, recordParticipation, renderCustomerWork };
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", function () {
  loadCustomerWork(document, fetch);
});
