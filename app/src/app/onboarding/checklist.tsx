import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { abrirBanco } from '../../db/db';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { ITENS_CHECKLIST, lerChecklist, marcarItem, type IdItemChecklist } from '../../prevencao/checklist';
import { cores, espacos } from '../../theme/tokens';
import { Botao } from '../../ui/Botao';
import { ProgressoPassos } from '../../ui/ProgressoPassos';
import { Texto } from '../../ui/Texto';

type Feitos = Record<IdItemChecklist, boolean>;

export default function OnboardingChecklist() {
  const router = useRouter();
  const [feitos, setFeitos] = useState<Feitos>({ protecaoRoubo: false, limitePix: false, senhasNaoSalvas: false });
  const [aviso, setAviso] = useState<string | undefined>();

  useEffect(() => {
    let vivo = true;
    abrirBanco()
      .then(lerChecklist)
      .then((f) => {
        if (vivo) setFeitos(f);
      })
      .catch(() => undefined); // sem banco: tudo aparece como "Falta fazer"
    return () => {
      vivo = false;
    };
  }, []);

  async function alternar(id: IdItemChecklist) {
    setAviso(undefined);
    const novo = !feitos[id];
    setFeitos((f) => ({ ...f, [id]: novo }));
    try {
      await marcarItem(await abrirBanco(), id, novo);
    } catch {
      setFeitos((f) => ({ ...f, [id]: !novo }));
      setAviso('⚠ Não foi possível salvar. Tente de novo.');
    }
  }

  async function continuar() {
    await concluirPassoSeguro('checklist'); // os itens são conselho: pendentes não travam o passo
    router.replace('/');
  }

  const total = ITENS_CHECKLIST.length;
  const n = ITENS_CHECKLIST.filter((i) => feitos[i.id]).length;

  return (
    <ScrollView contentContainerStyle={estilos.tela}>
      <Stack.Screen options={{ title: 'Prevenção' }} />
      <ProgressoPassos passo="checklist" />
      <Texto variante="titulo">Antes que aconteça</Texto>
      <Texto>Três cuidados simples deixam um roubo menos grave. Faça agora ou volte depois em Ajustes.</Texto>
      <Texto accessibilityLiveRegion="polite">{`${n} de ${total} feitos`}</Texto>
      {ITENS_CHECKLIST.map((i) => {
        const feito = feitos[i.id];
        return (
          <View key={i.id} style={estilos.caixa}>
            <Texto variante="titulo" style={estilos.titulo}>
              {i.titulo}
            </Texto>
            <Texto>{`Como fazer: ${i.comoFazer}`}</Texto>
            <Texto>{feito ? 'Feito' : 'Falta fazer'}</Texto>
            <Botao
              rotulo={`${feito ? 'Desmarcar' : 'Marcar como feito'}: ${i.titulo}`}
              variante="secundario"
              onPress={() => void alternar(i.id)}
            />
          </View>
        );
      })}
      {aviso ? <Texto accessibilityRole="alert" accessibilityLiveRegion="polite">{aviso}</Texto> : null}
      <Botao rotulo="Continuar" onPress={() => void continuar()} />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { padding: espacos.m, gap: espacos.m },
  caixa: { gap: espacos.p, borderWidth: 2, borderColor: cores.petroleo, borderRadius: 12, padding: espacos.m, backgroundColor: cores.branco },
  titulo: { fontSize: 20, lineHeight: 28 },
});
