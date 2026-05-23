import { createContext, useContext, useEffect, useCallback, useState, type ReactNode } from 'react';
import type { Business, Lead, Website, Notification, ApiKeys, LeadStage, AppSettings, SearchHistoryEntry } from '../types';
import { LEAD_STAGES, DEFAULT_API_KEYS, DEFAULT_RATE_LIMITS } from '../types';
import { getData, setData, clearAllUserData } from '../services/storage';

// ---- Defaults ----

const DEFAULT_NOTIFICATIONS: Notification[] = [
  { id: 1, message: 'Welcome to RAKE! Configure your API keys in Settings.', time: 'now', read: false, createdAt: Date.now() },
];

const STORAGE_KEYS = {
  businesses: 'businesses',
  leads: 'leads',
  websites: 'websites',
  notifications: 'notifications',
  apiKeys: 'apiKeys',
  settings: 'settings',
  searchHistory: 'searchHistory',
} as const;

// ---- Context Type ----

interface DataContextType {
  userId: string | null;
  businesses: Business[];
  leads: Lead[];
  websites: Website[];
  notifications: Notification[];
  apiKeys: ApiKeys;
  settings: AppSettings;
  searchHistory: SearchHistoryEntry[];

  setUserId: (id: string | null) => void;
  setBusinesses: (businesses: Business[]) => void;
  addBusinesses: (businesses: Business[]) => void;
  setLeads: (leads: Lead[]) => void;
  moveLead: (leadId: number, newStage?: LeadStage) => void;
  addLead: (lead: Lead) => void;
  addWebsite: (website: Website) => void;
  updateWebsite: (id: number, updates: Partial<Website>) => void;
  deployWebsite: (id: number) => void;
  addNotification: (message: string) => void;
  dismissNotification: (id: number) => void;
  markAllNotificationsRead: () => void;
  setApiKeys: (keys: ApiKeys) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
  clearData: () => void;
  addSearchHistory: (entry: { query: string; resultCount: number }) => void;
  clearSearchHistory: () => void;
}

const DataContext = createContext<DataContextType | null>(null);

// ---- Provider ----

export function DataProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [businesses, setBusinessesState] = useState<Business[]>([]);
  const [leads, setLeadsState] = useState<Lead[]>([]);
  const [websites, setWebsitesState] = useState<Website[]>([]);
  const [notifications, setNotificationsState] = useState<Notification[]>(DEFAULT_NOTIFICATIONS);
  const [apiKeys, setApiKeysState] = useState<ApiKeys>(DEFAULT_API_KEYS);
  const [searchHistory, setSearchHistoryState] = useState<SearchHistoryEntry[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>({ workspaceName: 'My Workspace', userName: 'User', rateLimits: { ...DEFAULT_RATE_LIMITS } });

  // Load data from localStorage when userId changes
  const loadData = useCallback((uid: string | null) => {
    setBusinessesState(getData<Business[]>(uid, STORAGE_KEYS.businesses, []));
    setLeadsState(getData<Lead[]>(uid, STORAGE_KEYS.leads, []));
    setWebsitesState(getData<Website[]>(uid, STORAGE_KEYS.websites, []));
    setNotificationsState(getData<Notification[]>(uid, STORAGE_KEYS.notifications, DEFAULT_NOTIFICATIONS));
    setApiKeysState(getData<ApiKeys>(uid, STORAGE_KEYS.apiKeys, DEFAULT_API_KEYS));
    setSettingsState(getData<AppSettings>(uid, STORAGE_KEYS.settings, { workspaceName: 'My Workspace', userName: 'User', rateLimits: { ...DEFAULT_RATE_LIMITS } }));
    setSearchHistoryState(getData<SearchHistoryEntry[]>(uid, STORAGE_KEYS.searchHistory, []));
  }, []);

  const setUserId = useCallback((id: string | null) => {
    setUserIdState(id);
    loadData(id);
  }, [loadData]);

  // Persist data on change
  useEffect(() => { setData(userId, STORAGE_KEYS.businesses, businesses); }, [userId, businesses]);
  useEffect(() => { setData(userId, STORAGE_KEYS.leads, leads); }, [userId, leads]);
  useEffect(() => { setData(userId, STORAGE_KEYS.websites, websites); }, [userId, websites]);
  useEffect(() => { setData(userId, STORAGE_KEYS.notifications, notifications); }, [userId, notifications]);
  useEffect(() => { setData(userId, STORAGE_KEYS.apiKeys, apiKeys); }, [userId, apiKeys]);
  useEffect(() => { setData(userId, STORAGE_KEYS.settings, settings); }, [userId, settings]);
  useEffect(() => { setData(userId, STORAGE_KEYS.searchHistory, searchHistory); }, [userId, searchHistory]);

  // ---- Actions ----

  // Defined first so that moveLead and deployWebsite can reference it
  const addNotification = useCallback((message: string) => {
    const notif: Notification = {
      id: Date.now(),
      message,
      time: 'now',
      read: false,
      createdAt: Date.now(),
    };
    setNotificationsState((prev) => [notif, ...prev].slice(0, 20));
  }, []);

  const addBusinesses = useCallback((newBiz: Business[]) => {
    setBusinessesState((prev) => {
      const existing = new Set(prev.map((b) => b.name));
      const unique = newBiz.filter((b) => !existing.has(b.name));
      return [...unique, ...prev];
    });
  }, []);

  const moveLead = useCallback((leadId: number, newStage?: LeadStage) => {
    setLeadsState((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const stage = newStage || LEAD_STAGES[(LEAD_STAGES.indexOf(l.stage) + 1) % LEAD_STAGES.length];
        if (stage === 'won' && l.stage !== 'won') {
          addNotification(`${l.business} won! 🎉`);
        }
        return { ...l, stage, lastActivity: 'now' };
      })
    );
  }, [addNotification]);

  const addLead = useCallback((lead: Lead) => {
    setLeadsState((prev) => [lead, ...prev]);
  }, []);

  const addWebsite = useCallback((website: Website) => {
    setWebsitesState((prev) => [website, ...prev]);
  }, []);

  const updateWebsite = useCallback((id: number, updates: Partial<Website>) => {
    setWebsitesState((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const deployWebsite = useCallback((id: number) => {
    setWebsitesState((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        addNotification(`${w.name} deployed successfully 🚀`);
        return { ...w, status: 'live' as const };
      })
    );
  }, [addNotification]);

  const dismissNotification = useCallback((id: number) => {
    setNotificationsState((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotificationsState((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const setApiKeys = useCallback((keys: ApiKeys) => {
    setApiKeysState(keys);
  }, []);

  const setSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...partial }));
  }, []);

  const addSearchHistory = useCallback((entry: { query: string; resultCount: number }) => {
    setSearchHistoryState((prev) => {
      const filtered = prev.filter((e) => e.query.toLowerCase() !== entry.query.toLowerCase());
      const next: SearchHistoryEntry[] = [{ query: entry.query, timestamp: Date.now(), resultCount: entry.resultCount }, ...filtered];
      return next.slice(0, 20);
    });
  }, []);

  const clearSearchHistory = useCallback(() => {
    setSearchHistoryState([]);
  }, []);

  const clearData = useCallback(() => {
    setBusinessesState([]);
    setLeadsState([]);
    setWebsitesState([]);
    setNotificationsState(DEFAULT_NOTIFICATIONS);
    clearAllUserData(userId);
  }, [userId]);

  return (
    <DataContext.Provider
      value={{
        userId,
        businesses,
        leads,
        websites,
        notifications,
        apiKeys,
        settings,
        setUserId,
        setBusinesses: setBusinessesState,
        addBusinesses,
        searchHistory,
        setLeads: setLeadsState,
        moveLead,
        addLead,
        addWebsite,
        updateWebsite,
        deployWebsite,
        addNotification,
        dismissNotification,
        markAllNotificationsRead,
        setApiKeys,
        setSettings,
        clearData,
        addSearchHistory,
        clearSearchHistory,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextType {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
