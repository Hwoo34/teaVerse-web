# data/ — 시드 데이터

로컬 개발/테스트용 차 정보 시드. 배포 시 이 데이터는 DynamoDB 테이블 `tea_content`
(PK=`category`, SK=`id`)로 적재되고, 수집 에이전트가 웹에서 주기적으로 갱신한다.

## 파일
| 파일 | 카테고리 키 | 스키마 |
|------|-------------|--------|
| `tea.json` | `tea-knowledge` | 차 정보 (전통/중국/한국/꽃차) |
| `exhibitions.json` | `exhibitions` | 전시/행사 |
| `products.json` | `products` | 상품 (다구/다기/자사호) |
| `artists.json` | `artists` | 작가 |

## 공통 메타
- `id`: 항목 고유 ID (SK)
- `sources[]`: `{ title, url, type: "db"|"web" }` — 출처
- `lastUpdatedAt`: ISO8601
- `sourceType`: `"db"` (시드) / `"web"` (수집)

## 주의
- `artists.json`의 인물은 **샘플/시드 프로필**이며 실제 인물 정보가 아니다.
  실제 작가 정보는 수집 에이전트가 출처와 함께 채운다 (`note` 필드 참고).
- 상품 가격/평점/감성 지표는 시연용 예시값이다.
