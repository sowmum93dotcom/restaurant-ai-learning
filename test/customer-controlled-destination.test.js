const test=require('node:test'),assert=require('node:assert/strict');
const {isFictionalDiscoverDestination:matches}=require('../js/customer-product-experience');
test('only exact fictional Discover destinations are intercepted',()=>{
 assert.equal(matches('https://www.demeos.io/customer.html?demeos-test=1#discover'),true);
 assert.equal(matches('https://demeos.io/customer.html?demeos-test=1#discover'),true);
 for(const url of ['https://www.demeos.io/customer.html?demeos-test=1#intention','https://www.demeos.io/customer.html?demeos-test=1&product=other#discover','https://www.demeos.io:444/customer.html?demeos-test=1#discover','https://www.demeos.io:443/customer.html?demeos-test=1#discover','http://www.demeos.io/customer.html?demeos-test=1#discover','https://www.demeos.io/customer.html#discover','https://vendor.example/customer.html?demeos-test=1#discover'])assert.equal(matches(url),false,url);
});
