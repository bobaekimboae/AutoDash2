# AutoDash2

AutoDash 차량 영상 제작 흐름을 한국어로 재현한 공개 웹앱입니다. 차량 정보를 입력하고 사진 5장을 골라 9:16 세로 매물 소개 영상을 만듭니다.

## 사용 기능

- 차량 기본 정보와 딜러 로고 입력
- JPG, PNG, WebP 사진 최대 20장 업로드, 영상에 쓸 5장 선택 및 순서 변경
- 10개 영상 스타일 선택과 장면별 문구 편집
- 브라우저에서 미리보기, 영상 생성, 재생 및 다운로드
- 사진과 차량 정보는 브라우저 안에서 처리

영상은 Canvas와 MediaRecorder로 기기 내에서 렌더링됩니다. 브라우저 인코더에 따라 MP4 또는 WebM으로 저장되며, 영상은 무음입니다. 매물 URL 가져오기는 URL 쿼리에 `make`, `model`, `year`, `mileage`, `price` 항목이 포함된 경우에만 값을 채웁니다. 그 외 사이트는 직접 입력해야 합니다. AutoDash 원본의 서버, 생성형 AI, 음성, 음악, 결제/크레딧 API는 연결하지 않았습니다.

## 로컬 실행

```bash
npm ci
npm run dev
```

## GitHub Pages

저장소 `bobaekimboae/AutoDash2`의 `main` 브랜치에 반영하면 Actions가 빌드와 배포를 실행합니다. Pages 설정에서 빌드 원본을 `GitHub Actions`로 선택해야 합니다.

