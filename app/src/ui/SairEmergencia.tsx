// Modo emergência (aparelho emprestado): "Sair deste aparelho" em toda tela que esse escopo abre
// (Histórico, ocorrência, rota e BO), já que Ajustes não existe nele. Sair só limpa a memória e volta à entrada.
import { sair, useSessao } from '../auth/sessao';
import { Botao } from './Botao';

export function SairEmergencia() {
  const { escopo } = useSessao();
  if (escopo !== 'emergencia') return null;
  return (
    <Botao
      rotulo="Sair deste aparelho"
      variante="secundario"
      dica="Encerra o modo emergência e tira seus dados da tela"
      onPress={() => void sair()}
    />
  );
}
