/* Preparation copy uses the shared nine-language registry and preference.
   Business facts and the surrounding legacy English workspace are not translated. */
(function(root){'use strict';
 const keys=['select','review','media','prepare','edit','submit','change','guide'];
 const copy={
 en:['Select an offer','Review information','Select matching media','Prepare a draft','Review and edit','Submit for approval','Review offer information','Review the offer, save accurate information, then prepare a private marketing draft. Business facts are kept in their original language.'],
 es:['Seleccionar una oferta','Revisar información','Seleccionar contenido multimedia relacionado','Preparar un borrador','Revisar y editar','Enviar para aprobación','Revisar la información de la oferta','Revisa la oferta, guarda información precisa y prepara un borrador de marketing privado. Los datos del negocio conservan su idioma original.'],
 fr:['Choisir une offre','Vérifier les informations','Choisir les médias correspondants','Préparer un brouillon','Vérifier et modifier','Soumettre pour approbation','Vérifier les informations de l’offre','Vérifiez l’offre, enregistrez des informations exactes, puis préparez un brouillon marketing privé. Les données de l’entreprise restent dans leur langue d’origine.'],
 ar:['اختر عرضاً','راجع المعلومات','اختر الوسائط المطابقة','جهّز مسودة','راجع وعدّل','أرسل للموافقة','راجع معلومات العرض','راجع العرض واحفظ المعلومات الدقيقة ثم جهّز مسودة تسويقية خاصة. تبقى معلومات النشاط التجاري بلغتها الأصلية.'],
 pt:['Selecionar uma oferta','Rever informações','Selecionar mídia correspondente','Preparar um rascunho','Rever e editar','Enviar para aprovação','Rever informações da oferta','Reveja a oferta, salve informações corretas e prepare um rascunho de marketing privado. Os dados da empresa mantêm seu idioma original.'],
 zh:['选择产品或服务','核对信息','选择对应的图片或视频','准备草稿','审核并编辑','提交审批','核对产品或服务信息','核对产品或服务，保存准确信息，再准备私人营销草稿。商家信息保留原始语言。'],
 hi:['उत्पाद या सेवा चुनें','जानकारी की समीक्षा करें','संबंधित मीडिया चुनें','ड्राफ्ट तैयार करें','समीक्षा करें और संपादित करें','अनुमोदन के लिए भेजें','उत्पाद या सेवा की जानकारी देखें','उत्पाद या सेवा की समीक्षा करें, सही जानकारी सहेजें और निजी मार्केटिंग ड्राफ्ट तैयार करें। व्यवसाय की जानकारी मूल भाषा में रहेगी।'],
 de:['Angebot auswählen','Informationen prüfen','Passende Medien auswählen','Entwurf vorbereiten','Prüfen und bearbeiten','Zur Freigabe einreichen','Angebotsinformationen prüfen','Prüfen Sie das Angebot, speichern Sie korrekte Informationen und erstellen Sie einen privaten Marketingentwurf. Unternehmensangaben bleiben in ihrer Originalsprache.'],
 ja:['商品・サービスを選ぶ','情報を確認する','対応する画像・動画を選ぶ','下書きを作成する','確認・編集する','承認を申請する','商品・サービス情報を確認する','商品・サービスを確認し、正確な情報を保存して非公開のマーケティング下書きを作成します。事業者の情報は元の言語を保持します。']};
 function apply(value){const language=root.DEMEOSLanguageRegistry.resolve(value);root.document.querySelectorAll('[data-owner-copy]').forEach(node=>{const index=keys.indexOf(node.dataset.ownerCopy);if(index>=0){node.textContent=copy[language.code][index];node.lang=language.code;node.dir=language.direction;}});
  const existing=root.DEMEOSItemPresentationCopy?.[language.code];if(existing)root.document.querySelectorAll('[data-owner-field],[data-owner-category]').forEach(node=>{const text=node.dataset.ownerField?existing.fields[node.dataset.ownerField]:existing.categories[node.dataset.ownerCategory];if(text){node.textContent=text;node.lang=language.code;node.dir=language.direction;}});
  return language.code;}
 function start(){const select=root.document.getElementById('owner-preparation-language');if(!select)return;
  root.DEMEOSLanguageRegistry.languages.forEach(language=>{const option=root.document.createElement('option');option.value=language.code;option.textContent=language.name;select.append(option);});
  let saved='en';try{saved=root.localStorage.getItem('demeos-customer-language');}catch(_){}select.value=apply(saved);
  select.addEventListener('change',()=>{const code=apply(select.value);try{root.localStorage.setItem('demeos-customer-language',code);}catch(_){}});
 }
 root.DEMEOSBusinessPreparationLanguage={apply,copy};
 if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start);else if(root.document)start();
}(typeof window==='object'?window:{}));
