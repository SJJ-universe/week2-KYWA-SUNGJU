# 계산기 (Calculator)

Python 표준 라이브러리 백엔드 + React 프론트엔드로 만든 간단한 안전 계산기입니다.

## 🌐 라이브 데모 (GitHub Pages)
프론트엔드는 GitHub Pages에 배포되어 있으며, 백엔드 없이도 **클라이언트 사이드 안전 평가기**로 동작합니다.
👉 https://sjj-universe.github.io/week2-KYWA-SUNGJU/

## 💻 데스크톱 앱
서명된 단일 실행 파일: `계산기.exe`
- Python(`http.server` + `ast`) 기반 로컬 서버
- React SPA가 기본 브라우저로 자동 오픈
- `signtool`로 코드 서명됨 (`CN=우주센터 장성주`)

## 🧱 구조
```
backend/   # Python 표준 라이브러리만 사용한 HTTP 서버 + 안전 평가기
frontend/  # React 19 + Vite 7 + TypeScript
```

## 🛠 빌드
```powershell
# 프론트엔드
cd frontend
npm install
npm run build
Copy-Item -Recurse -Force dist\* ..\backend\static\

# 단일 exe
cd ..\backend
pyinstaller --onefile --noconsole --name calculator `
  --add-data "static;static" --distpath dist --workpath build app.py
```

## 🔒 안전성
사용자 입력은 Python 측 `ast`로 화이트리스트 노드만 허용하며, 클라이언트 폴백도 동일한 연산자만 허용하는 직접 작성한 파서를 사용합니다 (`eval`/`Function` 사용 안 함).

지원 연산: `+ - * / // % **`, 단항 `+/-`, 괄호.
