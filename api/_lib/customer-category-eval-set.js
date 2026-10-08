'use strict';
const {LOCALES}=require('./customer-evidence-provenance');
const VERSION='customer-category-eval-v1';
// Development specifications, NOT independently judged semantic quality data.
const rows=[
 ['canonical','Catering Services',['89']],
 ['canonical-fashion','Fashion and Apparel Commerce',['10']],
 ['wedding-paraphrase','I need someone to provide food for my wedding',['89']],
 ['office-paraphrase','I need someone to clean my office every evening',['93']],
 ['ambiguous','I need help organising my event',[],true],
 ['multiple','Catering Services and Cleaning Services',['89','93']],
 ['multiple-paraphrase','Provide wedding food and clean the venue afterwards',['89','93']],
 ['short-negation','I do not want catering',[],false,true],
 ['long-negation','I do not want to use any Catering Services',[],false,true],
 ['offer-negation','We do not currently intend to offer Catering Services',[],false,true],
 ['exclusion','Exclude cleaning services',[],false,true],
 ['except','Anything except catering',[],false,true],
 ['boundary','Not Cleaning Services; Catering Services',['89']],
 ['positive-only','Not only Fashion and Apparel Commerce',['10']],
 ['unrelated','Explain the weather on Mars',[],false,true],
 ['malformed','Please provide food for my wedding',[],false,true,'malformed-response'],
 ['invented','Please provide food for my wedding',[],false,true,'unknown-category'],
 ['wrong-sector','Please provide food for my wedding',[],false,true,'incorrect-sector']
];
const cases=rows.map(([caseId,text,expectedCategoryIds,allowFallback=true,positiveUnsafe=false,responseScenario='normal'])=>({caseId,locale:'en',text,expectedCategoryIds,allowFallback,positiveUnsafe,responseScenario,judgement:'specification-only'}));
const multilingual={en:'I need someone to provide food for my wedding',es:'Necesito a alguien que prepare comida para mi boda',fr:"Je cherche quelqu’un pour préparer le repas de mon mariage",ar:'أحتاج إلى شخص لتقديم الطعام في حفل زفافي',pt:'Preciso de alguém para fornecer comida para o meu casamento',zh:'我需要有人为我的婚礼提供餐饮',hi:'मुझे अपनी शादी के लिए भोजन उपलब्ध कराने वाला चाहिए',de:'Ich brauche jemanden, der Essen für meine Hochzeit bereitstellt',ja:'結婚式の料理を提供してくれる人を探しています'};
for(const locale of LOCALES)cases.push({caseId:'locale-paraphrase-'+locale,locale,text:multilingual[locale],expectedCategoryIds:['89'],allowFallback:true,positiveUnsafe:false,responseScenario:'normal',judgement:'specification-only'});
const CASES=Object.freeze(cases.map(row=>Object.freeze({...row,expectedCategoryIds:Object.freeze(row.expectedCategoryIds)})));
module.exports={VERSION,CASES};
