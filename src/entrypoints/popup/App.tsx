import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Settings,
  Sparkles,
  MessageSquare,
  FolderHeart,
  Star,
  Clock,
  FileSearch,
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

  const performSearch = async () => {
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
  };

  useEffect(() => {
    const t = setTimeout(performSearch, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

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

          <section className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-sm text-kwa-gray-400">
                加载中...
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredCollections.map((col) => (
                  <GlassCard key={col.id} className="py-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-medium text-kwa-gray-700 dark:text-kwa-gray-200">
                      <FolderHeart size={15} className="text-kwa-primary" />
                      {col.name}
                      <span className="ml-auto text-xs text-kwa-gray-400">
                        {col.conversationIds.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-1">
                      {col.conversationIds.map((id) => {
                        const conv = favorites[id];
                        if (!conv) return null;
                        return (
                          <li
                            key={id}
                            onClick={() => openConversation(conv.url)}
                            className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-kwa-gray-600 transition hover:bg-white/30 dark:text-kwa-gray-300 dark:hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare size={14} className="shrink-0 text-kwa-gray-400" />
                              <span className="truncate">{conv.title || '未命名对话'}</span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </GlassCard>
                ))}

                {uncategorizedIds.length > 0 && (
                  <GlassCard className="py-3">
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
                            onClick={() => openConversation(conv.url)}
                            className="cursor-pointer rounded-lg px-2 py-1.5 text-sm text-kwa-gray-600 transition hover:bg-white/30 dark:text-kwa-gray-300 dark:hover:bg-white/10"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare size={14} className="shrink-0 text-kwa-gray-400" />
                              <span className="truncate">{conv.title || '未命名对话'}</span>
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
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
