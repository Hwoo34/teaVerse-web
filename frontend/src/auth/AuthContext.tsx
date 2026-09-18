import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from 'amazon-cognito-identity-js';
import { config, useMockAuth } from '../config';

export interface AuthUser {
  username: string;
  isAdmin: boolean;
  idToken: string; // 그룹(관리자) 판별용 클레임 포함
  accessToken: string; // AgentCore 인바운드 인증(Bearer)용
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// 개발용 목 계정 (Cognito 미설정 시에만 사용되는 로컬 전용 폴백).
// 실제 배포는 Cognito를 사용하며 이 값은 쓰이지 않는다. 데모용 자리표시자.
const MOCK_ACCOUNTS: Record<string, { password: string; isAdmin: boolean }> = {
  admin: { password: 'demo-admin', isAdmin: true },
  user01: { password: 'demo-user01', isAdmin: false },
  user02: { password: 'demo-user02', isAdmin: false },
};

function parseJwtGroups(idToken: string): boolean {
  try {
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const groups: string[] = payload['cognito:groups'] ?? [];
    return groups.includes('admin');
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      if (useMockAuth) {
        // ---- 개발용 목 인증 ----
        await new Promise((r) => setTimeout(r, 300));
        const acct = MOCK_ACCOUNTS[username];
        if (!acct || acct.password !== password) {
          throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
        // 개발용 가짜 JWT: 헤더.페이로드.서명 형태로 groups 클레임 포함
        const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
        const payload = btoa(
          JSON.stringify({
            'cognito:username': username,
            'cognito:groups': acct.isAdmin ? ['admin'] : [],
            token_use: 'id',
            iss: 'mock',
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        );
        const idToken = `${header}.${payload}.mock`;
        setUser({ username, isAdmin: acct.isAdmin, idToken, accessToken: idToken });
        return;
      }

      // ---- 실제 Cognito 인증 (USER_PASSWORD_AUTH) ----
      const pool = new CognitoUserPool({
        UserPoolId: config.cognito.userPoolId,
        ClientId: config.cognito.clientId,
      });
      const cognitoUser = new CognitoUser({ Username: username, Pool: pool });
      const authDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      const tokens = await new Promise<{ idToken: string; accessToken: string }>(
        (resolve, reject) => {
          cognitoUser.authenticateUser(authDetails, {
            onSuccess: (session) =>
              resolve({
                idToken: session.getIdToken().getJwtToken(),
                accessToken: session.getAccessToken().getJwtToken(),
              }),
            onFailure: (err) => reject(err),
            newPasswordRequired: () => {
              reject(
                new Error('비밀번호 변경이 필요한 계정입니다. 관리자에게 문의하세요.'),
              );
            },
          });
        },
      );

      setUser({
        username,
        isAdmin: parseJwtGroups(tokens.idToken),
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '로그인에 실패했습니다.';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, logout, isMock: useMockAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
