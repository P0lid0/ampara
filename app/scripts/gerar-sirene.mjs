// Gera assets/sirene.wav localmente (nenhum download de áudio): dois tons alternando,
// 22050 Hz, mono, PCM 16 bits, 2 s. Uso: node scripts/gerar-sirene.mjs
//
// Cada meio segundo troca entre 960 Hz e 770 Hz. Os dois fecham ciclos inteiros em 0,5 s
// (480 e 385 ciclos), então o arquivo começa e termina em zero: o loop não estala.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAXA = 22050;
const SEGUNDOS = 2;
const TONS = [960, 770];
const TROCA_S = 0.5;
const AMPLITUDE = 0.7;

const amostras = TAXA * SEGUNDOS;
const bytesDados = amostras * 2;
const buf = Buffer.alloc(44 + bytesDados);

// Cabeçalho RIFF/WAVE (PCM).
buf.write('RIFF', 0, 'ascii');
buf.writeUInt32LE(36 + bytesDados, 4);
buf.write('WAVE', 8, 'ascii');
buf.write('fmt ', 12, 'ascii');
buf.writeUInt32LE(16, 16); // tamanho do bloco fmt
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(TAXA, 24);
buf.writeUInt32LE(TAXA * 2, 28); // bytes por segundo
buf.writeUInt16LE(2, 32); // bytes por amostra
buf.writeUInt16LE(16, 34); // bits por amostra
buf.write('data', 36, 'ascii');
buf.writeUInt32LE(bytesDados, 40);

const porTroca = Math.round(TAXA * TROCA_S);
for (let i = 0; i < amostras; i++) {
  const segmento = Math.floor(i / porTroca);
  const freq = TONS[segmento % TONS.length];
  const t = (i - segmento * porTroca) / TAXA; // fase recomeça em cada troca (ciclos inteiros)
  const v = Math.round(Math.sin(2 * Math.PI * freq * t) * AMPLITUDE * 32767);
  buf.writeInt16LE(v, 44 + i * 2);
}

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sirene.wav');
writeFileSync(destino, buf);
console.log(`sirene.wav: ${buf.length} bytes (${(buf.length / 1024).toFixed(1)} KB) em ${destino}`);
