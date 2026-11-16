import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cores, elevacao, espacos } from '../theme/tokens';

export type BarraAcaoProps = {
  children: ReactNode;
  // Sem fundo próprio nem sombra (tela de alarme, onde o fundo já é o vermelho).
  semSombra?: boolean;
};

// Ação principal ancorada na base: fica no fluxo, abaixo do conteúdo que rola, soma a área segura
// (barra de gestos) ao respiro inferior e sobe junto com o teclado. A barra cresce com a fonte grande.
export function BarraAcao({ children, semSombra }: BarraAcaoProps) {
  const insets = useSafeAreaInsets();
  const [teclado, setTeclado] = useState(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const mostrar = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setTeclado(e.endCoordinates.height),
    );
    const esconder = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setTeclado(0));
    return () => {
      mostrar.remove();
      esconder.remove();
    };
  }, []);

  // Com o teclado aberto ele já cobre a área segura: só o respiro normal.
  const baixo = (teclado > 0 ? 0 : insets.bottom) + espacos.m;
  return (
    <View
      style={[
        estilos.barra,
        semSombra ? null : estilos.comSombra,
        { paddingBottom: baixo, marginBottom: teclado },
      ]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  barra: {
    paddingHorizontal: espacos.m,
    paddingTop: espacos.m,
    gap: espacos.p,
  },
  comSombra: {
    backgroundColor: cores.branco,
    boxShadow: elevacao.barra,
  },
});
