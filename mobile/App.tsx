import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';

// 웹(agora.html)과 동일한 백엔드를 그대로 재사용한다 (S14: 웹 API 재사용).
const API_BASE = 'https://api.myagora.xyz';
const TOKEN_KEY = 'agora_token';

// expo-secure-store는 웹에서 동작하지 않음 — `npm run web`으로 시뮬레이터 없이
// 빠르게 미리보기할 수 있도록 웹에서는 localStorage로 대체한다.
// 실제 배포 대상(iOS/Android)에서는 그대로 SecureStore를 씀.
const storage = {
  get: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(key)) : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web'
      ? Promise.resolve(localStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  remove: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(key)) : SecureStore.deleteItemAsync(key),
};

const RANK_LABEL: Record<string, string> = { citizen: '시민', supporter: '지지자', prophet: '선지자' };

type Region = { id: string; name: string; status: string };
type User = {
  id: string;
  nickname: string;
  region_id: string;
  rank: string;
  reputation: number;
  follower_count?: number;
};
type HotIssue = {
  id: string;
  title: string;
  region_name: string;
  participant_count: number;
  total_upvotes: number;
};

async function apiRequest(path: string, token: string | null, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || '요청에 실패했습니다.');
  return body;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [hotIssues, setHotIssues] = useState<HotIssue[]>([]);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [regionId, setRegionId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [regionsRes, storedToken] = await Promise.all([
        fetch(`${API_BASE}/regions`).then((r) => r.json()).catch(() => []),
        storage.get(TOKEN_KEY),
      ]);
      setRegions(regionsRes);
      if (regionsRes.length) setRegionId(regionsRes[0].id);

      if (storedToken) {
        try {
          const me = await apiRequest('/users/me', storedToken);
          setToken(storedToken);
          setUser(me);
        } catch {
          await storage.remove(TOKEN_KEY);
        }
      }
      setBooting(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    apiRequest('/hot-agenda', null)
      .then(setHotIssues)
      .catch(() => setHotIssues([]));
  }, [user]);

  function regionName(id: string) {
    return regions.find((r) => r.id === id)?.name ?? '알 수 없음';
  }

  async function handleSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const payload =
        mode === 'login'
          ? { email, password }
          : { email, password, nickname, region_id: regionId };
      const result = await apiRequest(mode === 'login' ? '/auth/login' : '/auth/signup', null, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await storage.set(TOKEN_KEY, result.token);
      setToken(result.token);
      const me = await apiRequest('/users/me', result.token);
      setUser(me);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await storage.remove(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setEmail('');
    setPassword('');
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.topbar}>
        <Text style={styles.wordmark}>
          ΑΓΟΡΑ <Text style={styles.wordmarkSub}>agora</Text>
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!user ? (
          <View style={styles.section}>
            <View style={styles.tabRow}>
              <Pressable onPress={() => setMode('login')}>
                <Text style={[styles.tab, mode === 'login' && styles.tabActive]}>로그인</Text>
              </Pressable>
              <Pressable onPress={() => setMode('signup')}>
                <Text style={[styles.tab, mode === 'signup' && styles.tabActive]}>회원가입</Text>
              </Pressable>
            </View>

            {mode === 'signup' && (
              <>
                <Text style={styles.label}>닉네임</Text>
                <TextInput style={styles.input} value={nickname} onChangeText={setNickname} />
                <Text style={styles.label}>소속 폴리스</Text>
                <View style={styles.regionRow}>
                  {regions.map((r) => (
                    <Pressable
                      key={r.id}
                      onPress={() => setRegionId(r.id)}
                      style={[styles.regionChip, regionId === r.id && styles.regionChipActive]}
                    >
                      <Text style={[styles.regionChipText, regionId === r.id && styles.regionChipTextActive]}>
                        {r.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Text style={styles.label}>비밀번호{mode === 'signup' ? ' (8자 이상)' : ''}</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable style={styles.submit} onPress={handleSubmit} disabled={submitting}>
              <Text style={styles.submitText}>
                {submitting ? '처리 중...' : mode === 'login' ? '로그인' : '가입하고 시작하기'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.charTop}>
                <View style={styles.avatar} />
                <View>
                  <View style={styles.charNameRow}>
                    <Text style={styles.charName}>{user.nickname}</Text>
                    <Text style={styles.badge}>{RANK_LABEL[user.rank] ?? user.rank}</Text>
                  </View>
                  <Text style={styles.meta}>소속 폴리스 · {regionName(user.region_id)}</Text>
                </View>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>명성 수치</Text>
                <Text style={styles.statValue}>{user.reputation ?? 0}</Text>
              </View>
              <View style={[styles.statRow, styles.statRowLast]}>
                <Text style={styles.statLabel}>팔로워</Text>
                <Text style={styles.statValue}>{user.follower_count ?? 0}</Text>
              </View>
              <Pressable onPress={handleLogout}>
                <Text style={styles.logout}>로그아웃</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>주요 논쟁 · Hot Issue</Text>
              {hotIssues.length === 0 && <Text style={styles.meta}>불러오는 중...</Text>}
              {hotIssues.slice(0, 5).map((t, i) => (
                <View key={t.id} style={[styles.issueItem, i === hotIssues.length - 1 && styles.noBorder]}>
                  <Text style={styles.issueNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.issueText}>{t.title}</Text>
                    <Text style={styles.meta}>
                      {t.region_name} · 참여 {t.participant_count}명 · 추천 {t.total_upvotes}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const BLACK = '#111110';
const INK = '#1c1c1a';
const GRAY_1 = '#4a4a46';
const GRAY_2 = '#8a8a84';
const GRAY_4 = '#e6e6e0';
const WHITE = '#ffffff';
const LINE = 'rgba(17,17,16,0.14)';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHITE },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },
  scroll: { paddingBottom: 40 },
  topbar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  wordmark: { fontSize: 19, fontWeight: '600', letterSpacing: 2, color: BLACK },
  wordmarkSub: { fontSize: 12, fontStyle: 'italic', color: GRAY_2, fontWeight: '400' },

  section: { padding: 20, borderBottomWidth: 1, borderBottomColor: LINE, gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: BLACK },

  tabRow: { flexDirection: 'row', gap: 18 },
  tab: { fontSize: 13, color: GRAY_2 },
  tabActive: { color: BLACK, fontWeight: '600' },
  label: { fontSize: 11.5, color: GRAY_2 },
  input: {
    borderWidth: 1,
    borderColor: LINE,
    padding: 10,
    fontSize: 14,
    color: INK,
  },
  regionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  regionChip: { borderWidth: 1, borderColor: LINE, paddingHorizontal: 10, paddingVertical: 6 },
  regionChipActive: { borderColor: BLACK, backgroundColor: BLACK },
  regionChipText: { fontSize: 12.5, color: INK },
  regionChipTextActive: { color: WHITE },
  error: { fontSize: 12, color: '#B23A3A' },
  submit: { backgroundColor: BLACK, paddingVertical: 13, alignItems: 'center' },
  submitText: { color: WHITE, fontSize: 13.5, letterSpacing: 0.5 },

  charTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: BLACK },
  charNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  charName: { fontSize: 18, fontWeight: '600', color: BLACK },
  badge: {
    fontSize: 10,
    borderWidth: 1,
    borderColor: BLACK,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    color: BLACK,
  },
  meta: { fontSize: 11.5, color: GRAY_2 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_4,
  },
  statRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  statLabel: { fontSize: 12.5, color: GRAY_2 },
  statValue: { fontSize: 12.5, color: INK, fontWeight: '500' },
  logout: { fontSize: 11.5, color: GRAY_2, textDecorationLine: 'underline' },

  issueItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_4,
  },
  noBorder: { borderBottomWidth: 0 },
  issueNum: { fontSize: 13, color: '#c9c9c2', width: 16 },
  issueText: { fontSize: 12.5, color: INK, lineHeight: 18 },
});
