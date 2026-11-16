import config from '../../app.config';

// Rodada pontual, item C: no build de release com minificação o R8 removia o construtor de
// androidx.work.impl.WorkDatabase (usado pelo notifee) e o app fechava ao abrir.
const REGRAS = [
  '-keep class androidx.work.** { *; }',
  '-keep class * extends androidx.room.RoomDatabase { <init>(); }',
  '-keep class androidx.room.** { *; }',
];

type Plugin = string | [string, Record<string, unknown>];

function opcoesDe(nome: string): Record<string, unknown> | undefined {
  const p = (config.plugins as Plugin[]).find((x) => Array.isArray(x) && x[0] === nome);
  return Array.isArray(p) ? p[1] : undefined;
}

describe('app.config: regra do R8 para o WorkManager/Room do notifee', () => {
  it('expo-build-properties leva as três regras -keep em android.extraProguardRules', () => {
    const android = opcoesDe('expo-build-properties')?.android as { extraProguardRules?: string } | undefined;
    const linhas = (android?.extraProguardRules ?? '').split('\n').map((l) => l.trim());
    for (const regra of REGRAS) expect(linhas).toContain(regra);
  });
});
