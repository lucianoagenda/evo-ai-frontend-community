# Deploy do frontend Traggi

## Como a imagem é gerada

Todo push na branch `main` dispara o workflow `.github/workflows/traggi-docker.yml`,
que publica a imagem no GitHub Container Registry com duas tags:

- `ghcr.io/lucianoagenda/evo-crm-frontend-traggi:<sha-do-commit>` (use esta)
- `ghcr.io/lucianoagenda/evo-crm-frontend-traggi:latest`

Acompanhe em **GitHub → Actions → "Traggi - build imagem frontend"** e espere o job
ficar verde (alguns minutos) antes de atualizar o servidor.

## Atualizando o servidor

1. Pegue o SHA completo do commit publicado (`git log -1 --format=%H` ou na página do
   workflow).
2. No `docker-compose` do servidor (Coolify/Portainer ou arquivo local), troque **só** a
   tag do serviço `evocrm_frontend`:

   ```yaml
   evocrm_frontend:
     image: 'ghcr.io/lucianoagenda/evo-crm-frontend-traggi:<sha-do-commit>'
   ```

3. Recrie apenas o frontend:

   ```bash
   docker compose pull evocrm_frontend
   docker compose up -d evocrm_frontend
   ```

   Não é preciso reiniciar banco, Redis nem o backend — o frontend é estático (nginx).
4. No navegador, faça um recarregamento forçado (Ctrl+F5) para não usar o bundle antigo
   em cache.

Prefira sempre a tag com SHA em vez de `latest`: o deploy fica reproduzível e o
rollback é só voltar para o SHA anterior e repetir o passo 3.

## Conferência rápida após o deploy

- Abra outra tela do CRM (ex.: Pipelines), depois vá para **Conversas**: a lista e o
  chip de status selecionado devem bater (ex.: "Pendentes" marcado → só pendentes).
- Troque de chip e repita a navegação: a tela volta no último filtro escolhido, já
  coerente, sem precisar clicar em Arquivadas → Ativas.
