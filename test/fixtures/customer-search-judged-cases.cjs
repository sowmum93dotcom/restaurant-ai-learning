// Versioned synthetic integration assertions, not production training data.
const version='search-integration-synthetic-v1';
const cases=[
 ['exact','waterproof black jacket under £100',['cheap'],['relevance','must-have','budget']],
 ['natural','I would like a jacket please',['cheap','expensive','blue'],['relevance','party-context']],
 ['excluded','jacket not blue',['cheap','expensive'],['negation','hard-exclusion']],
 ['inclusive','black jacket up to £89',['cheap'],['budget']],
 ['exclusive','black jacket under £89',[],['budget','no-result']],
 ['unrelated','spaceship launch',[],['unsupported','misleading']],
 ['weak','a wonderful community event',[],['weak-match']],
 ['date','jacket tomorrow',[],['date','no-result']],
 ['time','jacket at 12:30',[],['time','no-result']],
 ['distance','jacket within 2 km',[],['distance','no-result']],
 ['quantity','2 jackets',[],['quantity','no-result']],
 ['party','jacket for 2 people',[],['party-context','no-result']],
 ['location','jacket near Manchester',['cheap','blue'],['location']],
 ['broad','jacket',['cheap','expensive','blue'],['unnecessary-clarification']],
 ['ambiguous','jacket near me',[],['ambiguous','necessary-clarification'],true],
 ['preference','jacket preferably blue',['cheap','expensive','blue'],['preference']],
 ['paraphrase','I am looking for a jacket',['cheap','expensive','blue'],['paraphrase']],
 ['noisy','jakket',[],['noisy-language','unsupported']],
 ['facts','black jacket under £100',['cheap'],['fact-integrity']]
].map(([id,request,expected,areas,clarification=false])=>({id,request,expected,areas,clarification,locale:'en'}));
function catalogue(){return [['cheap','Black waterproof jacket','£89','Manchester'],['expensive','Black waterproof jacket','£160','London'],['blue','Blue jacket','£70','Manchester']].map(([id,description,price,location])=>({workItemId:id,businessId:'business-'+id,businessName:'Synthetic '+id,content:description,location,participationAction:'Interested',customerContinuation:{routes:['website'],website:'https://example.com'},products:[{productId:'product-'+id,businessId:'business-'+id,name:description,description,price,availability:'available',continuationRoute:'website'}]}));}
module.exports={version,cases,catalogue};
