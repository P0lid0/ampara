// Configuração do app (app.config.ts) naquilo que protege dado local.
import config from '../../app.config';

describe('app.config', () => {
  it('item 3: desliga o Auto Backup do Android (o ampara.db não vai para o backup do Google)', () => {
    expect(config.android?.allowBackup).toBe(false);
  });
});
