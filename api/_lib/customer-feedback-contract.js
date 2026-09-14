const CUSTOMER_FEEDBACK_TYPE = "possibility-relevance";

const CUSTOMER_FEEDBACK_RESPONSES = Object.freeze([
  "Relevant",
  "Not quite",
  "Something different"
]);

function parseCustomerFeedback(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  if (keys.some(function (key) { return key !== "response" && key !== "comment"; })) return null;
  if (!CUSTOMER_FEEDBACK_RESPONSES.includes(value.response)) return null;
  if (Object.hasOwn(value, "comment") && typeof value.comment !== "string") return null;
  const comment = typeof value.comment === "string" ? value.comment.trim() : "";
  if (comment.length > 500 || /[<>]/.test(comment)) return null;
  const feedback = { feedbackType: CUSTOMER_FEEDBACK_TYPE, response: value.response };
  if (comment) feedback.comment = comment;
  return feedback;
}

module.exports = {
  CUSTOMER_FEEDBACK_RESPONSES,
  CUSTOMER_FEEDBACK_TYPE,
  parseCustomerFeedback
};
