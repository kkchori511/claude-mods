# claude-mods 작업 지침

Claude Code mod 모음 저장소다. `~/projects/CLAUDE.md`의 공통 규칙도 함께 따른다.

## 원본과 설치본

- mod 원본은 이 저장소(`~/projects/claude-mods/mods/<mod>`) 한 곳에만 둔다. `~/.claude/local-mods` 같은 로컬 사본을 따로 만들지 않는다.
- 설치는 GitHub 저장소 `kkchori511/claude-mods`의 marketplace(`claude-mods`)에서 한다.
- 새 mod를 추가하면 `.claude-plugin/marketplace.json`의 `plugins`와 README의 mod 목록에 함께 적는다.

## mod를 고칠 때

1. 브랜치에서 `mods/<mod>`를 고친다.
2. 검사와 테스트를 돌린다. 둘 다 통과해야 한다.
   ```
   claude plugin validate mods/<mod>
   claude plugin test mods/<mod>
   ```
   README·LICENSE·아이콘 관련 "plugin directory" 경고는 공식 목록 제출용이라 무시해도 된다.
3. `mods/<mod>/.claude-plugin/plugin.json`의 `version`을 올린다. 버전이 같으면 설치본이 갱신되지 않는다.
4. 사용자가 말하면 merge·push한 뒤 설치본을 갱신한다.
   ```
   claude plugin marketplace update claude-mods
   claude plugin update <mod>@claude-mods
   ```
   Claude Code를 다시 시작해야 적용된다. 다시 켤 때는 `claude --continue`로 대화를 잇는다.

## 공개 저장소

- 공개 저장소다. 커밋하기 전에 모든 파일을 읽고 개인 정보·키·내부 주소가 없는지 확인한다.
- 생성되는 타입 폴더(`.claude-plugin/types/`)는 커밋하지 않는다(`.gitignore`에 있음).

## usage-band-plus 화면 규칙

- 표의 글자는 칸 가운데에 정확히 놓는다. 칸 안쪽 폭과 글자 길이의 홀짝을 맞춰 양쪽 여백이 같게 한다.
  - Cache 칸은 안쪽 폭 11, 배터리 5칸(`▐███▌`), 시간 7칸(`09m 05s`, 만료는 `Expired`).
- 글자 폭을 셀 때 한글·한자·전각·이모지만 2칸으로 센다. 블록(`█▐▌`)·점자 같은 기호는 1칸이다.
- Cache 카운트다운: 메인 대화 응답이 올 때마다 다시 시작하고(서브에이전트 응답은 제외), 1초마다 다시 그린다. 유지 시간은 기본 1시간이고, 모델을 바꿀 때(`classic.PostModelSwitch`의 `cache_ttl`)만 실제 값으로 바뀐다.
- 배터리 색: 50% 초과 초록, 20% 초과 노랑, 그 아래 빨강.
- 화면을 바꿀 때는 먼저 시안을 Ghostty 새 창에 띄워 보여 주고 확인받은 뒤 작업한다.
