# 스튜디오 키오스크

사진관 방문 고객의 셀프 접수, 직원 촬영 큐, 사진관별 상품 관리와 공급자 운영을 하나의 Next.js PWA로 제공하는 멀티테넌트 프로젝트입니다.

## 화면

- `/kiosk` — 고객 현장 접수
- `/staff` — 등록 기기의 PIN 보호 접수·상품 관리
- `/ops` — 공급자 사진관·지점·기기 관리
- `/activate` — 기기별 1회용 라이선스로 매장 등록

## 로컬 실행

1. `.env.example`을 `.env.local`로 복사합니다.
2. 개발 데모를 사용할 경우 `NEXT_PUBLIC_DEMO_MODE=true`, `DEMO_STAFF_PIN`, `DEMO_DEVICE_LICENSE`를 직접 설정합니다.
3. `pnpm install` 후 `pnpm dev`를 실행합니다.

운영 배포에서는 데모 모드가 강제로 비활성화되며 Supabase URL, publishable key, secret key와 32자 이상의 `STAFF_SESSION_SECRET`이 모두 필요합니다. Secret key는 서버 전용이며 브라우저에 노출하면 안 됩니다.

## Supabase

`supabase/migrations`에 멀티테넌트 테이블, 통합 기기 라이선스, RLS, 접수 RPC, 상태 전이, Realtime publication과 7일 개인정보 익명화 작업이 포함되어 있습니다.

```bash
supabase start
supabase db reset
supabase gen types typescript --local > src/lib/supabase/database.types.ts
```

운영자 계정은 Supabase Auth에서 생성한 뒤 해당 UUID를 `platform_users.auth_user_id`에 연결합니다. 직원 PIN은 애플리케이션 서버에서 Argon2로 해시해 `store_pins.pin_hash`에 저장해야 합니다.

## 검증

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

PWA 설치·오프라인 접수는 Android Chrome과 iPad Safari 실기기에서 최종 검증해야 합니다.

