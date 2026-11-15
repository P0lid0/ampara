import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSessao } from '../auth/sessao';
import { abrirBanco } from '../db/db';
import { concluirPassoSeguro, proximoPasso, reconciliarComServidor, rotaDoPasso } from '../onboarding/passos';
import { espacos } from '../theme/tokens';
import { Texto } from '../ui/Texto';

// Abertura do app: reconcilia com o servidor e leva ao próximo passo do onboarding (ou fica nas abas).
export default function Inicio() {
  const router = useRouter();
  const { autenticado, escopo } = useSessao();
  const [verificado, setVerificado] = useState(false);

  useEffect(() => {
    if (!autenticado) return;
    if (escopo !== 'usuario') {
      setVerificado(true); // modo emergência não tem onboarding
      return;
    }
    let ativo = true;
    (async () => {
      try {
        await concluirPassoSeguro('conta'); // quem chegou aqui autenticado já tem conta
        const db = await abrirBanco();
        const proximo = proximoPasso(await reconciliarComServidor(db));
        if (ativo && proximo !== 'fim') {
          router.replace(rotaDoPasso(proximo) as never);
          return;
        }
      } catch {
        // sem banco ou sem rede: segue para a tela inicial
      }
      if (ativo) setVerificado(true);
    })();
    return () => {
      ativo = false;
    };
  }, [autenticado, escopo, router]);

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Ampara' }} />
      <Texto variante="titulo">Ampara</Texto>
      {verificado ? (
        <Texto>Se o seu celular for roubado, o Ampara avisa os seus guardiões e mostra o passo a passo.</Texto>
      ) : (
        <Texto>Carregando...</Texto>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
});
