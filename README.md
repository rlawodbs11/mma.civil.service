# NAVER 로그인 화면 기록기 & 동기화

네이버 로그인 화면 UI를 통해 입력된 로그인 정보를 개인 서버에 기록하고, Windows PC의 Markdown 문서(`pc-sync/captured-text.md`)로 동기화하는 로컬 개인용 도구입니다.

개인 로컬 환경용으로 토큰 인증 및 암호화 절차 없이 **서버 실행 즉시 바로 사용**할 수 있도록 간소화되었습니다.

---

## 📁 폴더 구조

```text
naverscreen/
├── public/                 # 웹 브라우저 프론트엔드
│   ├── index.html          # 네이버 로그인 화면
│   ├── style.css           # 네이버 스타일시트
│   └── app.js              # 입력 전송 스크립트
├── scripts/                # Windows PowerShell 스크립트
│   ├── sync-pc.ps1         # PC Markdown 동기화 스크립트
│   └── backup.ps1          # 데이터 ZIP 압축 백업 스크립트
├── data/                   # (자동 생성) 저장된 로그인 기록 (JSONL)
├── pc-sync/                # (자동 생성) 동기화된 마크다운 문서
├── backups/                # (자동 생성) 백업 압축 파일
├── package.json            # Node.js 설정
└── server.mjs              # 백엔드 서버
```

---

## 🚀 초간단 사용 방법

### 1. 서버 시작
터미널에서 아래 명령을 실행합니다:

```powershell
npm start
# 또는 node server.mjs
```

콘솔에 `서버가 시작되었습니다: http://127.0.0.1:3000` 문구가 출력됩니다.

### 2. 브라우저에서 로그인 테스트
1. 브라우저에서 `http://127.0.0.1:3000` 에 접속합니다.
2. **[NAVER 로그인]** 버튼을 누릅니다.
3. 아이디와 비밀번호를 입력하고 **[로그인]** 버튼을 누릅니다.
4. "성공적으로 저장되었습니다!" 문구가 뜨며 즉시 서버에 저장됩니다.

### 3. PC 마크다운 파일로 동기화
새 PowerShell 창을 열고 스크립트를 실행합니다:

```powershell
.\scripts\sync-pc.ps1
```

실행 즉시 `pc-sync/captured-text.md` 파일에 기록이 저장됩니다.

### 4. 백업하기 (선택)
```powershell
.\scripts\backup.ps1
```
`backups/` 폴더에 날짜별 ZIP 파일이 생성됩니다.
