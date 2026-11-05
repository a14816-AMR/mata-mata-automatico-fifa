# Mata-Mata · Torneio EA FC em Duplas

Aplicação web para organizar um torneio de FIFA / EA FC em duplas com sistema de mata-mata:
registo das duplas com clube, organização dos confrontos por drag and drop, BYE escolhidos pelo
administrador, resultados com penáltis, avanço automático dos vencedores e página pública
atualizada em tempo real.

- **Frontend:** React 18 + Vite, `@dnd-kit` (drag and drop com rato, toque e teclado)
- **Backend:** Python + FastAPI (função serverless na Vercel)
- **Base de dados:** Supabase (PostgreSQL), com **Realtime** para sincronização
- **Deploy:** Vercel (frontend estático + API Python no mesmo domínio)

---

## Funcionalidades

| Área | O que faz |
| --- | --- |
| **Duplas** | Definir a quantidade (2 a 64), nome de cada dupla e um clube através de uma grelha só com logótipos. Cada dupla tem exatamente um clube. |
| **Confrontos** | Gera automaticamente a estrutura (todas as fases). O administrador arrasta cada dupla para o confronto que quiser, troca posições (largar sobre uma dupla troca as duas) ou toca numa dupla e depois no lugar (útil em telemóvel). Uma dupla sozinha num confronto recebe **BYE**. Nunca há BYE atribuído automaticamente. Tudo é guardado no Supabase a cada alteração. |
| **Resultados** | Golos de cada dupla e "Houve disputa de penáltis?" (Sim/Não). Com "Sim", aparecem os campos dos penáltis. Um empate não pode ser guardado sem penáltis. O resultado normal e o dos penáltis ficam guardados em separado. O vencedor avança logo para o lugar certo da fase seguinte. |
| **Correções** | Se um resultado mudar e o vencedor for outro, as partidas seguintes que dependiam dele são anuladas e o novo vencedor ocupa o lugar (com aviso prévio). É possível apagar um resultado ou reiniciar todos os resultados mantendo a colocação inicial. |
| **Página pública** | Duplas participantes (em prova, eliminada ou campeã), chaveamento completo com a final ao centro, vista "Por fases" para telemóvel, últimos resultados com penáltis, campeã em destaque. Atualiza-se sozinha via Supabase Realtime, sem recarregar a página. É só de leitura. |

### Fases e BYE

O chaveamento tem sempre um tamanho que é potência de 2 (2, 4, 8, 16, 32, 64). O número de BYE
necessários é `tamanho − número de duplas`:

| Duplas | Chaveamento | BYE | Primeira fase |
| --- | --- | --- | --- |
| 8 | 8 | 0 | Quartos de final |
| 12 | 16 | 4 | Oitavos de final |
| 16 | 16 | 0 | Oitavos de final |
| **18** | **32** | **14** | Dezasseis-avos de final |
| 24 | 32 | 8 | Dezasseis-avos de final |

> **Com 18 duplas:** para chegar a uns oitavos com 16 equipas, só **2 jogos** se disputam nos
> dezasseis-avos (4 duplas) e as outras **14 duplas passam com BYE**. Dar BYE a apenas 2 duplas não
> fecha a conta: as outras 16 jogariam 8 partidas, e 8 vencedores + 2 BYE dão 10 equipas, que não
> formam um mata-mata. O administrador escolhe quais são as 4 duplas que jogam e quais as 14 que
> passam diretamente.

As fases têm nomes automáticos: Dezasseis-avos de final, Oitavos de final, Quartos de final,
Meias-finais e Final (e "Trinta e dois avos de final" com mais de 32 duplas).

---

## Arquitetura

```
Browser ──► Vercel ──► frontend/dist (React, estático)
   │          └──────► /api/*  → api/index.py → backend/ (FastAPI) ──► Supabase (service role)
   │                                                                    │
   └──── Supabase Realtime (chave anon, só leitura) ◄───────────────────┘
```

- **Toda a escrita passa pelo backend**, que valida as regras do torneio e usa a *service role key*.
- O RLS do Supabase só permite **leitura pública**. Um visitante não consegue alterar dados, mesmo
  com a chave anon.
- A página pública lê o estado em `/api/state` e subscreve alterações das tabelas `tournaments`,
  `teams` e `matches` no Realtime. Quando chega uma alteração, volta a carregar o estado. Se o
  Realtime não estiver disponível, atualiza a cada 15 segundos.
- A lógica do mata-mata (`backend/bracket.py`) é pura e testada à parte. Cada operação calcula
  todas as partidas afetadas e grava-as num único pedido (*upsert*).
- O acesso de administração usa a palavra-passe `ADMIN_PASSWORD`. Depois de entrar, o administrador
  recebe um token assinado (HMAC) com validade.

### Estrutura

```
api/index.py              Entrada da função serverless da Vercel
backend/
  bracket.py              Regras do mata-mata: tamanhos, fases, BYE, vencedor, propagação
  service.py              Operações do torneio (lógica + persistência)
  main.py                 Rotas FastAPI (/api/...)
  db.py                   Cliente REST do Supabase
  auth.py                 Login e token de administrador
  tests/                  Testes (pytest): lógica e fluxo completo da API
frontend/
  src/pages/PublicPage.jsx          Página pública
  src/pages/AdminPage.jsx           Administração (3 passos)
  src/pages/admin/TeamsStep.jsx     Registo de duplas + seletor de logótipos
  src/pages/admin/DrawStep.jsx      Drag and drop dos confrontos / BYE
  src/pages/admin/ResultsStep.jsx   Introdução de resultados
  src/components/Bracket.jsx        Chaveamento visual (final ao centro)
  src/hooks/useTournamentState.js   Estado + Realtime
  public/clubs/                     Logótipos dos 30 clubes
shared/clubs.json         Lista fixa dos 30 clubes (usada por frontend e backend)
supabase/schema.sql       Tabelas, restrições, RLS e publicação Realtime
scripts/fetch_logos.py    (Re)descarrega os logótipos
```

---

## 1. Configurar o Supabase

1. Crie um projeto em <https://supabase.com>.
2. Abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute-o.
   O script pode ser executado mais do que uma vez. Cria as tabelas, as restrições (por exemplo,
   uma partida empatada não pode ficar concluída sem penáltis), o RLS de leitura pública e adiciona
   as tabelas à publicação `supabase_realtime`.

   **Base de dados já criada antes?** Execute também os ficheiros de
   [`supabase/migrations/`](supabase/migrations/) por ordem, no mesmo **SQL Editor**
   (por exemplo, `001_team_players.sql` acrescenta o nome dos jogadores a cada dupla).
3. Copie os dados do projeto:
   - **Project URL** (`https://<id>.supabase.co`, em **Project Settings → Data API**, ou no botão **Connect**) → `SUPABASE_URL` e `VITE_SUPABASE_URL`
   - Em **Project Settings → API Keys**:
     - **Publishable key** (`sb_publishable_…`) → `VITE_SUPABASE_ANON_KEY`
     - **Secret key** (`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY` (**secreta**: só no servidor)
   - As chaves antigas (`anon` / `service_role`, em "Legacy API keys") também funcionam, mas vão ser retiradas em 2027.

## 2. Variáveis de ambiente

| Variável | Onde | Descrição |
| --- | --- | --- |
| `SUPABASE_URL` | backend | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Chave service role (nunca no frontend) |
| `ADMIN_PASSWORD` | backend | Palavra-passe da área `/admin` |
| `ADMIN_TOKEN_SECRET` | backend | Segredo longo e aleatório para assinar as sessões |
| `ADMIN_TOKEN_TTL_HOURS` | backend | Validade da sessão (por omissão 24) |
| `CORS_ORIGINS` | backend | Só é necessária se o frontend estiver noutro domínio |
| `VITE_SUPABASE_URL` | frontend (build) | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | frontend (build) | Chave anon (só leitura, usada no Realtime) |

Gerar um segredo: `python -c "import secrets; print(secrets.token_hex(32))"`

## 3. Desenvolvimento local

Requisitos: Python 3.11+ e Node 18+.

```bash
cp .env.example .env          # preencher com os dados do Supabase

# Backend
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn backend.main:app --reload --port 8000

# Frontend (noutro terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173  (proxy de /api para a porta 8000)
```

- Página pública: <http://localhost:5173/>
- Administração: <http://localhost:5173/admin>
- Documentação da API: <http://localhost:8000/api/docs>
- Diagnóstico: <http://localhost:8000/api/health> indica as variáveis em falta.

Testes do backend:

```bash
pytest backend
```

## 4. Publicar na Vercel

1. Envie o repositório para o GitHub.
2. Em <https://vercel.com/new>, importe o repositório. **Não altere o Root Directory**: tem de ser a
   raiz. O `vercel.json` já define a instalação, o build (`frontend/dist`) e a função Python
   `api/index.py`.
3. Em **Settings → Environment Variables**, adicione todas as variáveis da tabela acima, incluindo
   as `VITE_*`, que são lidas durante o build.
4. Faça o deploy. O endereço `https://<projeto>.vercel.app` mostra a página pública e
   `https://<projeto>.vercel.app/admin` a administração.
5. Para confirmar, abra `https://<projeto>.vercel.app/api/health`. Deve devolver `"ok": true`.

Se mudar alguma variável `VITE_*`, faça um novo deploy, porque estas variáveis entram no build.

Também pode publicar pela linha de comandos: `npm i -g vercel && vercel --prod`.

## 5. Como usar no dia do torneio

1. **/admin** → introduza a palavra-passe → **Criar torneio**.
2. **Duplas:** defina a quantidade, escreva os nomes e toque no "+" de cada dupla para escolher o
   clube. Os clubes já escolhidos ficam indisponíveis. Depois, **Gerar chaveamento**.
3. **Confrontos:** arraste as duplas para os confrontos. As caixas mostram que pares se encontram na
   fase seguinte. Uma dupla sozinha recebe BYE, e o contador indica quantos BYE faltam. Tudo é
   guardado automaticamente. Quando não houver duplas por colocar nem confrontos vazios, carregue
   em **Iniciar torneio**. A partir daí, as posições ficam fixas.
4. **Resultados:** toque num confronto, introduza os golos e, em caso de empate, escolha "Sim" em
   "Houve disputa de penáltis?" e introduza os penáltis. O vencedor avança automaticamente.
5. Partilhe o endereço público: todos acompanham o torneio em tempo real.

Pode criar um **Novo torneio** quando quiser. O anterior fica guardado na base de dados e a página
pública passa a mostrar o mais recente.

## Logótipos

Os logótipos dos 30 clubes estão em `frontend/public/clubs/<id>.png` e foram obtidos na Wikipedia.
Para os voltar a descarregar: `python scripts/fetch_logos.py --force`. Se faltar algum ficheiro, a
aplicação mostra um escudo com as cores e as iniciais do clube. Os logótipos são marcas dos
respetivos clubes e estão aqui apenas para os identificar num torneio privado. A identidade visual
da aplicação é própria e não usa logótipos nem elementos da UEFA.

## API (resumo)

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/state` | público: torneio atual, duplas, partidas, fases, campeã |
| GET | `/api/clubs`, `/api/health` | público |
| POST | `/api/auth/login` | público: devolve o token |
| POST / PATCH / DELETE | `/api/tournaments[/{id}]` | admin |
| PUT | `/api/tournaments/{id}/teams` | admin (fase de inscrições) |
| POST / DELETE | `/api/tournaments/{id}/bracket` | admin: gerar chaveamento / voltar às duplas |
| PUT | `/api/tournaments/{id}/layout` | admin: colocação da 1.ª fase (drag and drop) |
| POST | `/api/tournaments/{id}/start` · `/reset` | admin |
| PUT / DELETE | `/api/matches/{id}/result` | admin |
