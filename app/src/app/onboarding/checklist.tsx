import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { abrirBanco } from '../../db/db';
import { concluirPassoSeguro } from '../../onboarding/passos';
import { ITENS_CHECKLIST, lerChecklist, marcarItem, type IdItemChecklist } from '../../prevencao/checklist';
import { bordas, cores, espacos, raios } from '../../theme/tokens';
import { Aviso } from '../../ui/Aviso';
import { Botao } from '../../ui/Botao';
import { Icone } from '../../ui/Icone';
import { TelaPasso } from '../../ui/TelaPasso';
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
      setAviso('Não foi possível salvar. Tente de novo.');
    }
  }

  async function continuar() {
    await concluirPassoSeguro('checklist'); // os itens são conselho: pendentes não travam o passo
    router.replace('/');
  }

  const total = ITENS_CHECKLIST.length;
  const n = ITENS_CHECKLIST.filter((i) => feitos[i.id]).length;

  return (
    <TelaPasso
      passo="checklist"
      titulo="Antes que aconteça"
      acao={<Botao rotulo="Continuar" onPress={() => void continuar()} />}
    >
      <Texto>Três cuidados simples deixam um roubo menos grave. Faça agora ou volte depois em Ajustes.</Texto>
      <Texto variante="corpoForte" accessibilityLiveRegion="polite">{`${n} de ${total} feitos`}</Texto>
      {ITENS_CHECKLIST.map((i) => {
        const feito = feitos[i.id];
        return (
          <View key={i.id} style={estilos.caixa}>
            <Texto variante="secao" accessibilityRole="text">
              {i.titulo}
            </Texto>
            <Texto>{`Como fazer: ${i.comoFazer}`}</Texto>
            <View style={[estilos.estado, feito && estilos.estadoFeito]}>
              <Icone nome={feito ? 'ok' : 'relogio'} tamanho={16} cor={cores.tinta} />
              <Texto variante="rotulo">{feito ? 'Feito' : 'Falta fazer'}</Texto>
            </View>
            <Botao
              rotulo={`${feito ? 'Desmarcar' : 'Marcar como feito'}: ${i.titulo}`}
              variante="secundario"
              onPress={() => void alternar(i.id)}
            />
          </View>
        );
      })}
      {aviso ? <Aviso mensagem={aviso} /> : null}
    </TelaPasso>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    gap: espacos.p,
    borderWidth: bordas.fina,
    borderColor: cores.bordaSuave,
    borderRadius: raios.m,
    padding: espacos.m,
    backgroundColor: cores.branco,
  },
  // Estado sempre em texto e ícone; o fundo só reforça.
  estado: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacos.p,
    borderRadius: raios.pilula,
    borderWidth: bordas.fina,
    borderColor: cores.petroleo,
    paddingHorizontal: espacos.pm,
    paddingVertical: espacos.xs,
    backgroundColor: cores.areia,
  },
  estadoFeito: { backgroundColor: cores.esmeraldaSuave },
});
