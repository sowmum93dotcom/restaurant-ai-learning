const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

test("homepage separates public Customer Experience from private sign-in", function () {
  const home = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const customer = fs.readFileSync(path.join(__dirname, "..", "customer.html"), "utf8");
  const account = fs.readFileSync(path.join(__dirname, "..", "my-demeos.html"), "utf8");
  assert.match(home, /class="demeos-entry-signin" href="my-demeos\.html" data-public-copy="signIn">Sign in<\/a>/);
  assert.match(home, /<h2 data-public-copy="customer">Customer Experience<\/h2>[\s\S]*?<a id="customer-entry-link" href="customer\.html#discover" data-public-copy="enter">Enter/);
  assert.match(home, /src="js\/customer-controlled-navigation\.js"/);
  assert.match(customer, /id="discover"/);
  assert.match(account, /id="customer-auth-signed-out"/);
  assert.match(account, /id="customer-sign-in"/);
});

