const plugin = require('../with-notifee-fgs-type') as {
  declararTipoDoServico(m: Manifesto): Manifesto;
  acrescentarRepositorio(g: string): string;
};

type No = { $: Record<string, string> };
type Manifesto = { manifest: { $?: Record<string, string>; application?: (No & { service?: No[] })[] } };

const manifesto = (servicos: No[] = []): Manifesto => ({
  manifest: {
    $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    application: [{ $: { 'android:name': '.MainApplication' }, service: servicos }],
  },
});

const servicoNotifee = (m: Manifesto) =>
  m.manifest.application![0].service!.filter((s) => s.$['android:name'] === 'app.notifee.core.ForegroundService');

describe('with-notifee-fgs-type', () => {
  it('declara o ForegroundService do notifee como dataSync, substituindo o tipo da biblioteca', () => {
    const m = plugin.declararTipoDoServico(manifesto());
    expect(m.manifest.$!['xmlns:tools']).toBe('http://schemas.android.com/tools');
    const [s] = servicoNotifee(m);
    expect(s.$['android:foregroundServiceType']).toBe('dataSync');
    expect(s.$['tools:replace']).toBe('android:foregroundServiceType');
  });

  it('é idempotente e mantém outros tools:replace', () => {
    const inicial = manifesto([
      { $: { 'android:name': 'app.notifee.core.ForegroundService', 'tools:replace': 'android:exported' } },
    ]);
    const m = plugin.declararTipoDoServico(plugin.declararTipoDoServico(inicial));
    const lista = servicoNotifee(m);
    expect(lista).toHaveLength(1);
    expect(lista[0].$['tools:replace']).toBe('android:exported,android:foregroundServiceType');
  });

  it('acrescenta o repositório local da AAR ao allprojects.repositories uma vez só', () => {
    const gradle = 'allprojects {\n  repositories {\n    google()\n    mavenCentral()\n  }\n}\n';
    const uma = plugin.acrescentarRepositorio(gradle);
    expect(uma).toContain('maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }');
    expect(uma.indexOf('@notifee')).toBeLessThan(uma.indexOf('google()'));
    expect(plugin.acrescentarRepositorio(uma)).toBe(uma);
  });

  it('sem bloco allprojects, cria um', () => {
    const r = plugin.acrescentarRepositorio('buildscript {}\n');
    expect(r).toMatch(/allprojects \{\n {2}repositories \{\n {4}maven \{ url ".*@notifee\/react-native\/android\/libs" \}/);
  });
});
