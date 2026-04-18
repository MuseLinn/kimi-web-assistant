import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search,
  Settings,
  Sparkles,
  MessageSquare,
  FolderHeart,
  FolderOpen,
  Star,
  Clock,
  FileSearch,
  Plus,
  X,
  Trash2,
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import type {
  Collection,
  ConversationMeta,
  CachedMessage,
  CachedConversation,
} from '@/shared/messages';
import { sendMessage } from '@/shared/messages';

type Tab = 'favorites' | 'search';

interface SearchResult {
  conversation: CachedConversation;
  matches: CachedMessage[];
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('favorites');
  const [query, setQuery] = useState('');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [favorites, setFavorites] = useState<Record<string, ConversationMeta>>({});
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Drag and drop state
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);

  // Collection creation state
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    Promise.all([
      sendMessage({ type: 'GET_COLLECTIONS' }),
      sendMessage({ type: 'GET_FAVORITES' }),
    ]).then(([colsRes, favsRes]) => {
      if (colsRes.ok) setCollections((colsRes.data as Collection[]) || []);
      if (favsRes.ok) setFavorites((favsRes.data as Record<string, ConversationMeta>) || {});
      setLoading(false);
    });
  }, []);

  const openSettings = () => {
    chrome.runtime.openOptionsPage?.();
  };

  const openConversation = (url: string) => {
    chrome.tabs.create({ url });
  };

  const performSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const res = await sendMessage({
      type: 'SEARCH_CONVERSATION_CACHE',
      payload: { query: searchQuery.trim(), limit: 20 },
    });
    if (res.ok) {
      setSearchResults((res.data as SearchResult[]) || []);
    }
    setSearching(false);
  }, [searchQuery]);

  useEffect(() => {
    const t = setTimeout(performSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery, performSearch]);

  const filteredCollections = useMemo(() => {
    if (!query.trim()) return collections;
    const q = query.toLowerCase();
    return collections
      .map((c) => ({
        ...c,
        conversationIds: c.conversationIds.filter((id) =>
          (favorites[id]?.title || '').toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.conversationIds.length > 0 || c.name.toLowerCase().includes(q));
  }, [collections, favorites, query]);

  const uncategorizedIds = useMemo(() => {
    const inCollections = new Set(collections.flatMap((c) => c.conversationIds));
    return Object.keys(favorites).filter((id) => !inCollections.has(id));
  }, [collections, favorites]);

  // Function to open settings for collection management
  const openCollectionManagement = () => {
    chrome.runtime.openOptionsPage?.();
  };

  // Create collection from popup
  const createCollection = async () => {
    if (!newCollectionName.trim()) return;

    const newCollection = {
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
      setShowCreateCollection(false);
    }
  };

  // Delete collection from popup
  const deleteCollection = async (id: string) => {
    if (window.confirm('确定要删除这个分类吗？')) {
      const res = await sendMessage({ type: 'DELETE_COLLECTION', payload: { id } });
      if (res.ok && res.data) {
        setCollections(res.data as Collection[]);
      }
    }
  };

  // Remove a favorite
  const removeFavorite = async (convId: string) => {
    if (!favorites[convId]) return;
    if (!window.confirm('确定要取消收藏这个对话吗？')) return;

    await sendMessage({ type: 'TOGGLE_FAVORITE', payload: favorites[convId] });

    // Refresh
    const [newFavsRes, newColsRes] = await Promise.all([
      sendMessage({ type: 'GET_FAVORITES' }),
      sendMessage({ type: 'GET_COLLECTIONS' }),
    ]);
    if (newFavsRes.ok) setFavorites((newFavsRes.data as Record<string, ConversationMeta>) || {});
    if (newColsRes.ok) setCollections(newColsRes.data as Collection[]);
  };

  // Move a conversation to a collection (or unclassified if 'none')
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
    e.stopPropagation();
    setDragOverCollectionId(null);
    if (!draggingConvId) return;

    await moveConversationToCollection(draggingConvId, collectionId);
    setDraggingConvId(null);
  };

  const handleDropUncategorized = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCollectionId(null);
    if (!draggingConvId) return;

    await moveConversationToCollection(draggingConvId, 'none');
    setDraggingConvId(null);
  };

  const TabButton = ({
    tab,
    label,
    icon: Icon,
  }: {
    tab: Tab;
    label: string;
    icon: React.ElementType;
  }) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={[
        'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition',
        activeTab === tab
          ? 'bg-white/30 text-kwa-gray-800 shadow-sm dark:bg-white/15 dark:text-kwa-gray-100'
          : 'text-kwa-gray-500 hover:bg-white/20 dark:text-kwa-gray-400',
      ].join(' ')}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="popup-root flex min-h-[520px] w-[360px] flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-kwa-primary to-kwa-teal text-white shadow-md">
            <Sparkles size={16} />
          </div>
          <div>
            <h1 className="text-base font-semibold text-kwa-gray-800 dark:text-kwa-gray-50">
              Kimi Web Assistant
            </h1>
            <p className="text-xs text-kwa-gray-500 dark:text-kwa-gray-400">收藏 · 搜索 · 导航</p>
          </div>
        </div>
        <button
          onClick={openSettings}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.14] text-kwa-gray-600 backdrop-blur-md transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
          aria-label="设置"
        >
          <Settings size={15} />
        </button>
      </header>

      <div className="flex rounded-xl border border-white/20 bg-white/[0.12] p-1 dark:border-white/10 dark:bg-white/[0.06]">
        <TabButton tab="favorites" label="收藏" icon={Star} />
        <TabButton tab="search" label="搜索缓存" icon={FileSearch} />
      </div>

      {activeTab === 'favorites' && (
        <>
          <section className="relative">
            <Search className="absolute left-3.5 top-2.5 text-kwa-gray-400" size={16} />
            <GlassInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索已收藏对话..."
              className="pl-10"
            />
          </section>
          
          {/* Collection creation */}
          <section className="mb-2">
            {!showCreateCollection ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.14] px-3 py-1.5 text-xs font-medium text-kwa-gray-700 transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
                >
                  <Plus size={14} className="text-kwa-primary" />
                  新建分类
                </button>
                <button
                  onClick={openCollectionManagement}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.14] px-3 py-1.5 text-xs font-medium text-kwa-gray-700 transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
                  title="打开完整管理页面"
                >
                  <FolderOpen size={14} className="text-kwa-gray-500" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="分类名称"
                  className="flex-1 rounded-lg border border-white/20 bg-white/[0.1] px-3 py-1.5 text-xs text-kwa-gray-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-kwa-gray-300 focus:outline-none focus:ring-2 focus:ring-kwa-primary/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createCollection();
                    if (e.key === 'Escape') {
                      setShowCreateCollection(false);
                      setNewCollectionName('');
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={createCollection}
                  className="shrink-0 inline-flex items-center justify-center rounded-lg bg-kwa-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-kwa-primary/90"
                >
                  创建
                </button>
                <button
                  onClick={() => {
                    setShowCreateCollection(false);
                    setNewCollectionName('');
                  }}
                  className="shrink-0 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/[0.14] px-3 py-1.5 text-xs text-kwa-gray-700 transition hover:bg-white/[0.22] dark:border-white/10 dark:bg-white/[0.06] dark:text-kwa-gray-300"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </section>

          <section className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-sm text-kwa-gray-400">
                加载中...
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCollections.map((col) => (
                  <GlassCard
                    key={col.id}
                    className={[
                      'py-3 transition',
                      dragOverCollectionId === col.id
                        ? 'ring-2 ring-kwa-primary/50 bg-kwa-primary/5'
                        : '',
                    ].join(' ')}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-kwa-gray-700 dark:text-kwa-gray-200">
                      <FolderHeart size={15} className="text-kwa-primary" />
                      <span className="flex-1 truncate">{col.name}</span>
                      <span className="text-xs text-kwa-gray-400">
                        {col.conversationIds.length}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCollection(col.id);
                        }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded text-kwa-clay-dark opacity-60 transition hover:opacity-100 dark:text-kwa-clay"
                        title="删除分类"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {col.conversationIds.map((id) => {
                        const conv = favorites[id];
                        if (!conv) return null;
                        return (
                          <li
                            key={id}
                            draggable
                            onDragStart={() => handleDragStart(id)}
                            className="group cursor-grab active:cursor-grabbing rounded-lg px-2 py-1.5 text-sm text-kwa-gray-600 transition hover:bg-white/30 dark:text-kwa-gray-300 dark:hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex flex-1 items-center gap-2" onClick={() => openConversation(conv.url)}>
                                <MessageSquare size={14} className="shrink-0 text-kwa-gray-400" />
                                <span className="truncate">{conv.title || '未命名对话'}</span>
                              </div>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeFavorite(id);
                                }}
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-kwa-clay-dark opacity-0 transition hover:bg-white/20 group-hover:opacity-60 hover:!opacity-100 dark:text-kwa-clay"
                                title="取消收藏"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </GlassCard>
                ))}

                {uncategorizedIds.length > 0 && (
                  <GlassCard
                    className={[
                      'py-3 transition',
                      dragOverCollectionId === 'none'
                        ? 'ring-2 ring-kwa-primary/50 bg-kwa-primary/5'
                        : '',
                    ].join(' ')}
                    onDragOver={(e) => handleDragOver(e, 'none')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropUncategorized(e)}
                  >
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-kwa-gray-700 dark:text-kwa-gray-200">
                      <FolderHeart size={15} className="text-kwa-clay" />
                      未分类收藏
                      <span className="ml-auto text-xs text-kwa-gray-400">
                        {uncategorizedIds.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {uncategorizedIds.map((id) => {
                        const conv = favorites[id];
                        if (!conv) return null;
                        return (
                          <li
                            key={id}
                            draggable
                            onDragStart={() => handleDragStart(id)}
                            className="group cursor-grab active:cursor-grabbing rounded-lg px-2 py-1.5 text-sm text-kwa-gray-600 transition hover:bg-white/30 dark:text-kwa-gray-300 dark:hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex flex-1 items-center gap-2" onClick={() => openConversation(conv.url)}>
                                <MessageSquare size={14} className="shrink-0 text-kwa-gray-400" />
                                <span className="truncate">{conv.title || '未命名对话'}</span>
                              </div>
                              <button
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  removeFavorite(id);
                                }}
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-kwa-clay-dark opacity-0 transition hover:bg-white/20 group-hover:opacity-60 hover:!opacity-100 dark:text-kwa-clay"
                                title="取消收藏"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </GlassCard>
                )}

                {filteredCollections.length === 0 && uncategorizedIds.length === 0 && (
                  <div className="flex h-32 flex-col items-center justify-center gap-2 text-kwa-gray-400">
                    <FolderHeart size={32} className="opacity-40" />
                    <span className="text-sm">{query ? '无匹配结果' : '暂无收藏对话'}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'search' && (
        <>
          <section className="relative">
            <Search className="absolute left-3.5 top-2.5 text-kwa-gray-400" size={16} />
            <GlassInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索缓存对话内容..."
              className="pl-10"
            />
          </section>

          <section className="flex-1 overflow-y-auto">
            {searching ? (
              <div className="flex h-32 items-center justify-center text-sm text-kwa-gray-400">
                搜索中...
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col gap-3">
                {searchResults.map(({ conversation, matches }) => (
                  <GlassCard key={conversation.id} className="py-3">
                    <div
                      onClick={() => openConversation(conversation.url)}
                      className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-kwa-gray-700 transition hover:text-kwa-primary dark:text-kwa-gray-200"
                    >
                      <MessageSquare size={15} className="text-kwa-primary" />
                      <span className="truncate">{conversation.title || '未命名对话'}</span>
                      <span className="ml-auto text-xs text-kwa-gray-400">
                        {matches.length} 条匹配
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {matches.slice(0, 2).map((msg, idx) => (
                        <li
                          key={idx}
                          onClick={() => openConversation(conversation.url)}
                          className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2 text-xs text-kwa-gray-600 transition hover:bg-white/15 dark:border-white/5 dark:text-kwa-gray-300"
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <span
                              className={[
                                'rounded px-1 py-0.5 text-[10px] font-medium',
                                msg.role === 'user'
                                  ? 'bg-kwa-clay/20 text-kwa-clay-dark'
                                  : 'bg-kwa-primary/15 text-kwa-primary',
                              ].join(' ')}
                            >
                              {msg.role === 'user' ? '用户' : 'Kimi'}
                            </span>
                          </div>
                          <p className="line-clamp-2">{msg.content}</p>
                        </li>
                      ))}
                    </ul>
                  </GlassCard>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-kwa-gray-400">
                <FileSearch size={32} className="opacity-40" />
                <span className="text-sm">未找到匹配内容</span>
                <span className="text-xs opacity-70">请在 Kimi 对话页面浏览以缓存内容</span>
              </div>
            ) : (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-kwa-gray-400">
                <Clock size={32} className="opacity-40" />
                <span className="text-sm">输入关键词搜索缓存对话</span>
                <span className="text-xs opacity-70">自动缓存最近浏览的对话内容</span>
                <span className="text-xs opacity-70">支持全文搜索所有浏览过的内容</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
