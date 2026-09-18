import { config, useAgentCore } from './config';
import type {
  Tea,
  Exhibition,
  Product,
  Artist,
  ChatResponse,
} from './types';

// 정보 페이지 데이터 로더.
// 백엔드(/api/content/{category})가 있으면 그쪽을, 없으면 정적 시드(/data/*.json)를 사용.
async function loadData<T>(fileName: string): Promise<T[]> {
  // 1순위: 정적 시드 (백엔드 없이도 항상 동작)
  const res = await fetch(`${config.dataBase}/${fileName}`);
  if (!res.ok) throw new Error(`데이터 로드 실패: ${fileName}`);
  return (await res.json()) as T[];
}

export const getTeas = () => loadData<Tea>('tea.json');
export const getExhibitions = () => loadData<Exhibition>('exhibitions.json');
export const getProducts = () => loadData<Product>('products.json');
export const getArtists = () => loadData<Artist>('artists.json');

// 챗봇 호출
// - AgentCore 설정 시: Bedrock AgentCore Runtime을 직접 호출(Bearer=AccessToken,
//   payload에 관리자 판별용 idToken 포함).
// - 미설정 시: 로컬 FastAPI(/api/chat) 호출.
export async function sendChat(
  message: string,
  tokens: { accessToken: string; idToken: string },
  sessionId: string,
): Promise<ChatResponse> {
  if (useAgentCore) {
    const encArn = encodeURIComponent(config.agentCore.runtimeArn);
    const url = `https://bedrock-agentcore.${config.agentCore.region}.amazonaws.com/runtimes/${encArn}/invocations?qualifier=DEFAULT`;
    // AgentCore 세션 ID는 33자 이상이어야 함
    const runtimeSession = `${sessionId}-teaverse-000000000000000000`.slice(0, 48);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.accessToken}`,
        'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': runtimeSession,
      },
      body: JSON.stringify({ message, idToken: tokens.idToken }),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('인증이 필요합니다. 다시 로그인해 주세요.');
    }
    if (!res.ok) {
      throw new Error(`챗봇 요청 실패 (${res.status})`);
    }
    return (await res.json()) as ChatResponse;
  }

  const res = await fetch(`${config.apiBase}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.idToken}`,
    },
    body: JSON.stringify({ message, sessionId }),
  });
  if (res.status === 401) {
    throw new Error('인증이 필요합니다. 다시 로그인해 주세요.');
  }
  if (!res.ok) {
    throw new Error(`챗봇 요청 실패 (${res.status})`);
  }
  return (await res.json()) as ChatResponse;
}

// 관리자 데이터 수집 트리거
export async function triggerIngest(
  category: string,
  idToken: string,
): Promise<{ status: string; updated: number }> {
  const res = await fetch(`${config.apiBase}/admin/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ category }),
  });
  if (res.status === 403) throw new Error('관리자 권한이 필요합니다.');
  if (!res.ok) throw new Error(`수집 요청 실패 (${res.status})`);
  return await res.json();
}
