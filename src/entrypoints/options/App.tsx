import { useEffect, useState } from 'react';
import {
  Save,
  Download,
  Upload,
  Sparkles,
  Palette,
  Layout,
  Type,
  FolderOpen,
  Database,
  Trash2,
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/components/ThemeProvider';
import type { Settings } from '@/shared/messages';
import { DEFAULT_SETTINGS, sendMessage } from '@/shared/messages';

export function App() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [cacheStats, setCacheStats] = useState<{
    count: number;
    oldest: number;
    newest: number;
  } | null>(null);

  useEffect(() => {
    sendMessage({ type: 'GET_SETTINGS' }).then((res) => {
      if (res.ok && res.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...(res.data as Settings) });
      }
    });
    loadCacheStats();
  }, []);

  const loadCacheStats = async () => {
    const res = await sendMessage({ type: 'GET_CACHE_STATS' });
    if (res.ok) {
      setCacheStats(res.data as { count: number; oldest: number; newest: number });
    }
  };

  const clearCache = async () => {
    await sendMessage({ type: 'CLEAR_CONVERSATION_CACHE' });
    await loadCacheStats();
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    sendMessage({ type: 'SET_SETTINGS', payload: next });
    if (key === 'theme') {
      setTheme(value as 'light' | 'dark' | 'system');
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };

  const exportData = async () => {
    const res = await sendMessage({ type: 'EXPORT_DATA' });
    if (!res.ok) return;
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kimi-web-assistant-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      await sendMessage({ type: 'IMPORT_DATA', payload: data });
      window.location.reload();
    } catch {
      alert('导入失败：文件格式不正确');
    }
  };

  const Toggle = ({
    label,
    desc,
    checked,
    onChange,
    icon: Icon,
  }: {
    label: string;
    desc?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    icon: React.ElementType;
  }) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kwa-primary/10 text-kwa-primary">
          <Icon size={16} />
        </div>
        <div>
          <div className="text-sm font-medium text-kwa-gray-800 dark:text-kwa-gray-100">
            {label}
          </div>
          {desc && <div className="text-xs text-kwa-gray-500 dark:text-kwa-gray-400">{desc}</div>}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={[
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-kwa-primary' : 'bg-kwa-gray-300 dark:bg-kwa-gray-600',
        ].join(' ')}
        aria-checked={checked}
        role="switch"
      >
        <span
          className={[
            'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'left-6' : 'left-1',
          ].join(' ')}
        />
      </button>
    </div>
  );

  return (
    <div className="mx-auto min-h-screen max-w-2xl p-6">
      <header className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-kwa-primary to-kwa-teal text-white shadow-md">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-kwa-gray-800 dark:text-kwa-gray-50">设置</h1>
          <p className="text-sm text-kwa-gray-500 dark:text-kwa-gray-400">
            管理功能模块、外观主题与数据
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-5">
        <GlassCard>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-kwa-gray-700 dark:text-kwa-gray-200">
            <Layout size={16} className="text-kwa-primary" />
            功能模块
          </h2>
          <div className="divide-y divide-white/10 dark:divide-white/5">
            <Toggle
              label="对话轮次进度条"
              desc="在对话页面右侧显示可点击的导航进度条"
              checked={settings.navigator}
              onChange={(v) => updateSetting('navigator', v)}
              icon={Layout}
            />
            <Toggle
              label="LaTeX 快捷复制"
              desc="在数学公式右上角添加复制按钮"
              checked={settings.latexCopier}
              onChange={(v) => updateSetting('latexCopier', v)}
              icon={Type}
            />
            <Toggle
              label="多对话收藏"
              desc="在侧边栏为每个对话添加收藏星标"
              checked={settings.collectionInject}
              onChange={(v) => updateSetting('collectionInject', v)}
              icon={FolderOpen}
            />
            <Toggle
              label="对话内容缓存"
              desc="自动缓存浏览过的对话内容，用于跨对话搜索"
              checked={settings.conversationCache}
              onChange={(v) => updateSetting('conversationCache', v)}
              icon={Database}
            />
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-kwa-gray-700 dark:text-kwa-gray-200">
            <Palette size={16} className="text-kwa-primary" />
            外观主题
          </h2>
          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateSetting('theme', t)}
                className={[
                  'flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition',
                  theme === t
                    ? 'border-kwa-primary bg-kwa-primary/10 text-kwa-primary'
                    : 'border-white/20 bg-white/[0.1] text-kwa-gray-600 hover:bg-white/[0.18] dark:border-white/10 dark:bg-white/[0.05] dark:text-kwa-gray-300',
                ].join(' ')}
              >
                {t === 'light' && '浅色'}
                {t === 'dark' && '深色'}
                {t === 'system' && '跟随系统'}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-kwa-gray-700 dark:text-kwa-gray-200">
            <Database size={16} className="text-kwa-primary" />
            缓存管理
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-kwa-gray-600 dark:text-kwa-gray-300">
              {cacheStats ? (
                <>
                  已缓存{' '}
                  <span className="font-medium text-kwa-gray-800 dark:text-kwa-gray-100">
                    {cacheStats.count}
                  </span>{' '}
                  个对话
                </>
              ) : (
                '加载中...'
              )}
            </div>
            <button
              onClick={clearCache}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.14] px-4 py-2 text-sm font-medium text-kwa-clay-dark backdrop-blur-md transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06]"
            >
              <Trash2 size={16} />
              清空缓存
            </button>
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-kwa-gray-700 dark:text-kwa-gray-200">
            <Save size={16} className="text-kwa-primary" />
            数据管理
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={exportData}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.14] px-4 py-2.5 text-sm font-medium text-kwa-gray-700 backdrop-blur-md transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-200"
            >
              <Download size={16} />
              导出备份
            </button>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.14] px-4 py-2.5 text-sm font-medium text-kwa-gray-700 backdrop-blur-md transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-200">
              <Upload size={16} />
              导入备份
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importData(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </GlassCard>
      </div>

      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-kwa-primary px-4 py-2 text-sm font-medium text-white shadow-lg">
          已保存
        </div>
      )}
    </div>
  );
}
