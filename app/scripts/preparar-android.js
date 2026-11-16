#!/usr/bin/env node
// Grava android/local.properties depois do `expo prebuild` (que recria android/).
// No Windows, o CMake 3.22.1 do SDK traz um ninja sem suporte a caminho longo e o
// build do Expo Router estoura 260 caracteres; o CMake 3.31.6 (ninja 1.12.1) resolve.
// Uso: node scripts/preparar-android.js   (lê ANDROID_HOME ou ANDROID_SDK_ROOT)
const fs = require('node:fs');
const path = require('node:path');

const CMAKE_MINIMO = [3, 31, 0];

function compararVersao(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function lerVersao(nome) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(nome);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Escolhe a maior versão de CMake instalada que seja >= 3.31.0; null se não houver.
function escolherCmake(versoes) {
  const validas = versoes
    .map((nome) => ({ nome, v: lerVersao(nome) }))
    .filter((x) => x.v && compararVersao(x.v, CMAKE_MINIMO) >= 0)
    .sort((x, y) => compararVersao(y.v, x.v));
  return validas.length ? validas[0].nome : null;
}

// local.properties é lido como Properties do Java: barra invertida é escape.
// Por isso o caminho vai com barras normais e o ':' do drive escapado.
function caminhoProperties(p) {
  return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1\\:');
}

function conteudoLocalProperties(androidHome, cmakeVersao) {
  const linhas = [`sdk.dir=${caminhoProperties(androidHome)}`];
  if (cmakeVersao) {
    linhas.push(`cmake.dir=${caminhoProperties(path.join(androidHome, 'cmake', cmakeVersao))}`);
  }
  return linhas.join('\n') + '\n';
}

function main() {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!androidHome) {
    console.error('Defina ANDROID_HOME (pasta do Android SDK).');
    process.exit(1);
  }
  const pastaAndroid = path.join(__dirname, '..', 'android');
  if (!fs.existsSync(pastaAndroid)) {
    console.error('Pasta android/ não existe. Rode antes: npx expo prebuild --platform android');
    process.exit(1);
  }
  const pastaCmake = path.join(androidHome, 'cmake');
  const versoes = fs.existsSync(pastaCmake) ? fs.readdirSync(pastaCmake) : [];
  const cmake = escolherCmake(versoes);
  if (!cmake) {
    console.warn('Aviso: nenhum CMake >= 3.31 no SDK. No Windows, instale com: sdkmanager.bat "cmake;3.31.6"');
  }
  const destino = path.join(pastaAndroid, 'local.properties');
  fs.writeFileSync(destino, conteudoLocalProperties(androidHome, cmake));
  console.log(`Gravado ${destino}${cmake ? ` (CMake ${cmake})` : ''}`);
}

if (require.main === module) main();

module.exports = { escolherCmake, caminhoProperties, conteudoLocalProperties };
