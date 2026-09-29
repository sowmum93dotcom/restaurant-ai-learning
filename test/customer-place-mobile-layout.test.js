const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const css=fs.readFileSync(require.resolve("../css/customer-mobile-refinement.css"),"utf8");
const html=fs.readFileSync(require.resolve("../customer.html"),"utf8");
test("customer town/city has an accessible full-width touch input on mobile",()=>{
 assert.match(html,/<label for="customer-place">Town or city/);
 assert.match(html,/<input id="customer-place" type="text" maxlength="80"/);
 assert.match(css,/\.customer-body #intention #customer-place\{[^}]*width:100%;[^}]*min-height:48px;[^}]*font-size:16px;/);
 assert.match(css,/\.customer-body #intention #customer-place:focus-visible\{[^}]*outline:/);
});
