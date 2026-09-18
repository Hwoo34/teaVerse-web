// 프론트엔드 런타임 설정. 값은 Vite 환경변수(.env)로 주입한다.
// 로컬 개발에서 Cognito 설정이 비어 있으면 개발용 목(mock) 로그인으로 폴백한다.

export const config = {
  // 챗봇/콘텐츠 API 베이스. 로컬은 Vite 프록시(/api)로 백엔드(8000) 연결.
  apiBase: import.meta.env.VITE_API_BASE ?? '/api',

  // 정적 시드 데이터 경로 (백엔드 없이도 정보 페이지 동작)
  dataBase: import.meta.env.VITE_DATA_BASE ?? '/data',

  cognito: {
    region: import.meta.env.VITE_COGNITO_REGION ?? 'us-east-1',
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  },

  // AgentCore Runtime (배포 백엔드). 설정 시 챗봇은 로컬 /api 대신 AgentCore를 직접 호출한다.
  agentCore: {
    region: import.meta.env.VITE_AGENTCORE_REGION ?? 'us-east-1',
    runtimeArn: import.meta.env.VITE_AGENTCORE_ARN ?? '',
  },
};

export const useAgentCore = !!config.agentCore.runtimeArn;

// Cognito 설정이 채워져 있으면 실제 인증, 아니면 개발용 목 인증 사용
export const useMockAuth =
  !config.cognito.userPoolId || !config.cognito.clientId;
