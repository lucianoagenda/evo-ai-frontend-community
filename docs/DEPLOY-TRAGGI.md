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

## Configuração do Traggi (painel e botões)

O frontend tem dois pontos de integração com o Traggi, e cada um lê a chave em um
serviço diferente:

| Recurso | Onde aparece | Serviço que precisa da chave |
| --- | --- | --- |
| Painel do Traggi (situação + botões Devolver / Reabrir / Encerrar / Opt-out) | Barra lateral da conversa | `evocrm_crm` (backend) |
| Desativar usuário no Traggi ao excluir oportunidade | Pipelines (Kanban / card) | `evocrm_frontend` (proxy nginx) |

O painel não fala direto com o Traggi: o navegador chama o backend
(rota `conversations/:id/traggi` da API), e o backend chama a API do Traggi com a chave.
**Sem `TRAGGI_API_KEY` no `evocrm_crm`, o painel fica escondido** (o backend responde
"não configurado").

No `environment` do `evocrm_crm` adicione:

```yaml
      - TRAGGI_API_KEY=<chave da API do Traggi>
      - 'TRAGGI_API_URL=https://app.traggi.com.br'   # opcional; este já é o padrão
```

No `evocrm_frontend` continua valendo:

```yaml
      - TRAGGI_API_KEY=<chave da API do Traggi>
      - 'TRAGGI_API_URL=https://app.traggi.com.br'   # opcional; este já é o padrão
```

Depois recrie só o backend web (o painel não usa o Sidekiq):

```bash
docker compose up -d evocrm_crm
```

Observações:

- A chave fica só nos containers; nunca vai para o bundle JS nem para o navegador.
- Confirme no Traggi se a mesma chave vale para os endpoints do painel
  (`/api/agente/crm/situacao` e `/api/agente/crm/acao`) e para `/api/crm_user_disable`.
- Mesmo configurado, o painel só aparece quando o telefone do contato existe no
  agente do Traggi como **lead** ou **cliente**. Para outros contatos ele some — é
  esperado.
- Os botões exibidos vêm do próprio Traggi (campo `acoes`), seguindo as mesmas regras
  das telas do Traggi; cada ação pede confirmação antes de executar.

## Conferência rápida após o deploy

- Abra outra tela do CRM (ex.: Pipelines), depois vá para **Conversas**: a lista e o
  chip de status selecionado devem bater (ex.: "Pendentes" marcado → só pendentes).
- Troque de chip e repita a navegação: a tela volta no último filtro escolhido, já
  coerente, sem precisar clicar em Arquivadas → Ativas.
