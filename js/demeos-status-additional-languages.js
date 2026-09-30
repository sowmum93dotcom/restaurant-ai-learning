/* Customer statuses distinguish readiness, confirmed saving, failure and location permission. */
(function(root){"use strict";var copy=Object.freeze({
  "es": {
    "status": [
      "DEMEOS entiende tu intención.",
      "Guardado en Mis intenciones.",
      "Añade un poco más de información para que DEMEOS entienda tu intención.",
      "Añade detalles antes de continuar.",
      "Mantén el total de detalles dentro de 500 caracteres.",
      "No se pudo guardar tu intención. Inténtalo de nuevo."
    ],
    "additional": [
      "Tu intención está lista. No se ha enviado información.",
      "Dile a DEMEOS qué necesitas antes de continuar.",
      "Ubicación borrada para esta sesión.",
      "La ubicación es opcional. Puedes continuar sin ella.",
      "Permiso de ubicación concedido. La búsqueda por GPS no está habilitada. Puedes introducir una ciudad arriba para filtrar por el lugar exacto indicado por la empresa."
    ]
  },
  "pt": {
    "status": [
      "O DEMEOS compreende a sua intenção.",
      "Guardado em As minhas intenções.",
      "Acrescente mais alguns detalhes para que o DEMEOS compreenda a sua intenção.",
      "Acrescente detalhes antes de continuar.",
      "Mantenha o conjunto dos detalhes dentro de 500 caracteres.",
      "Não foi possível guardar a sua intenção. Tente novamente."
    ],
    "additional": [
      "A sua intenção está pronta. Nenhuma informação foi enviada.",
      "Diga ao DEMEOS do que precisa antes de continuar.",
      "Localização limpa para esta sessão.",
      "A localização é opcional. Pode continuar sem ela.",
      "Permissão de localização concedida. A pesquisa por GPS não está ativada. Pode introduzir uma localidade acima para filtrar pelo local exato indicado pela empresa."
    ]
  },
  "zh": {
    "status": [
      "DEMEOS 已理解您的意向。",
      "已保存到我的意向。",
      "请补充一些详情，以便 DEMEOS 理解您的意向。",
      "请先补充详情再继续。",
      "所有详情合计不得超过 500 个字符。",
      "无法保存您的意向。请重试。"
    ],
    "additional": [
      "您的意向已准备就绪。尚未发送任何信息。",
      "请先告诉 DEMEOS 您需要什么，再继续。",
      "已清除此会话的位置。",
      "位置为可选项。您可以不提供位置继续。",
      "已授予位置权限。尚未启用基于 GPS 的匹配。您可以在上方输入城镇或城市，按商家列出的准确位置筛选。"
    ]
  },
  "hi": {
    "status": [
      "DEMEOS आपकी मंशा समझता है।",
      "मेरी मंशाओं में सहेजा गया।",
      "DEMEOS आपकी मंशा समझ सके, इसके लिए कुछ और विवरण जोड़ें।",
      "आगे बढ़ने से पहले विवरण जोड़ें।",
      "सभी विवरण मिलाकर 500 अक्षरों के भीतर रखें।",
      "आपकी मंशा सहेजी नहीं जा सकी। कृपया फिर कोशिश करें।"
    ],
    "additional": [
      "आपकी मंशा तैयार है। कोई जानकारी भेजी नहीं गई है।",
      "आगे बढ़ने से पहले DEMEOS को बताएँ कि आपको क्या चाहिए।",
      "इस सत्र के लिए स्थान हटा दिया गया है।",
      "स्थान वैकल्पिक है। आप इसके बिना आगे बढ़ सकते हैं।",
      "स्थान की अनुमति मिल गई है। GPS-आधारित मिलान चालू नहीं है। व्यवसाय द्वारा दर्ज सटीक स्थान से फ़िल्टर करने के लिए ऊपर शहर या कस्बा दर्ज करें।"
    ]
  },
  "de": {
    "status": [
      "DEMEOS versteht Ihr Anliegen.",
      "Unter Meine Anliegen gespeichert.",
      "Ergänzen Sie einige Angaben, damit DEMEOS Ihr Anliegen verstehen kann.",
      "Ergänzen Sie vor dem Fortfahren einige Angaben.",
      "Halten Sie alle Angaben zusammen innerhalb von 500 Zeichen.",
      "Ihr Anliegen konnte nicht gespeichert werden. Bitte versuchen Sie es erneut."
    ],
    "additional": [
      "Ihr Anliegen ist bereit. Es wurden keine Informationen gesendet.",
      "Teilen Sie DEMEOS vor dem Fortfahren mit, was Sie benötigen.",
      "Standort für diese Sitzung gelöscht.",
      "Der Standort ist optional. Sie können ohne ihn fortfahren.",
      "Standortberechtigung erteilt. GPS-basierter Abgleich ist nicht aktiviert. Sie können oben einen Ort eingeben, um nach dem genauen vom Unternehmen angegebenen Standort zu filtern."
    ]
  },
  "ja": {
    "status": [
      "DEMEOS がご希望を理解しました。",
      "マイ希望リストに保存しました。",
      "DEMEOS がご希望を理解できるよう、もう少し詳しく入力してください。",
      "続ける前に詳細を追加してください。",
      "詳細は合計 500 文字以内にしてください。",
      "ご希望を保存できませんでした。もう一度お試しください。"
    ],
    "additional": [
      "ご希望の準備ができました。情報はまだ送信されていません。",
      "続ける前に必要なことを DEMEOS に伝えてください。",
      "このセッションの位置情報を消去しました。",
      "位置情報は任意です。入力せずに続けられます。",
      "位置情報の許可が得られました。GPS による照合は有効ではありません。上の欄に町または都市を入力すると、事業者が登録した正確な所在地で絞り込めます。"
    ]
  }
});if(typeof module!=="undefined"&&module.exports)module.exports=copy;root.DEMEOSStatusAdditionalCopy=copy;}(typeof window!=="undefined"?window:{}));
