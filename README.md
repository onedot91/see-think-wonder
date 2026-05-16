# 보고 생각하고 궁금해요

초3 학생이 각자 크롬북에서 쓴 결과를 Supabase에 저장하고, 교사 화면에서 모둠별로 모아 보는 웹사이트입니다.

## 설치

```bash
npm install
```

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. Supabase SQL Editor에서 `supabase-schema.sql` 내용을 실행합니다.
3. `.env.example`을 참고해 프로젝트 루트에 `.env` 파일을 만듭니다.

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`VITE_SUPABASE_URL`은 Supabase에서 복사한 주소가 `/rest/v1/`로 끝나도 사용할 수 있습니다.

## 실행

```bash
npm run dev
```

교사 PC에서 실행한 뒤 같은 와이파이에 연결된 학생 크롬북은 교사 PC의 IP 주소로 접속합니다.

예:

```text
http://교사PC-IP주소:5173
```

## 주의

현재 설정은 수업용으로 단순하게 만들었습니다. Supabase anon key로 학생 제출, 교사 조회, 결과 비우기가 가능합니다. 공개 배포하거나 외부 사용자가 접속할 수 있는 환경에서는 교사용 비우기 기능에 별도 인증을 붙이는 것이 좋습니다.
