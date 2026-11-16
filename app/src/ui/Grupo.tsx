import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { bordas, cores, espacos, raios } from '../theme/tokens';
import { Texto } from './Texto';

// Lista agrupada: UMA superfície branca com borda de 1 px e divisor fino entre as linhas (nunca uma caixa por item).
export function Grupo({ children }: { children: ReactNode }) {
  const linhas = Children.toArray(children);
  return (
    <View style={estilos.grupo}>
      {linhas.map((linha, i) => (
        <View key={i} style={i < linhas.length - 1 ? estilos.divisor : null}>
          {linha}
        </View>
      ))}
    </View>
  );
}

// Título pequeno de seção, fora da superfície; é cabeçalho para o leitor de tela.
export function TituloGrupo({ children }: { children: string }) {
  return (
    <Texto variante="rotulo" accessibilityRole="header" style={estilos.titulo}>
      {children}
    </Texto>
  );
}

const estilos = StyleSheet.create({
  grupo: {
    borderRadius: raios.m,
    backgroundColor: cores.branco,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    overflow: 'hidden',
  },
  divisor: { borderBottomWidth: bordas.fina, borderBottomColor: cores.bordaSuave },
  titulo: { color: cores.textoSuave, paddingHorizontal: espacos.xs, marginBottom: -espacos.p },
});
