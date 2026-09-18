# config/ — 프로젝트 설정 (키 관리)

특정 AWS 계정·리소스·계정정보에 대한 의존성을 이 디렉토리 한 곳으로 모읍니다.
소스/스크립트/문서에는 실제 값 대신 **플레이스홀더 키**만 두고, 실제 값은
여기 `project.env`(gitignore)에서 관리합니다.

## 사용법
```bash
cp config/project.env.example config/project.env
# project.env 를 열어 실제 값을 채우거나, 아래 배포 스크립트가 자동으로 채웁니다.
```

## 파일
| 파일 | 커밋 | 내용 |
|------|------|------|
| `project.env.example` | ✅ | 플레이스홀더 템플릿 |
| `project.env` | ❌ (.gitignore) | 실제 값(Pool/Client ID, ARN, 계정 비밀번호, URL) |

## 키 목록
| 키 | 설명 | 채워지는 시점 |
|----|------|----------------|
| `AWS_REGION` | 배포 리전 | 수동 |
| `S3_BUCKET` | 프론트 버킷명(비우면 자동 생성) | 수동/자동 |
| `COGNITO_USER_POOL_ID` / `COGNITO_CLIENT_ID` | Cognito | `cognito_setup.sh` 실행 후 |
| `AGENTCORE_RUNTIME_ARN` | 백엔드 런타임 | `agentcore_deploy.sh` 실행 후 |
| `ADMIN_/USER1_/USER2_*` | 데모 계정 | 수동(공개 시 반드시 변경) |
| `SITE_URL` | 배포 URL | 배포 후 |

## 주의
- `project.env`, `*.env`(예외: `*.example`), 배포 산출물(`*_output.env`, `*_arn.txt`,
  `lambda_url.txt`)은 모두 `.gitignore` 처리됩니다.
- 계정 번호(Account ID)는 스크립트가 `aws sts get-caller-identity`로 자동 조회하므로
  파일에 두지 않습니다 — 어떤 AWS 계정에서도 그대로 동작합니다.
