import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useEffect, useState } from 'react';
import { destinoGuard } from '../auth/guard';
import { restaurar, useSessao } from '../auth/sessao';
import { cores, fontes } from '../theme/tokens';

export default function Layout() {
  // Se a Manrope não carregar (erro), o app segue com a fonte do sistema.
  const [carregadas, erro] = useFonts({ Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold });
  const [sessaoPronta, setSessaoPronta] = useState(false);
  const { autenticado, escopo } = useSessao();
  const segmentos = useSegments();
  const navegacao = useRootNavigationState();
  const router = useRouter();

  useEffect(() => {
    restaurar()
      .catch(() => undefined)
      .finally(() => setSessaoPronta(true));
  }, []);

  const chave = segmentos.join('/');
  const pronto = Boolean(navegacao?.key) && sessaoPronta;

  // Sem token vai para /entrar; no modo emergência só Histórico, rota e BO.
  useEffect(() => {
    if (!pronto) return;
    const destino = destinoGuard(autenticado, escopo, chave ? chave.split('/') : []);
    if (destino) router.replace(destino as never);
  }, [pronto, autenticado, escopo, chave, router]);

  if ((!carregadas && !erro) || !sessaoPronta) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.petroleo },
        headerTintColor: cores.areia,
        headerTitleStyle: carregadas ? { fontFamily: fontes.bold } : undefined,
        contentStyle: { backgroundColor: cores.areia },
      }}
    >
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
    </Stack>
  );
}
