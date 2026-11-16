// Abas do app: Início, Mapa, Histórico e Ajustes. No modo emergência (aparelho de outra pessoa) só o
// Histórico aparece; o guard do _layout raiz cuida das rotas.
import { Tabs } from 'expo-router/js-tabs';
import { useSessao } from '../../auth/sessao';
import { cores, fontes, tamanhos } from '../../theme/tokens';

export default function AbasLayout() {
  const { escopo } = useSessao();
  const emergencia = escopo === 'emergencia';
  // `href: null` tira a aba da barra sem tirar a rota.
  const soUsuario = emergencia ? { href: null } : {};

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.petroleo },
        headerTintColor: cores.areia,
        headerTitleStyle: { fontFamily: fontes.bold },
        sceneStyle: { backgroundColor: cores.areia },
        tabBarStyle: { backgroundColor: cores.branco, minHeight: tamanhos.alvoMin + 16 },
        tabBarActiveTintColor: cores.petroleo,
        tabBarInactiveTintColor: cores.tinta,
        tabBarLabelStyle: { fontSize: tamanhos.fonteMin, fontFamily: fontes.semibold },
        tabBarAllowFontScaling: true,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarAccessibilityLabel: 'Início', ...soUsuario }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarAccessibilityLabel: 'Mapa', ...soUsuario }} />
      <Tabs.Screen name="historico" options={{ title: 'Histórico', tabBarAccessibilityLabel: 'Histórico' }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarAccessibilityLabel: 'Ajustes', ...soUsuario }} />
    </Tabs>
  );
}
