import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../services/socket';

export type ChatState = {
  messages: ChatMessage[];
  loading: boolean;
  lastReadId: string | null;
  unreadCount: number;
  showUnreadMarker: boolean;
  typingUsers: string[];
  loadingMore: boolean;
  hasMore: boolean;
  lastReadLoaded: boolean;
};

const defaultState = (): ChatState => ({
  messages: [],
  loading: true,
  lastReadId: null,
  unreadCount: 0,
  showUnreadMarker: false,
  typingUsers: [],
  loadingMore: false,
  hasMore: true,
  lastReadLoaded: false,
});

let chatStates: Record<string, ChatState> = {};
let socketConnected = true;
let listeners: (() => void)[] = [];
let activeGroup: string | null = null;
let activeChatAtBottom = true;

export function setActiveChat(groupName: string | null) {
  activeGroup = groupName;
}

export function setActiveChatAtBottom(atBottom: boolean) {
  activeChatAtBottom = atBottom;
}

export function getActiveChat() {
  return { activeGroup, activeChatAtBottom };
}

export function subscribeChat(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function notifyListeners() {
  listeners.forEach(l => l());
}

export function getChatState(groupName: string): ChatState {
  if (!groupName) return defaultState();
  if (!chatStates[groupName]) {
    chatStates[groupName] = defaultState();
    AsyncStorage.getItem(`lastRead_${groupName}`).then(id => {
      if (chatStates[groupName]) {
        chatStates[groupName].lastReadId = id;
        chatStates[groupName].lastReadLoaded = true;
        recomputeUnread(groupName);
        notifyListeners();
      }
    });
  }
  return chatStates[groupName];
}

export function setSocketConnected(connected: boolean) {
  socketConnected = connected;
  notifyListeners();
}

export function isSocketConnected() {
  return socketConnected;
}

export function updateLastRead(groupName: string, messageId: string) {
  const state = getChatState(groupName);
  state.lastReadId = messageId;
  state.unreadCount = 0;
  state.showUnreadMarker = false;
  AsyncStorage.setItem(`lastRead_${groupName}`, messageId);
  notifyListeners();
}

// Set loading state
export function setLoading(groupName: string, loading: boolean) {
  const state = getChatState(groupName);
  state.loading = loading;
  notifyListeners();
}

// Recompute unread count/marker based on lastReadId vs loaded messages
function recomputeUnread(groupName: string) {
  const state = chatStates[groupName];
  if (!state) return;
  if (state.lastReadId && state.messages.length > 0) {
    const idx = state.messages.findIndex(m => m._id === state.lastReadId);
    if (idx !== -1 && idx < state.messages.length - 1) {
      state.showUnreadMarker = true;
      state.unreadCount = state.messages.length - 1 - idx;
      return;
    }
  }
  state.showUnreadMarker = false;
  state.unreadCount = 0;
}

// Set entire message history (deduplicated)
export function setChatHistory(groupName: string, messages: ChatMessage[]) {
  const state = getChatState(groupName);
  state.messages = deduplicateMessages(messages);
  state.loading = false;
  state.hasMore = true;
  recomputeUnread(groupName);
  notifyListeners();
}

// Add a single new message
export function addNewMessage(groupName: string, msg: ChatMessage, authUserId: string) {
  const state = getChatState(groupName);
  state.messages = deduplicateMessages([...state.messages, msg]);
  
  const isAtBottom = (activeGroup === groupName) && activeChatAtBottom;
  
  if (msg.senderId === authUserId || isAtBottom) {
    state.lastReadId = msg._id;
    state.showUnreadMarker = false;
    state.unreadCount = 0;
    AsyncStorage.setItem(`lastRead_${groupName}`, msg._id);
  } else {
    if (state.showUnreadMarker) {
      state.unreadCount += 1;
    } else {
      state.showUnreadMarker = true;
      state.unreadCount = 1;
    }
  }
  notifyListeners();
}

// Update reactions
export function updateMessageReactions(groupName: string, messageId: string, reactions: { [emoji: string]: string[] }) {
  const state = getChatState(groupName);
  state.messages = state.messages.map(m =>
    m._id === messageId ? { ...m, reactions } : m
  );
  notifyListeners();
}

// Edit message
export function editChatMessage(groupName: string, messageId: string, text: string, editedAt: string) {
  const state = getChatState(groupName);
  state.messages = state.messages.map(m =>
    m._id === messageId ? { ...m, text, edited: true, editedAt } : m
  );
  notifyListeners();
}

// Delete message
export function deleteChatMessage(groupName: string, messageId: string, deleteFor: string, userId?: string) {
  const state = getChatState(groupName);
  const exists = state.messages.some(m => m._id === messageId);
  if (!exists) return;
  if (deleteFor === 'everyone') {
    state.messages = state.messages.filter(m => m._id !== messageId);
  } else if (deleteFor === 'me' && userId) {
    state.messages = state.messages.map(m =>
      m._id === messageId
        ? { ...m, deletedFor: [...(m.deletedFor || []), userId] }
        : m
    );
  }
  notifyListeners();
}

// Typing indicators
export function setUserTyping(groupName: string, userName: string, isTyping: boolean) {
  const state = getChatState(groupName);
  if (isTyping) {
    if (!state.typingUsers.includes(userName)) {
      state.typingUsers = [...state.typingUsers, userName];
    }
  } else {
    state.typingUsers = state.typingUsers.filter(name => name !== userName);
  }
  notifyListeners();
}

// Set loadingMore state
export function setLoadingMore(groupName: string, loading: boolean) {
  const state = getChatState(groupName);
  if (state.loadingMore === loading) return;
  state.loadingMore = loading;
  notifyListeners();
}

// Prepend older history (pagination)
export function addOlderMessages(groupName: string, olderMessages: ChatMessage[], hasMore: boolean = true) {
  const state = getChatState(groupName);
  state.messages = deduplicateMessages([...olderMessages, ...state.messages]);
  state.loadingMore = false;
  state.hasMore = hasMore;
  notifyListeners();
}

// Clear all cache on logout
export function clearCache() {
  chatStates = {};
  notifyListeners();
}

// Helper to deduplicate messages by _id
function deduplicateMessages(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set();
  return messages.filter(m => {
    if (!m._id || seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
}
