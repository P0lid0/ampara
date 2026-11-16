// Abas do app: Início, Mapa, Histórico e Ajustes. No modo emergência (aparelho de outra pessoa) só o
// Histórico aparece; o guard do _layout raiz cuida das rotas.
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSessao } from '../../auth/sessao';
import { Texto } from '../../ui/Texto';
import { cores, espacos, fontes, raios, tamanhos, tetoRotuloAba } from '../../theme/tokens';

// Rótulo da aba com indicador que NÃO depende de cor: barra de 3 dp acima do texto e peso bold na aba ativa
// (a inativa fica em textoSuave, regular). Teto de 1,3 na escala para "Histórico" caber a 2x de fonte.
function rotuloAba(titulo: string) {
  return function RotuloAba({ focused }: { focused: boolean }) {
    return (
      <View style={estilos.rotuloAba}>
        <View style={[estilos.barra, focused ? estilos.barraAtiva : null]} />
        <Texto
          variante="rotulo"
          maxFontSizeMultiplier={tetoRotuloAba}
          numberOfLines={1}
          style={{
            color: focused ? cores.petroleo : cores.textoSuave,
            fontFamily: focused ? fontes.bold : fontes.semibold,
          }}
        >
          {titulo}
        </Texto>
      </View>
    );
  };
}

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
        tabBarStyle: { backgroundColor: cores.branco, minHeight: tamanhos.alvoMin + espacos.m },
        tabBarActiveTintColor: cores.petroleo,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarAllowFontScaling: true,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Início', tabBarLabel: rotuloAba('Início'), tabBarAccessibilityLabel: 'Início', ...soUsuario }}
      />
      <Tabs.Screen
        name="mapa"
        options={{ title: 'Mapa', tabBarLabel: rotuloAba('Mapa'), tabBarAccessibilityLabel: 'Mapa', ...soUsuario }}
      />
      <Tabs.Screen
        name="historico"
        options={{ title: 'Histórico', tabBarLabel: rotuloAba('Histórico'), tabBarAccessibilityLabel: 'Histórico' }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{ title: 'Ajustes', tabBarLabel: rotuloAba('Ajustes'), tabBarAccessibilityLabel: 'Ajustes', ...soUsuario }}
      />
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  rotuloAba: { alignItems: 'center', gap: espacos.xs },
  barra: { height: 3, width: espacos.gg + espacos.m, borderRadius: raios.p, backgroundColor: 'transparent' },
  barraAtiva: { backgroundColor: cores.petroleo },
});
