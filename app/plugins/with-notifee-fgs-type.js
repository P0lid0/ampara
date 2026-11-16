// Config plugin: o serviço em primeiro plano do notifee como dataSync.
//
// A AAR do notifee declara app.notifee.core.ForegroundService com foregroundServiceType="shortService"
// (o Android 14 encerra esse tipo em ~3 min). O guardião precisa do serviço vivo enquanto escuta o
// hub, então o manifesto do app sobrescreve o tipo para dataSync (a permissão
// FOREGROUND_SERVICE_DATA_SYNC está em app.config.ts).
//
// Fallback: se o Gradle não achar app.notifee:core, acrescenta o repositório local da AAR
// (node_modules/@notifee/react-native/android/libs) ao allprojects.repositories. Idempotente.
const { AndroidConfig, withAndroidManifest, withProjectBuildGradle } = require('expo/config-plugins');

const SERVICO = 'app.notifee.core.ForegroundService';
const TIPO = 'dataSync';
const ATRIBUTO = 'android:foregroundServiceType';
const REPO = '$rootDir/../node_modules/@notifee/react-native/android/libs';

/** Declara (ou corrige) o serviço do notifee com o tipo dataSync, substituindo o da biblioteca. */
function declararTipoDoServico(manifesto) {
  const raiz = manifesto.manifest;
  raiz.$ = raiz.$ || {};
  if (!raiz.$['xmlns:tools']) raiz.$['xmlns:tools'] = 'http://schemas.android.com/tools';

  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifesto);
  app.service = app.service || [];
  let servico = app.service.find((s) => s.$ && s.$['android:name'] === SERVICO);
  if (!servico) {
    servico = { $: { 'android:name': SERVICO } };
    app.service.push(servico);
  }
  servico.$[ATRIBUTO] = TIPO;
  const substituir = new Set(
    (servico.$['tools:replace'] || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  );
  substituir.add(ATRIBUTO);
  servico.$['tools:replace'] = [...substituir].join(',');
  return manifesto;
}

/** Acrescenta o repositório maven local da AAR do notifee (uma vez só). */
function acrescentarRepositorio(gradle) {
  if (gradle.includes('@notifee/react-native/android/libs')) return gradle;
  const linha = `maven { url "${REPO}" }`;
  const bloco = /allprojects\s*\{\s*repositories\s*\{/;
  if (bloco.test(gradle)) return gradle.replace(bloco, (m) => `${m}\n    ${linha}`);
  return `${gradle}\nallprojects {\n  repositories {\n    ${linha}\n  }\n}\n`;
}

const withNotifeeFgsType = (config) => {
  config = withAndroidManifest(config, (c) => {
    c.modResults = declararTipoDoServico(c.modResults);
    return c;
  });
  config = withProjectBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy') c.modResults.contents = acrescentarRepositorio(c.modResults.contents);
    return c;
  });
  return config;
};

module.exports = withNotifeeFgsType;
module.exports.declararTipoDoServico = declararTipoDoServico;
module.exports.acrescentarRepositorio = acrescentarRepositorio;
