(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DEMEOSSellingLocation=api;
})(typeof window==='object'?window:null,function(){
  'use strict';
  // ISO 3166-1 alpha-2: include territories; never infer a business country from locale or IP.
  const countries=Object.freeze(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
  const fields=Object.freeze(['countryCode','addressLine1','addressLine2','locality','region','postalCode']);
  const limits={countryCode:2,addressLine1:200,addressLine2:200,locality:100,region:100,postalCode:32};
  function normalize(address){
    if(!address||typeof address!=='object'||Array.isArray(address)||Object.keys(address).some(k=>!fields.includes(k)))return null;
    const values=Object.fromEntries(fields.map(k=>[k,address[k]===undefined?'':address[k]]));
    if(fields.some(k=>typeof values[k]!=='string'||values[k].trim().length>limits[k]||/[\u0000-\u001f\u007f]/.test(values[k])))return null;
    const result=Object.fromEntries(fields.map(k=>[k,values[k].trim()]));
    if(!countries.includes(result.countryCode)||!result.addressLine1||!result.locality)return null;
    return result;
  }
  function countryName(code,locale='en'){
    if(!countries.includes(code))return '';
    try{return new Intl.DisplayNames([locale],{type:'region'}).of(code)||code;}catch{return code;}
  }
  function flag(code){return countries.includes(code)?Array.from(code,c=>String.fromCodePoint(127397+c.charCodeAt(0))).join(''):'';}
  function summary(address,locale='en'){
    const valid=normalize(address);return valid?[valid.locality,valid.region,countryName(valid.countryCode,locale)].filter(Boolean).join(' · '):'';
  }
  function internationalPhone(value){return value===''||/^\+[1-9][0-9 ()-]*$/.test(value)&&/^\d{7,15}$/.test(value.replace(/\D/g,''));}
  return Object.freeze({countries,fields,normalize,countryName,flag,summary,internationalPhone});
});
