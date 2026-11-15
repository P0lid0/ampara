import { StyleSheet, View } from 'react-native';
import { cores, fontes } from '../theme/tokens';
import { Texto } from './Texto';

// 'aberta' | 'cancelada' | 'encerrada' são os `estado` do contrato (Aberta|Cancelada|Encerrada).
export type Estado = 'aberta' | 'cancelada' | 'encerrada' | 'teste' | 'online' | 'offline' | 'feito' | 'pendente';

// Sempre texto + ícone; a cor só reforça. Pares texto/fundo constam em paresDeTexto.
const mapa: Record<Estado, { texto: string; icone: string; fundo: string; cor: string }> = {
  aberta: { texto: 'Aberta', icone: '⚠', fundo: cores.alarme, cor: cores.sobreAlarme },
  cancelada: { texto: 'Cancelada', icone: '✕', fundo: cores.areia, cor: cores.tinta },
  encerrada: { texto: 'Encerrada', icone: '■', fundo: cores.petroleo, cor: cores.areia },
  teste: { texto: 'Teste', icone: '◇', fundo: cores.areia, cor: cores.petroleo },
  online: { texto: 'Conectado', icone: '●', fundo: cores.esmeralda, cor: cores.tinta },
  offline: { texto: 'Sem conexão', icone: '○', fundo: cores.areia, cor: cores.tinta },
  feito: { texto: 'Feito', icone: '✓', fundo: cores.esmeralda, cor: cores.tinta },
  pendente: { texto: 'Pendente', icone: '◔', fundo: cores.areia, cor: cores.tinta },
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
      <Texto testID={`estado-icone-${estado}`} variante="legenda" style={[estilos.icone, { color: e.cor }]}>
        {e.icone}
      </Texto>
      <Texto variante="legenda" style={[estilos.texto, { color: e.cor }]}>
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
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  icone: { marginRight: 6 },
  texto: { fontFamily: fontes.semibold },
});
