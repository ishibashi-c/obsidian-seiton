# Seiton

[English](README.md) · [日本語](README-ja.md) · [Deutsch](README-de.md) · [Español](README-es.md) · [Français](README-fr.md) · [한국어](README-ko.md) · [Português](README-pt_BR.md) · [简体中文](README-zh_cn.md)

먼저 기록하고, 필요할 때 찾아서 다시 사용하세요.

Seiton은 Markdown Vault에 메모, 참고 자료, 작업, 독서 기록을 보관하는 Obsidian 플러그인입니다. 저장할 때 폴더나 태그를 정하지 않아도 됩니다. 받은 편지함에 두었다가 나중에 찾아 정리할 수 있습니다.

> 스크린샷과 GIF는 가상의 샘플 노트로 만들었습니다. Seiton은 아직 Obsidian 커뮤니티 플러그인 목록에 없습니다.

![Seiton 흐름: 기록, 탐색, 정리](docs/images/readme/workflow.gif)

## 개발 버전 설치

Obsidian 1.13.7 이상이 필요합니다. 소스 빌드에는 Git, Node.js, npm도 필요합니다. 아직 커뮤니티 플러그인 목록에서는 설치할 수 없습니다.

1. 소스를 내려받고 빌드합니다.

   ```sh
   git clone https://github.com/ishibashi-c/obsidian-seiton.git
   cd obsidian-seiton
   npm ci
   npm run build
   ```

2. `<Vault>/.obsidian/plugins/seiton/`을 만들고 저장소의 `main.js`, `manifest.json`, `styles.css`를 복사합니다.
3. Obsidian을 다시 불러온 뒤 **설정 → 커뮤니티 플러그인**에서 Seiton을 활성화합니다. 초기 설정에서 언어, 사용할 유형, 선택 모듈을 정합니다.

## 기록하고, 찾고, 정리하기

1. 홈에서 짧은 메모를 남기거나 구조화된 노트를 만듭니다.
2. 분류하기 어려운 내용은 받은 편지함에 둡니다. 유형, 폴더, 태그는 나중에 정해도 됩니다.
3. Seiton 노트와 설정한 추가 폴더를 검색하거나 라이브러리에서 폴더, 유형, 태그, 목록으로 찾아봅니다.
4. 필요할 때 노트의 폴더나 메타데이터를 바꾸고, 보관 폴더로 이동합니다.

### 필요한 선택 모듈 고르기

홈, 검색, 라이브러리, 받은 편지함 정리, 보관함이 기본 흐름을 지원합니다. 책장, 메모 회고, 리치 카드, 편집기 도구 모음 같은 선택 모듈은 설정에서 켜거나 끌 수 있습니다.

<details>
<summary>홈, 라이브러리, 정리 화면 보기</summary>

![빠른 기록과 주요 화면이 있는 홈](docs/images/readme/home.png)

![폴더, 유형, 목록으로 필터링하는 라이브러리](docs/images/readme/library.png)

![메타데이터를 편집할 수 있는 받은 편지함](docs/images/readme/organize.png)

</details>

## 노트 저장과 네트워크 사용

노트는 Vault 안의 일반 Markdown 파일로 남습니다. Seiton은 알 수 없는 frontmatter 필드를 보존하고, 네트워크가 없어도 로컬 노트를 사용할 수 있습니다. 기록, 검색, 정리에 AI는 필요하지 않습니다.

### 외부 AI 도구는 선택 사항

Seiton에는 AI 모델이 내장되어 있지 않고 Vault 내용을 AI 서비스로 보내지도 않습니다. 외부 AI 도구를 사용하면 Markdown 정리안을 만들 수 있습니다. Seiton에서 이동 위치와 메타데이터를 확인한 뒤 적용할 변경 사항을 선택합니다.

### 네트워크를 사용하는 기능

Seiton에는 호스팅 계정, 분석, 텔레메트리, 광고, 내장 LLM이 없습니다. 웹 클립 메타데이터, 도서 검색, 선택형 일본 도서관 검색처럼 사용자가 실행하거나 활성화한 기능만 네트워크를 요청합니다. 전송 대상과 데이터는 [개인정보 및 네트워크 안내](docs/privacy-and-network.md)를 확인하세요. 개인 토큰이 포함된 URL은 웹 클립으로 저장하지 마세요.

웹 클립은 저장한 페이지와 해당 페이지의 이미지 서버에서 메타데이터와 이미지를 가져옵니다. 대체 도메인 아이콘에는 Google의 favicon 서비스를 사용합니다. ISBN 메타데이터와 표지는 openBD와 Open Library에서 가져오며, 제목·저자 검색에는 Open Library를 사용합니다.

### 리치 카드 도메인 제한

설정에서 차단 도메인을 하나씩 추가하거나 삭제할 수 있습니다. 차단 도메인이 있으면 카드와 제목을 자동으로 가져올 때 리디렉션을 거부하는 브라우저 전송 방식을 사용합니다. 리디렉션이 있거나 CORS로 응답에 접근할 수 없으면 URL만 표시하는 카드로 대체됩니다. 노트와 저장된 URL은 계속 사용할 수 있습니다. 안전하게 가져올 수 없는 이미지와 원격 favicon은 생략하며, 로컬 캐시 이미지는 현재 설정에 따라 확인합니다. 설정을 바꾸면 기존 카드도 갱신됩니다. 차단 도메인이 없으면 일반 Obsidian 전송 방식을 사용합니다.

Calil 도서관 소장 검색과 일본 국토지리원(GSI)의 시·구·정·촌 및 주소 검색은 일본어 UI에서만 제공하며 일본 내 도서관을 대상으로 합니다. Calil에는 사용자 본인의 API 키가 필요합니다. 다른 UI 언어에서는 이 도서관 기능을 숨깁니다. 책장과 도서 검색은 다른 언어에서도 사용할 수 있습니다.

## 개발

| 명령어 | 용도 |
|---|---|
| `npm test` | 테스트 실행 |
| `npm run build` | 타입 검사 및 플러그인 빌드 |
| `npm run harness` | UI Lab 실행 |
| `npm run lint` | lint 실행 |
| `npm run release:check` | 테스트, 두 빌드 및 릴리스 파일 검사 |

[제품 사양](spec.md) · [구현 로드맵](docs/implementation-roadmap.md) · [UI Lab 경로와 테스트 데이터](docs/ui-mock-map.md) · [릴리스 체크리스트](docs/release-checklist.md) · [개발 규칙](AGENTS.md)

## 라이선스와 데이터 출처

MIT © 2026 IshibashiCustomize. [LICENSE](LICENSE)와 [제3자 고지](THIRD_PARTY_NOTICES.md)를 참조하세요. 도서 데이터와 표지 출처: [openBD](https://openbd.jp/) 및 [Open Library](https://openlibrary.org/developers/api).
