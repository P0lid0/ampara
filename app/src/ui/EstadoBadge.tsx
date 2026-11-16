import { StyleSheet, View } from 'react-native';
import { bordas, cores, espacos, fontes, raios } from '../theme/tokens';
import { Icone, type NomeIcone } from './Icone';
import { Texto } from './Texto';

// 'aberta' | 'cancelada' | 'encerrada' são os `estado` do contrato (Aberta|Cancelada|Encerrada).
export type Estado = 'aberta' | 'cancelada' | 'encerrada' | 'teste' | 'online' | 'offline' | 'feito' | 'pendente';

// Sempre texto + ícone vetorial; a cor só reforça. Pares texto/fundo constam em paresDeTexto.
export const iconesEstado: Record<Estado, NomeIcone> = {
  aberta: 'alerta',
  cancelada: 'fechar',
  encerrada: 'parar',
  teste: 'teste',
  online: 'ponto',
  offline: 'anel',
  feito: 'ok',
  pendente: 'relogio',
};

const mapa: Record<Estado, { texto: string; fundo: string; cor: string }> = {
  aberta: { texto: 'Aberta', fundo: cores.alarme, cor: cores.sobreAlarme },
  cancelada: { texto: 'Cancelada', fundo: cores.areia, cor: cores.tinta },
  encerrada: { texto: 'Encerrada', fundo: cores.petroleo, cor: cores.areia },
  teste: { texto: 'Teste', fundo: cores.areia, cor: cores.petroleo },
  online: { texto: 'Conectado', fundo: cores.esmeraldaSuave, cor: cores.tinta },
  offline: { texto: 'Sem conexão', fundo: cores.areia, cor: cores.tinta },
  feito: { texto: 'Feito', fundo: cores.esmeraldaSuave, cor: cores.tinta },
  pendente: { texto: 'Pendente', fundo: cores.areia, cor: cores.tinta },
};

export function EstadoBadge({ estado }: { estado: Estado }) {
  const e = mapa[estado];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Estado: ${e.texto}`}
      style={[estilos.badge, { backgroundColor: e.fundo, borderColor: e.cor }]}
    >
      <Icone testID={`estado-icone-${estado}`} nome={iconesEstado[estado]} tamanho={16} cor={e.cor} />
      <Texto variante="rotulo" style={[estilos.texto, { color: e.cor }]}>
        {e.texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: espacos.p - espacos.xs,
    borderRadius: raios.pilula,
    borderWidth: bordas.fina,
    paddingHorizontal: espacos.pm,
    paddingVertical: espacos.xs,
  },
  texto: { fontFamily: fontes.semibold },
});
