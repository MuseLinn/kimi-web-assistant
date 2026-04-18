import { useEffect, useState, useMemo } from 'react';
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
  Plus,
  Edit2,
  X,
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/components/ThemeProvider';
import type { Settings, Collection, ConversationMeta } from '@/shared/messages';
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

  // Collection management state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [favorites, setFavorites] = useState<Record<string, ConversationMeta>>({});

  // Inline confirm for deletes (options page blocks window.confirm)
  const [confirmDelete, setConfirmDelete] = useState<
    | null
    | { type: 'collection'; id: string; name: string }
    | { type: 'favorite'; id: string; name: string }
  >(null);

  const uncategorizedIds = useMemo(() => {
    const inCollections = new Set(collections.flatMap((c) => c.conversationIds));
    return Object.keys(favorites).filter((id) => !inCollections.has(id));
  }, [collections, favorites]);

  useEffect(() => {
    Promise.all([
      sendMessage({ type: 'GET_SETTINGS' }),
      sendMessage({ type: 'GET_COLLECTIONS' }),
      sendMessage({ type: 'GET_FAVORITES' }),
    ]).then(([settingsRes, collectionsRes, favoritesRes]) => {
      if (settingsRes.ok && settingsRes.data) {
        setSettings({ ...DEFAULT_SETTINGS, ...(settingsRes.data as Settings) });
      }
      if (collectionsRes.ok && collectionsRes.data) {
        setCollections(collectionsRes.data as Collection[]);
      }
      if (favoritesRes.ok && favoritesRes.data) {
        setFavorites((favoritesRes.data as Record<string, ConversationMeta>) || {});
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

  // Collection management functions
  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    
    const newCollection: Collection = {
      id: `col_${Date.now()}`,
      name: newCollectionName.trim(),
      conversationIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    const res = await sendMessage({ type: 'SET_COLLECTION', payload: newCollection });
    if (res.ok && res.data) {
      setCollections(res.data as Collection[]);
      setNewCollectionName('');
    }
  };

  const updateCollection = async () => {
    if (!editingCollection || !editingCollection.name.trim()) return;
    
    const updatedCollection: Collection = {
      ...editingCollection,
      updatedAt: Date.now(),
    };
    
    const res = await sendMessage({ type: 'SET_COLLECTION', payload: updatedCollection });
    if (res.ok && res.data) {
      setCollections(res.data as Collection[]);
      setEditingCollection(null);
    }
  };

  const requestDeleteCollection = (id: string, name: string) => {
    setConfirmDelete({ type: 'collection', id, name });
  };

  const doDeleteCollection = async () => {
    if (!confirmDelete || confirmDelete.type !== 'collection') return;
    const res = await sendMessage({ type: 'DELETE_COLLECTION', payload: { id: confirmDelete.id } });
    if (res.ok && res.data) {
      setCollections(res.data as Collection[]);
    }
    setConfirmDelete(null);
  };

  const requestRemoveFavorite = (convId: string, name: string) => {
    setConfirmDelete({ type: 'favorite', id: convId, name });
  };

  const doRemoveFavorite = async () => {
    if (!confirmDelete || confirmDelete.type !== 'favorite') return;
    const convId = confirmDelete.id;
    if (!favorites[convId]) {
      setConfirmDelete(null);
      return;
    }

    // Remove from favorites
    await sendMessage({ type: 'TOGGLE_FAVORITE', payload: favorites[convId] });

    // Remove from all collections
    const colsRes = await sendMessage({ type: 'GET_COLLECTIONS' });
    const currentCols = (colsRes.ok ? (colsRes.data as Collection[]) : collections) || [];
    for (const col of currentCols) {
      if (col.conversationIds.includes(convId)) {
        const updated = {
          ...col,
          conversationIds: col.conversationIds.filter((id) => id !== convId),
          updatedAt: Date.now(),
        };
        await sendMessage({ type: 'SET_COLLECTION', payload: updated });
      }
    }

    // Refresh
    const [newFavsRes, newColsRes] = await Promise.all([
      sendMessage({ type: 'GET_FAVORITES' }),
      sendMessage({ type: 'GET_COLLECTIONS' }),
    ]);
    if (newFavsRes.ok) setFavorites((newFavsRes.data as Record<string, ConversationMeta>) || {});
    if (newColsRes.ok) setCollections(newColsRes.data as Collection[]);
    setConfirmDelete(null);
  };

  // Move a conversation to a collection (or remove from all collections if null)
  const moveConversationToCollection = async (convId: string, collectionId: string | 'none') => {
    // Get current collections state
    const colsRes = await sendMessage({ type: 'GET_COLLECTIONS' });
    const currentCols = (colsRes.ok ? (colsRes.data as Collection[]) : collections) || [];

    // Remove from all collections first
    let updatedCols = currentCols.map((col) => ({
      ...col,
      conversationIds: col.conversationIds.filter((id) => id !== convId),
    }));

    // Add to target collection if not 'none'
    if (collectionId !== 'none') {
      updatedCols = updatedCols.map((col) =>
        col.id === collectionId
          ? { ...col, conversationIds: [...col.conversationIds, convId], updatedAt: Date.now() }
          : col
      );
    }

    // Save all changed collections
    for (const col of updatedCols) {
      const original = currentCols.find((c) => c.id === col.id);
      if (
        original &&
        JSON.stringify(original.conversationIds) !== JSON.stringify(col.conversationIds)
      ) {
        await sendMessage({ type: 'SET_COLLECTION', payload: col });
      }
    }

    // Refresh
    const newColsRes = await sendMessage({ type: 'GET_COLLECTIONS' });
    if (newColsRes.ok) setCollections(newColsRes.data as Collection[]);
  };

  // Drag and drop handlers
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);

  const handleDragStart = (convId: string) => {
    setDraggingConvId(convId);
  };

  const handleDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    setDragOverCollectionId(collectionId);
  };

  const handleDragLeave = () => {
    setDragOverCollectionId(null);
  };

  const handleDrop = async (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    setDragOverCollectionId(null);
    if (!draggingConvId) return;

    await moveConversationToCollection(draggingConvId, collectionId);
    setDraggingConvId(null);
  };

  const handleDropUncategorized = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCollectionId(null);
    if (!draggingConvId) return;

    await moveConversationToCollection(draggingConvId, 'none');
    setDraggingConvId(null);
  };

  const getConversationCollectionId = (convId: string): string | 'none' => {
    for (const col of collections) {
      if (col.conversationIds.includes(convId)) return col.id;
    }
    return 'none';
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
            <FolderOpen size={16} className="text-kwa-primary" />
            收藏分类管理
          </h2>
          
          {/* Create new collection */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              placeholder="输入分类名称"
              className="flex-1 rounded-lg border border-white/20 bg-white/[0.1] px-3 py-2 text-sm text-kwa-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-kwa-gray-300 focus:outline-none focus:ring-2 focus:ring-kwa-primary/50"
            />
            <button
              onClick={createCollection}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-kwa-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-kwa-primary/90 dark:border-white/10"
            >
              <Plus size={16} />
              创建
            </button>
          </div>
          
          {/* Edit collection */}
          {editingCollection && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="text"
                value={editingCollection.name}
                onChange={(e) => setEditingCollection({ ...editingCollection, name: e.target.value })}
                placeholder="输入分类名称"
                className="flex-1 rounded-lg border border-white/20 bg-white/[0.1] px-3 py-2 text-sm text-kwa-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-kwa-gray-300 focus:outline-none focus:ring-2 focus:ring-kwa-primary/50"
              />
              <button
                onClick={updateCollection}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-kwa-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-kwa-primary/90 dark:border-white/10"
              >
                <Save size={14} />
                保存
              </button>
              <button
                onClick={() => setEditingCollection(null)}
                className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.14] px-3 py-2 text-sm font-medium text-kwa-gray-700 transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
              >
                <X size={14} />
                取消
              </button>
            </div>
          )}
          
          {/* Collection list with drop zones */}
          <div className="mb-4 space-y-2">
            <h3 className="text-xs font-medium text-kwa-gray-500 dark:text-kwa-gray-400">
              分类列表（拖拽对话到分类中）
            </h3>

            {/* Uncategorized drop zone */}
            <div
              onDragOver={(e) => handleDragOver(e, 'none')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropUncategorized(e)}
              className={[
                'rounded-lg border-2 border-dashed p-3 transition',
                dragOverCollectionId === 'none'
                  ? 'border-kwa-primary bg-kwa-primary/10'
                  : 'border-white/10 bg-white/[0.04] dark:border-white/5',
              ].join(' ')}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-kwa-gray-700 dark:text-kwa-gray-300">
                  未分类
                </span>
                <span className="text-xs text-kwa-gray-400">
                  {uncategorizedIds.length}
                </span>
              </div>
              {uncategorizedIds.length > 0 && (
                <div className="mt-2 space-y-1">
                  {uncategorizedIds.map((id) => {
                    const conv = favorites[id];
                    if (!conv) return null;
                    return (
                      <div
                        key={id}
                        draggable
                        onDragStart={() => handleDragStart(id)}
                        className="flex cursor-grab items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.08] px-2 py-1.5 active:cursor-grabbing dark:border-white/5"
                      >
                        <span className="flex-1 truncate text-xs text-kwa-gray-600 dark:text-kwa-gray-300">
                          {conv.title || '未命名对话'}
                        </span>
                        <button
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            requestRemoveFavorite(id, conv.title || '未命名对话');
                          }}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-kwa-clay-dark opacity-60 transition hover:bg-white/20 hover:opacity-100 dark:text-kwa-clay"
                          title="取消收藏"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {collections.length > 0 ? (
              collections.map((collection) => (
                <div
                  key={collection.id}
                  onDragOver={(e) => handleDragOver(e, collection.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, collection.id)}
                  className={[
                    'rounded-lg border-2 border-dashed p-3 transition',
                    dragOverCollectionId === collection.id
                      ? 'border-kwa-primary bg-kwa-primary/10'
                      : 'border-white/10 bg-white/[0.04] dark:border-white/5',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-kwa-gray-700 dark:text-kwa-gray-300">
                      {collection.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-kwa-gray-400">
                        {collection.conversationIds.length}
                      </span>
                      <button
                        onClick={() => setEditingCollection(collection)}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-kwa-gray-500 transition hover:bg-white/20 dark:text-kwa-gray-400"
                        aria-label="编辑"
                        title="编辑分类"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => requestDeleteCollection(collection.id, collection.name)}
                        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-kwa-clay-dark transition hover:bg-white/20 dark:text-kwa-clay"
                        aria-label="删除"
                        title="删除分类"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {collection.conversationIds.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {collection.conversationIds.map((id) => {
                        const conv = favorites[id];
                        if (!conv) return null;
                        return (
                          <div
                            key={id}
                            draggable
                            onDragStart={() => handleDragStart(id)}
                            className="flex cursor-grab items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.08] px-2 py-1.5 active:cursor-grabbing dark:border-white/5"
                          >
                            <span className="flex-1 truncate text-xs text-kwa-gray-600 dark:text-kwa-gray-300">
                              {conv.title || '未命名对话'}
                            </span>
                            <button
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                            requestRemoveFavorite(id, conv.title || '未命名对话');
                              }}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-kwa-clay-dark opacity-60 transition hover:bg-white/20 hover:opacity-100 dark:text-kwa-clay"
                              title="取消收藏"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-kwa-gray-500 dark:text-kwa-gray-400">
                暂无分类，点击上方按钮创建
              </div>
            )}
          </div>

          {/* All favorites flat list (for reference) */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-kwa-gray-500 dark:text-kwa-gray-400">
              全部已收藏对话 ({Object.keys(favorites).length})
            </h3>
            {Object.keys(favorites).length > 0 ? (
              <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
                {Object.values(favorites).map((conv) => (
                  <div
                    key={conv.id}
                    draggable
                    onDragStart={() => handleDragStart(conv.id)}
                    className="flex cursor-grab items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.06] p-2 active:cursor-grabbing dark:border-white/5"
                  >
                    <span className="flex-1 truncate text-sm text-kwa-gray-700 dark:text-kwa-gray-300">
                      {conv.title || '未命名对话'}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded bg-white/[0.1] px-1.5 py-0.5 text-[10px] text-kwa-gray-500">
                        {getConversationCollectionId(conv.id) === 'none'
                          ? '未分类'
                          : collections.find((c) => c.id === getConversationCollectionId(conv.id))?.name}
                      </span>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                           requestRemoveFavorite(conv.id, conv.title || '未命名对话');
                        }}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/[0.14] text-kwa-clay-dark transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-clay"
                        title="取消收藏"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-kwa-gray-500 dark:text-kwa-gray-400">
                暂无收藏对话，在 Kimi 侧边栏点击星标收藏
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-kwa-gray-700 dark:text-kwa-gray-200">
            <Database size={16} className="text-kwa-primary" />
            缓存管理
          </h2>
          <div className="mb-4 text-sm text-kwa-gray-600 dark:text-kwa-gray-300">
            <p className="mb-2">缓存功能会自动保存您浏览过的对话内容，无需手动操作。</p>
            <p className="mb-2">与收藏功能的区别：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>收藏：需要手动标记，用于快速访问重要对话</li>
              <li>缓存：自动保存，支持全文搜索所有浏览过的内容</li>
            </ul>
          </div>
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

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/[0.9] p-6 shadow-2xl dark:border-white/10 dark:bg-[#1e1e20]/90">
            <h3 className="mb-2 text-base font-semibold text-kwa-gray-800 dark:text-kwa-gray-100">
              确认删除
            </h3>
            <p className="mb-6 text-sm text-kwa-gray-600 dark:text-kwa-gray-300">
              {confirmDelete.type === 'collection'
                ? `确定要删除分类「${confirmDelete.name}」吗？`
                : `确定要取消收藏「${confirmDelete.name}」吗？`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-white/20 bg-white/[0.14] px-4 py-2 text-sm font-medium text-kwa-gray-700 transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
              >
                取消
              </button>
              <button
                onClick={() =>
                  confirmDelete.type === 'collection'
                    ? doDeleteCollection()
                    : doRemoveFavorite()
                }
                className="flex-1 rounded-xl bg-kwa-clay-dark px-4 py-2 text-sm font-medium text-white transition hover:bg-kwa-clay dark:bg-kwa-clay"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
