# claude-mods

Claude Code 화면을 바꾸는 mod 모음입니다.

## 설치

Claude Code에서 아래 두 줄을 입력합니다.

```
/plugin marketplace add kkchori511/claude-mods
/plugin install usage-band-plus@claude-mods
```

설치한 뒤 Claude Code를 다시 시작하면 적용됩니다.

## mod 목록

### usage-band-plus

프롬프트 입력창 위에 사용량 표를 보여 줍니다.

```
┌──────────┬────────────┬────────────┬────────────┬───────────┐
│  Usage   │  Context   │   5-hour   │   Weekly   │   Cache   │
├──────────┼────────────┼────────────┼────────────┼───────────┤
│          │     6%     │    20%     │    51%     │   ▐▆▆▆▌   │
│  (로고)  │ █░░░░░░░░░ │ ██░░░░░░░░ │ █████░░░░░ │   ▐███▌   │
│          │  59k / 1M  │   3h 54m   │   2d 16h   │  52m 10s  │
└──────────┴────────────┴────────────┴────────────┴───────────┘
        Model : claude-opus-5-5 / Effort : medium (2/5)
```

- **Usage**: 움직이는 Claude 마스코트. 응답에 쓴 토큰이 많을수록 빨리 움직입니다.
- **Context**: 컨텍스트 창 사용률과 토큰 수
- **5-hour / Weekly**: 사용 한도 사용률과 초기화까지 남은 시간
- **Cache**: 프롬프트 캐시가 만료될 때까지 남은 시간. 배터리 모양으로 줄어들며 50% 아래는 노랑, 20% 아래는 빨강입니다. 1초마다 갱신됩니다.
  - 마지막 메인 응답부터 셉니다. 유지 시간은 기본 1시간이며, 모델을 바꿀 때 엔진이 알려 주는 값(5분/1시간)으로 바뀝니다.
- **Model / Effort**: 지금 쓰는 모델과 effort 단계

```
/plugin install usage-band-plus@claude-mods
```

### usage-band

usage-band-plus의 예전 버전입니다. Cache 칸과 Model/Effort 줄 대신 세션 비용을 보여 줍니다. 둘을 함께 켜면 표가 두 개 나오니 하나만 켜세요.

```
/plugin install usage-band@claude-mods
```

## 개발

각 mod 폴더에서 검사와 테스트를 돌릴 수 있습니다.

```
claude plugin validate mods/usage-band-plus
claude plugin test mods/usage-band-plus
```

## 라이선스

MIT
