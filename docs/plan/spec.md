# 근거 문서 — agent-office

이 포크(`heejunKIM01/agent-office`)가 무엇을 만들지 정하는 문서다. 원본(`paulrobello/claude-office`)의 사무실 시각화를 바탕으로, 아래 게시물이 보여 준 동작을 그대로 재현한다.
게시물은 Claude Code 이야기지만 이 포크는 특정 에이전트에 묶이지 않는다. 같은 사무실 동작을 다른 코딩 에이전트에도 적용한다(아래 「에이전트 범위」).

## 출처

Threads [@cowboy76 게시물](https://www.threads.com/@cowboy76/post/DeqgY7wiJYa) 본문 원문:

> Claude Code가 터미널에서 뭘 하고 있는지 한눈에 보고 싶어서 사무실을 하나 차려줬다.
> 파일 읽을 땐 자료실 가서 책 펴고 명령 돌릴 땐 서버실 랙 앞에 서 있고 막히면 그 자리에서 턱 괴고 고민함.
> 일을 나눠 맡기면 서브에이전트가 엘리베이터 타고 출근한다 🛗 전부 내 터미널이랑 실시간으로 같이 움직임.

첨부 영상은 로그인 없이 볼 수 없어서 본문 문장만 근거로 삼는다. 방 배치 · 그림 · 연출 시간은 이 문서가 정한다.

## 요구사항

| ID | 원문 | 화면 동작 | 트리거 (Claude Code 훅) |
|---|---|---|---|
| R1 | 파일 읽을 땐 자료실 가서 책 펴고 | 캐릭터가 자료실 책장 앞으로 걸어가 책을 펴 든다 | 도구 시작 이벤트의 도구가 읽기 도구 — Claude Code 는 `Read` · `Grep` · `Glob` · `LS` · `NotebookRead` · `WebFetch` · `WebSearch`, 다른 에이전트는 「에이전트 범위」 표 |
| R2 | 명령 돌릴 땐 서버실 랙 앞에 서 있고 | 서버실 랙 앞에 서 있는다. 랙 LED 가 깜빡인다 | 도구 시작 이벤트의 도구가 명령 도구 — Claude Code 는 `Bash` · `PowerShell` · `BashOutput` · `KillShell` · `KillBash`, 다른 에이전트는 「에이전트 범위」 표 |
| R3 | 막히면 그 자리에서 턱 괴고 고민함 | 걷지 않고 지금 자리에서 턱을 괸다. 생각 말풍선이 뜬다 | 도구 실패(`PostToolUseFailure`) · 권한 대기(`PermissionRequest`) · 턴 진행 중 도구 없이 오래 생각함 |
| R4 | 서브에이전트가 엘리베이터 타고 출근한다 | 서브에이전트가 엘리베이터에서 내려 자리로 간다 | `SubagentStart` · `PreToolUse(Agent/Task)` — 원본에 있다. 유지하고 확인한다 |
| R5 | 전부 내 터미널이랑 실시간으로 같이 움직임 | 훅 → 백엔드 → 웹소켓으로 바로 반영된다 | 모든 훅 — 원본에 있다. 실제 세션으로 확인한다 |

- `WebFetch` · `WebSearch` 는 "자료를 찾아 읽는" 일이라 R1 에 묶는다.
- 도구 실패 훅 `PostToolUseFailure` 는 `error` · `is_interrupt` · `tool_use_id` 를 준다([훅 문서](https://code.claude.com/docs/en/hooks)). 원본 훅 설치기는 이 이벤트를 등록하지 않아서 R3 에서 추가한다.
- `PermissionRequest` 입력에는 `tool_use_id` 가 없다. 권한 대기는 도구 단위가 아니라 캐릭터 단위로 판정한다.
- R1 · R2 는 사장(메인 Claude)과 서브에이전트(직원) 모두에게 적용한다. 직원 쪽은 사장 동선이 끝난 뒤 따로 붙인다.

## 에이전트 범위

사무실 동작(R1–R5)은 에이전트와 상관없이 같다. 에이전트마다 다른 것은 "어떤 도구가 읽기 · 명령인가" 와 "이벤트를 어떻게 받는가" 뿐이라, 도구 이름 → 활동 매핑을 한곳(백엔드)에 두고 대소문자를 가리지 않는다.

| 에이전트 | 이벤트 수단 (원본 기준) | R1 읽기 도구 | R2 명령 도구 |
|---|---|---|---|
| Claude Code | 훅 — 원본이 지원한다 | `Read` · `Grep` · `Glob` · `LS` · `NotebookRead` · `WebFetch` · `WebSearch` | `Bash` · `PowerShell` · `BashOutput` · `KillShell` · `KillBash` |
| OpenCode | 플러그인 `opencode-plugin/` — 원본이 지원한다 | `read` · `grep` · `glob` · `webfetch` · `websearch` | `bash` |
| Gemini CLI | 훅(`BeforeTool` · `AfterTool` …) — 원본은 조사 · 설계만 있었고 이 포크가 붙였다(09, `make gemini-hooks-install`) | `read_file` · `read_many_files` · `glob` · `grep_search` · `search_file_content` · `list_directory` · `web_fetch` · `google_web_search` | `run_shell_command` |
| Codex CLI | 훅(실험 기능) — 원본 조사(2026-04) 기준 셸 도구만 잡힌다. 붙이기 전에 현재 문서로 다시 확인한다 | 확인 필요 | `shell` 계열 |

- 도구 이름 출처: Claude Code [훅 문서](https://code.claude.com/docs/en/hooks), OpenCode [도구 문서](https://opencode.ai/docs/tools/), Gemini CLI `docs/research/google-gemini-cli-hooks.md`, Codex `docs/research/openai-codex-hooks.md`.
- Claude Code 는 서브에이전트 안에서 부른 도구 이벤트에 그 서브에이전트의 `agent_id` 를 붙인다([훅 문서](https://code.claude.com/docs/en/hooks)). 원본 훅은 이 값을 버리고 모든 도구를 사장에게 붙였다. 이 포크는 그 값으로 해당 직원을 찾아 활동을 붙인다.
- Gemini CLI 는 서브에이전트에 훅이 없어서 R4(직원 출근)가 나오지 않는다. 명령 실패는 도구 오류가 아니라 결과의 `Exit Code:` 줄로 판정한다(09 보고서).
- 사장 이름표는 지금 "Claude" 로 고정돼 있다. 세션을 띄운 에이전트 이름(Claude · OpenCode · Gemini · Codex)을 보여 주게 바꾼다.

## 화면 배치

캔버스는 원본과 같은 1280×1024 를 유지한다. 지휘 센터(Command Center)가 같은 크기를 쓰고, 넓히면 화면 전체가 작아진다.

| 구역 | 위치 (캔버스 px) | 들어가는 것 |
|---|---|---|
| 자료실 | 왼쪽 아래 `x 0–320 · y 784–1024` | 책장, 프린터(원래 왼쪽 아래 있던 것을 안으로 옮긴다), 화분 |
| 서버실 | 오른쪽 아래 `x 960–1280 · y 784–1024` | 서버 랙(LED 깜빡임), 간판 |
| 도착 줄 | `A0 (480,930)` 다음부터 책상 사이 통로 `x=384` 를 따라 위로 | 방과 겹치지 않게 옮긴다 |
| 퇴근 줄 | `D0 (800,930)` 다음부터 책상 사이 통로 `x=896` 을 따라 위로 | 방과 겹치지 않게 옮긴다 |

- 두 방 모두 사장 책상(640,900)과 가깝다. 편도 약 500px 이라 2초 안에 닿는다.
- 방 벽은 위쪽 칸막이(앞면이 보이는 낮은 벽)와 안쪽 칸막이(문 뚫림)로 그린다. 문은 사장 책상 쪽을 본다.
- 간판 문구는 영어 기본(`ARCHIVE` · `SERVER ROOM`)이고 한국어 로케일에서는 `자료실` · `서버실` 이다.

## 동선 규칙

1. 활동(읽기 · 명령)이 시작되면 그 방의 빈 자리로 걸어간다. 도착하면 동작(책 펴기 · 랙 앞에 서기)을 한다.
2. 활동이 끝나도 1.5초는 그 자리에 머문다. 연달아 오는 `Read` 마다 왕복하지 않게 하기 위해서다.
3. 다른 활동이 오면 지금 자리에서 바로 다음 방으로 간다. 걷는 도중에도 목적지를 바꾼다.
4. 머무는 시간이 지나도 새 활동이 없으면 책상으로 돌아와 앉는다.
5. 말풍선과 이름표는 걷는 캐릭터를 따라간다.
6. 컨텍스트 압축 연출(쓰레기통 밟기)이 심부름보다 먼저다. 압축 중에는 심부름을 미룬다.
7. 고민(R3)은 자리를 옮기지 않는다. 자료실에서 막히면 자료실에서 턱을 괸다.

## 범위 밖

- 원본의 다른 기능(화이트보드 · 지휘 센터 · 빌딩 뷰)은 고치지 않는다. 깨지지 않았는지만 회귀로 본다.
- 원본 저장소(upstream)에 PR 을 보내지 않는다. 이 포크 안에서만 머지한다.
