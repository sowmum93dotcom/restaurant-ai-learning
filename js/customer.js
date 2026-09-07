function createCustomerWorkCard(document, work, recordParticipation) {
  const card = document.createElement("article");
  card.className = "customer-work-card";
  const businessName = document.createElement("h3");
  businessName.textContent = work.businessName;
  const location = document.createElement("p");
  location.className = "customer-work-location";
  location.textContent = work.location;
  const content = document.createElement("p");
  content.className = "customer-work-content";
  content.textContent = work.content;
  const action = document.createElement("button");
  action.type = "button";
  action.className = "demeos-primary-button";
  action.textContent = work.participationAction;
  const result = document.createElement("p");
  result.className = "customer-participation-result";
  result.setAttribute("aria-live", "polite");
  action.addEventListener("click", async function () {
    action.disabled = true;
    try {
      await recordParticipation(work);
      action.textContent = "Interested";
      result.textContent = "Your interest was shared with this business.";
    } catch (error) {
      action.disabled = false;
      result.textContent = error.message;
    }
  });
  card.append(businessName, location, content, action, result);
  return card;
}

async function recordParticipation(work) {
  const response = await fetch(`/api/customer/work/${encodeURIComponent(work.workItemId)}/participation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId: work.businessId, action: work.participationAction })
  });
  if (!response.ok) throw new Error("DEMEOS could not share your interest. Please try again.");
}

if (typeof module !== "undefined" && module.exports) module.exports = { createCustomerWorkCard };

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded", async function () {
  const status = document.getElementById("customer-work-status");
  const list = document.getElementById("customer-work-list");
  try {
    const response = await fetch("/api/customer/work");
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.work)) throw new Error();
    status.textContent = data.work.length ? "" : "No approved business work is available yet.";
    data.work.forEach(function (work) {
      list.appendChild(createCustomerWorkCard(document, work, recordParticipation));
    });
  } catch (error) {
    status.textContent = "DEMEOS could not load approved work. Please try again.";
  }
});
