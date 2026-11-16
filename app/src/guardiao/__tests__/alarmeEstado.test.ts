import type { AlertaDto } from '../../api/tipos';
import { alertaEmDestaque, estadoInicial, reduzir, type EstadoAlarmes, type EventoHub } from '../alarmeEstado';
import { useAlarmes } from '../store';

// SINTETICO: nomes e ids de teste, nunca dado real.
const disparado = (alertaId: string, em = '2026-11-15T12:00:00Z', vitimaNome = 'Pessoa Demo'): EventoHub => ({
  tipo: 'AlertaDisparado',
  dado: { alertaId, ocorrenciaId: `oc-${alertaId}`, vitimaNome, origem: 'chaveiro', em },
});
const encerrado = (alertaId: string, motivo: 'ciente' | 'cancelado' | 'encerrado' = 'encerrado'): EventoHub => ({
  tipo: 'AlertaEncerrado',
  dado: { alertaId, motivo },
});
const escalado = (alertaId: string): EventoHub => ({
  tipo: 'AlertaEscalado',
  dado: { alertaId, ocorrenciaId: `oc-${alertaId}`, paraGuardiaoId: 'g-2', em: '2026-11-15T12:05:00Z' },
});

const aplicarTodos = (evs: EventoHub[], inicio: EstadoAlarmes = estadoInicial()) =>
  evs.reduce(
    (acc, ev) => {
      const r = reduzir(acc.estado, ev);
      return { estado: r.estado, efeitos: [...acc.efeitos, ...r.efeitos] };
    },
    { estado: inicio, efeitos: [] as ReturnType<typeof reduzir>['efeitos'] },
  );

describe('reduzir', () => {
  it('RF3: AlertaDisparado duas vezes com o mesmo alertaId → 1 ativo e 1 efeito tocar', () => {
    const { estado, efeitos } = aplicarTodos([disparado('a1'), disparado('a1')]);
    expect(Object.keys(estado.ativos)).toEqual(['a1']);
    expect(efeitos).toHaveLength(1);
    expect(efeitos[0]).toEqual({
      tipo: 'tocar',
      alerta: {
        alertaId: 'a1',
        ocorrenciaId: 'oc-a1',
        vitimaNome: 'Pessoa Demo',
        origem: 'chaveiro',
        em: '2026-11-15T12:00:00Z',
        cienteEnviado: false,
      },
    });
  });

  it('RF3: AlertaEncerrado → remove, efeito parar, e um AlertaDisparado posterior do mesmo alertaId (replay pós-reconexão) é ignorado', () => {
    const r1 = aplicarTodos([disparado('a1')]);
    const r2 = reduzir(r1.estado, encerrado('a1', 'encerrado'));
    expect(r2.estado.ativos).toEqual({});
    expect(r2.estado.encerrados).toContain('a1');
    expect(r2.efeitos).toEqual([{ tipo: 'parar', alertaId: 'a1', motivo: 'encerrado' }]);

    const r3 = reduzir(r2.estado, disparado('a1'));
    expect(r3.estado.ativos).toEqual({});
    expect(r3.efeitos).toEqual([]);
  });

  it('AlertaEncerrado de alertaId desconhecido → sem efeitos e sem erro', () => {
    const inicio = estadoInicial();
    let r: ReturnType<typeof reduzir> | undefined;
    expect(() => {
      r = reduzir(inicio, encerrado('nunca-visto', 'cancelado'));
    }).not.toThrow();
    expect(r!.efeitos).toEqual([]);
    expect(r!.estado.ativos).toEqual({});
    // Se o encerramento chegou antes do disparo (corrida na reconexão), o disparo atrasado não toca.
    expect(reduzir(r!.estado, disparado('nunca-visto')).efeitos).toEqual([]);
  });

  it('AlertaEscalado de alertaId já ativo → sem novo tocar; de alertaId desconhecido → efeito buscarAtivos', () => {
    const r1 = aplicarTodos([disparado('a1')]);
    const r2 = reduzir(r1.estado, escalado('a1'));
    expect(r2.efeitos).toEqual([]);
    expect(r2.estado).toEqual(r1.estado);

    const r3 = reduzir(r1.estado, escalado('a2'));
    expect(r3.efeitos).toEqual([{ tipo: 'buscarAtivos' }]);
    expect(Object.keys(r3.estado.ativos)).toEqual(['a1']);
  });

  it('AlertaEscalado de alerta já encerrado não busca nem toca', () => {
    const r = aplicarTodos([disparado('a1'), encerrado('a1', 'ciente'), escalado('a1')]);
    expect(r.efeitos).toEqual([{ tipo: 'tocar', alerta: expect.objectContaining({ alertaId: 'a1' }) }, { tipo: 'parar', alertaId: 'a1', motivo: 'ciente' }]);
  });

  it('AlertaEncerrado com motivo "ciente" (outro guardião assumiu) remove o alerta, gera efeito parar e preserva o motivo para a tela', () => {
    const r1 = aplicarTodos([disparado('a1'), disparado('a2', '2026-11-15T12:01:00Z')]);
    const r2 = reduzir(r1.estado, encerrado('a1', 'ciente'));
    expect(Object.keys(r2.estado.ativos)).toEqual(['a2']);
    expect(r2.efeitos).toEqual([{ tipo: 'parar', alertaId: 'a1', motivo: 'ciente' }]);
    expect(r2.estado.motivos.a1).toBe('ciente');
  });

  it('PassoAtualizado → efeito passo com ocorrenciaId, passo e concluidoEm', () => {
    const inicio = estadoInicial();
    const r = reduzir(inicio, { tipo: 'PassoAtualizado', dado: { ocorrenciaId: 'oc-1', passo: 'banco', concluidoEm: '2026-11-15T12:10:00Z' } });
    expect(r.efeitos).toEqual([{ tipo: 'passo', ocorrenciaId: 'oc-1', passo: 'banco', concluidoEm: '2026-11-15T12:10:00Z' }]);
    expect(r.estado).toEqual(inicio);
  });

  it('é puro: não altera o estado recebido', () => {
    const inicio = aplicarTodos([disparado('a1')]).estado;
    const copia = JSON.parse(JSON.stringify(inicio));
    reduzir(inicio, encerrado('a1'));
    reduzir(inicio, disparado('a2'));
    expect(inicio).toEqual(copia);
  });

  it('encerrados guarda só os últimos 200 alertaId (e os motivos acompanham)', () => {
    const evs: EventoHub[] = [];
    for (let i = 0; i < 205; i++) evs.push(disparado(`x${i}`), encerrado(`x${i}`, 'cancelado'));
    const { estado } = aplicarTodos(evs);
    expect(estado.encerrados).toHaveLength(200);
    expect(estado.encerrados[0]).toBe('x5');
    expect(estado.encerrados[199]).toBe('x204');
    expect(Object.keys(estado.motivos)).toHaveLength(200);
    expect(estado.motivos.x0).toBeUndefined();
  });
});

describe('alertaEmDestaque', () => {
  it('alertaEmDestaque devolve o mais antigo com cienteEnviado=false e undefined quando todos têm ciente', () => {
    const { estado } = aplicarTodos([
      disparado('novo', '2026-11-15T12:09:00Z'),
      disparado('velho', '2026-11-15T12:00:00Z'),
      disparado('meio', '2026-11-15T12:05:00Z'),
    ]);
    expect(alertaEmDestaque(estado)?.alertaId).toBe('velho');

    const semVelho: EstadoAlarmes = { ...estado, ativos: { ...estado.ativos, velho: { ...estado.ativos.velho, cienteEnviado: true } } };
    expect(alertaEmDestaque(semVelho)?.alertaId).toBe('meio');

    const todos: EstadoAlarmes = {
      ...estado,
      ativos: Object.fromEntries(Object.entries(estado.ativos).map(([k, a]) => [k, { ...a, cienteEnviado: true }])),
    };
    expect(alertaEmDestaque(todos)).toBeUndefined();
    expect(alertaEmDestaque(estadoInicial())).toBeUndefined();
  });

  it('compara horários com fusos diferentes pelo instante, não pelo texto', () => {
    const { estado } = aplicarTodos([
      disparado('utc', '2026-11-15T12:00:00Z'),
      disparado('brasilia', '2026-11-15T08:30:00-03:00'), // 11:30Z: mais antigo
    ]);
    expect(alertaEmDestaque(estado)?.alertaId).toBe('brasilia');
  });
});

describe('useAlarmes', () => {
  const dto = (alertaId: string, em: string): AlertaDto => ({ alertaId, ocorrenciaId: `oc-${alertaId}`, vitimaNome: 'Pessoa Demo', origem: 'pagina', em });

  beforeEach(() => useAlarmes.getState().limpar());

  it('carregarAtivos([a,b]) cria os dois ativos e não repete os já conhecidos', () => {
    const ef1 = useAlarmes.getState().aplicar(disparado('a', '2026-11-15T12:00:00Z'));
    expect(ef1).toHaveLength(1);

    const ef2 = useAlarmes.getState().carregarAtivos([dto('a', '2026-11-15T12:00:00Z'), dto('b', '2026-11-15T12:01:00Z')]);
    expect(Object.keys(useAlarmes.getState().estado.ativos).sort()).toEqual(['a', 'b']);
    expect(ef2).toEqual([{ tipo: 'tocar', alerta: expect.objectContaining({ alertaId: 'b', cienteEnviado: false }) }]);

    expect(useAlarmes.getState().carregarAtivos([dto('a', '2026-11-15T12:00:00Z'), dto('b', '2026-11-15T12:01:00Z')])).toEqual([]);
  });

  // Item 7: o AlertaEncerrado perdido durante a queda da rede não pode deixar a sirene tocando para sempre.
  it('item 7: reconciliarAtivos encerra (efeito "parar") o ativo local que sumiu da lista do servidor', () => {
    useAlarmes.getState().aplicar(disparado('a'));
    const pedidoEm = Date.now() + 1;
    const efeitos = useAlarmes.getState().reconciliarAtivos([], pedidoEm);
    expect(efeitos).toEqual([{ tipo: 'parar', alertaId: 'a', motivo: 'encerrado' }]);
    expect(useAlarmes.getState().estado.ativos).toEqual({});
    // e um disparo repetido depois não volta a tocar
    expect(useAlarmes.getState().aplicar(disparado('a'))).toEqual([]);
  });

  it('item 7: reconciliarAtivos preserva o alerta que chegou depois de o pedido sair, o já ciente e o de demonstração', () => {
    const pedidoEm = Date.now() - 1;
    useAlarmes.getState().aplicar(disparado('novo')); // chegou pelo hub enquanto o GET estava no ar
    useAlarmes.getState().aplicar({
      tipo: 'AlertaDisparado',
      dado: { alertaId: 'demo-a1', ocorrenciaId: 'demo-oc1', vitimaNome: 'Pessoa Demo', origem: 'chaveiro', em: '2026-11-15T12:00:00Z' },
    });
    expect(useAlarmes.getState().reconciliarAtivos([], pedidoEm)).toEqual([]);
    const pedido2 = Date.now() + 1;
    useAlarmes.getState().marcarCienteEnviado('novo');
    expect(useAlarmes.getState().reconciliarAtivos([], pedido2)).toEqual([]);
    expect(Object.keys(useAlarmes.getState().estado.ativos).sort()).toEqual(['demo-a1', 'novo']);
  });

  it('item 7: reconciliarAtivos também toca o que veio novo na lista (como carregarAtivos)', () => {
    const efeitos = useAlarmes.getState().reconciliarAtivos([dto('b', '2026-11-15T12:01:00Z')], Date.now());
    expect(efeitos).toEqual([{ tipo: 'tocar', alerta: expect.objectContaining({ alertaId: 'b' }) }]);
  });

  it('carregarAtivos não ressuscita um alerta já encerrado', () => {
    useAlarmes.getState().aplicar(disparado('a'));
    useAlarmes.getState().aplicar(encerrado('a', 'ciente'));
    expect(useAlarmes.getState().carregarAtivos([dto('a', '2026-11-15T12:00:00Z')])).toEqual([]);
    expect(useAlarmes.getState().estado.ativos).toEqual({});
  });

  it('aplicar atualiza o estado e devolve os efeitos do reducer', () => {
    const efeitos = useAlarmes.getState().aplicar(disparado('a'));
    expect(efeitos[0]).toMatchObject({ tipo: 'tocar' });
    expect(useAlarmes.getState().estado.ativos.a).toBeDefined();
  });

  it('marcarCienteEnviado tira o alerta do destaque sem removê-lo (a sirene para só com AlertaEncerrado)', () => {
    useAlarmes.getState().aplicar(disparado('a'));
    useAlarmes.getState().marcarCienteEnviado('a');
    const { estado } = useAlarmes.getState();
    expect(estado.ativos.a.cienteEnviado).toBe(true);
    expect(alertaEmDestaque(estado)).toBeUndefined();
    // id desconhecido não quebra nem cria nada
    useAlarmes.getState().marcarCienteEnviado('outro');
    expect(Object.keys(useAlarmes.getState().estado.ativos)).toEqual(['a']);
  });

  it('limpar zera ativos, encerrados e motivos (logout não deixa nome na memória)', () => {
    useAlarmes.getState().aplicar(disparado('a'));
    useAlarmes.getState().aplicar(disparado('b'));
    useAlarmes.getState().aplicar(encerrado('b', 'cancelado'));
    useAlarmes.getState().limpar();
    expect(useAlarmes.getState().estado).toEqual(estadoInicial());
  });

  it('o store não persiste nada em disco (sem SecureStore, sem SQLite)', () => {
    const secure = jest.requireMock('expo-secure-store') as { setItemAsync: jest.Mock };
    secure.setItemAsync.mockClear();
    useAlarmes.getState().aplicar(disparado('a', '2026-11-15T12:00:00Z', 'Nome Que Não Pode Ir Para O Disco'));
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });
});
