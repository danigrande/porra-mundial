import AsyncStorage from '@react-native-async-storage/async-storage';
import * as chatStore from '../chatStore';
import type { ChatMessage } from '../../services/socket';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

function makeMsg(
  id: string,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    _id: id,
    chatId: 'chat1',
    senderName: 'User',
    senderId: 'user1',
    text: 'Hello',
    type: 'text',
    isBot: false,
    reactions: {},
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const groupName = 'test-group';
const authUserId = 'user1';
const otherUserId = 'user2';

beforeEach(() => {
  chatStore.clearCache();
  jest.clearAllMocks();
});

afterEach(() => {
  // Unsubscribe any lingering listeners
  const unsub = chatStore.subscribeChat(() => {});
  unsub();
});

// ── getChatState ────────────────────────────────────────────────

describe('getChatState', () => {
  it('returns default state for empty group name', () => {
    const state = chatStore.getChatState('');
    expect(state.messages).toEqual([]);
    expect(state.loading).toBe(true);
    expect(state.lastReadId).toBeNull();
    expect(state.unreadCount).toBe(0);
    expect(state.showUnreadMarker).toBe(false);
    expect(state.typingUsers).toEqual([]);
    expect(state.loadingMore).toBe(false);
    expect(state.hasMore).toBe(true);
    expect(state.lastReadLoaded).toBe(false);
  });

  it('returns default state for a new group', () => {
    const state = chatStore.getChatState('new-group');
    expect(state.messages).toEqual([]);
    expect(state.loading).toBe(true);
  });

  it('returns cached state for an existing group', () => {
    const state1 = chatStore.getChatState(groupName);
    state1.loading = false;
    const state2 = chatStore.getChatState(groupName);
    expect(state2).toBe(state1);
    expect(state2.loading).toBe(false);
  });
});

// ── setActiveChat / setActiveChatAtBottom / getActiveChat ──────

describe('getActiveChat / setActiveChat / setActiveChatAtBottom', () => {
  it('setActiveChatAtBottom stores the value', () => {
    chatStore.setActiveChatAtBottom(false);
    expect(chatStore.getActiveChat().activeChatAtBottom).toBe(false);
    chatStore.setActiveChatAtBottom(true);
    expect(chatStore.getActiveChat().activeChatAtBottom).toBe(true);
  });

  it('setActiveChat stores the active group', () => {
    chatStore.setActiveChat('my-group');
    expect(chatStore.getActiveChat().activeGroup).toBe('my-group');
    chatStore.setActiveChat(null);
    expect(chatStore.getActiveChat().activeGroup).toBeNull();
  });

  it('setActiveChatAtBottom does NOT call notifyListeners', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.setActiveChatAtBottom(false);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ── subscribeChat / notifyListeners ───────────────────────────

describe('subscribeChat / notifyListeners', () => {
  it('subscribes and calls listener on notify', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.setChatHistory(groupName, []);
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('unsubscribes removes the listener', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    unsub();
    chatStore.setChatHistory(groupName, []);
    expect(listener).not.toHaveBeenCalled();
  });
});

// ── addNewMessage ───────────────────────────────────────────────

describe('addNewMessage', () => {
  beforeEach(() => {
    chatStore.setActiveChat(groupName);
    chatStore.setActiveChatAtBottom(true);
    chatStore.getChatState(groupName); // init state
  });

  it('adds a message to the list', () => {
    const msg = makeMsg('m1');
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]._id).toBe('m1');
  });

  it('marks as read (sets lastReadId) when at bottom', () => {
    const msg = makeMsg('m1');
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBe('m1');
    expect(state.unreadCount).toBe(0);
    expect(state.showUnreadMarker).toBe(false);
  });

  it('marks as read when it is own message (even if not at bottom)', () => {
    chatStore.setActiveChatAtBottom(false);
    const msg = makeMsg('m1', { senderId: authUserId });
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBe('m1');
    expect(state.showUnreadMarker).toBe(false);
  });

  it('increments unread when NOT at bottom and NOT own message', () => {
    chatStore.setActiveChatAtBottom(false);
    const msg = makeMsg('m1', { senderId: otherUserId });
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBeNull();
    expect(state.showUnreadMarker).toBe(true);
    expect(state.unreadCount).toBe(1);
  });

  it('increments unread count when marker already exists', () => {
    chatStore.setActiveChatAtBottom(false);
    chatStore.addNewMessage(groupName, makeMsg('m1', { senderId: otherUserId }), authUserId);
    chatStore.addNewMessage(groupName, makeMsg('m2', { senderId: otherUserId }), authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.showUnreadMarker).toBe(true);
    expect(state.unreadCount).toBe(2);
  });

  it('does NOT auto-mark as read when activeGroup differs', () => {
    chatStore.setActiveChat('other-group');
    chatStore.setActiveChatAtBottom(true);
    const msg = makeMsg('m1', { senderId: otherUserId });
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBeNull();
    expect(state.showUnreadMarker).toBe(true);
  });

  it('deduplicates by _id', () => {
    const msg = makeMsg('m1');
    chatStore.addNewMessage(groupName, msg, authUserId);
    chatStore.addNewMessage(groupName, msg, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(1);
  });

  it('notifies listeners', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.addNewMessage(groupName, makeMsg('m1'), authUserId);
    expect(listener).toHaveBeenCalled();
    unsub();
  });

  it('stores lastReadId when user is at bottom but activeGroup matches', () => {
    chatStore.setActiveChat(groupName);
    chatStore.setActiveChatAtBottom(true);
    chatStore.addNewMessage(groupName, makeMsg('m1', { senderId: otherUserId }), authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBe('m1');
  });
});

// ── updateLastRead ──────────────────────────────────────────────

describe('updateLastRead', () => {
  beforeEach(() => {
    chatStore.setActiveChat(groupName);
    chatStore.setActiveChatAtBottom(false);
    chatStore.getChatState(groupName);
    chatStore.addNewMessage(groupName, makeMsg('m1', { senderId: otherUserId }), authUserId);
    chatStore.addNewMessage(groupName, makeMsg('m2', { senderId: otherUserId }), authUserId);
  });

  it('updates lastReadId', () => {
    chatStore.updateLastRead(groupName, 'm2');
    const state = chatStore.getChatState(groupName);
    expect(state.lastReadId).toBe('m2');
  });

  it('clears unreadCount and showUnreadMarker', () => {
    chatStore.updateLastRead(groupName, 'm2');
    const state = chatStore.getChatState(groupName);
    expect(state.unreadCount).toBe(0);
    expect(state.showUnreadMarker).toBe(false);
  });

  it('notifies listeners', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.updateLastRead(groupName, 'm2');
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});

// ── setChatHistory ──────────────────────────────────────────────

describe('setChatHistory', () => {
  it('replaces messages and sets loading=false', () => {
    const msgs = [makeMsg('m1'), makeMsg('m2')];
    chatStore.setChatHistory(groupName, msgs);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(2);
    expect(state.loading).toBe(false);
  });

  it('deduplicates messages', () => {
    const msgs = [makeMsg('m1'), makeMsg('m1'), makeMsg('m2')];
    chatStore.setChatHistory(groupName, msgs);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(2);
  });

  it('recomputes unread when lastReadId is set', () => {
    chatStore.getChatState(groupName);
    chatStore.updateLastRead(groupName, 'm1');
    const msgs = [makeMsg('m1'), makeMsg('m2')];
    chatStore.setChatHistory(groupName, msgs);
    const state = chatStore.getChatState(groupName);
    expect(state.showUnreadMarker).toBe(true);
    expect(state.unreadCount).toBe(1);
  });
});

// ── editChatMessage ─────────────────────────────────────────────

describe('editChatMessage', () => {
  it('updates text and sets edited flag', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.editChatMessage(groupName, 'm1', 'Edited text', '2024-01-01T00:00:00Z');
    const state = chatStore.getChatState(groupName);
    expect(state.messages[0].text).toBe('Edited text');
    expect(state.messages[0].edited).toBe(true);
    expect(state.messages[0].editedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('ignores unknown messageId', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.editChatMessage(groupName, 'unknown', 'Edited', '');
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].text).toBe('Hello');
  });
});

// ── deleteChatMessage ───────────────────────────────────────────

describe('deleteChatMessage', () => {
  beforeEach(() => {
    chatStore.setChatHistory(groupName, [makeMsg('m1'), makeMsg('m2')]);
  });

  it('scope "everyone" removes the message', () => {
    chatStore.deleteChatMessage(groupName, 'm1', 'everyone');
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]._id).toBe('m2');
  });

  it('scope "me" adds userId to deletedFor', () => {
    chatStore.deleteChatMessage(groupName, 'm1', 'me', 'user1');
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].deletedFor).toContain('user1');
  });

  it('is no-op when message does not exist', () => {
    chatStore.deleteChatMessage(groupName, 'ghost', 'everyone');
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(2);
  });

  it('scope "me" without userId does not mutate', () => {
    chatStore.deleteChatMessage(groupName, 'm1', 'me');
    const state = chatStore.getChatState(groupName);
    expect(state.messages[0].deletedFor).toBeUndefined();
  });
});

// ── setUserTyping ───────────────────────────────────────────────

describe('setUserTyping', () => {
  beforeEach(() => {
    chatStore.setChatHistory(groupName, []);
  });

  it('adds user to typingUsers when typing', () => {
    chatStore.setUserTyping(groupName, 'Alice', true);
    const state = chatStore.getChatState(groupName);
    expect(state.typingUsers).toContain('Alice');
  });

  it('does not duplicate user', () => {
    chatStore.setUserTyping(groupName, 'Alice', true);
    chatStore.setUserTyping(groupName, 'Alice', true);
    const state = chatStore.getChatState(groupName);
    expect(state.typingUsers).toEqual(['Alice']);
  });

  it('removes user when not typing', () => {
    chatStore.setUserTyping(groupName, 'Alice', true);
    chatStore.setUserTyping(groupName, 'Alice', false);
    const state = chatStore.getChatState(groupName);
    expect(state.typingUsers).not.toContain('Alice');
  });
});

// ── setLoadingMore ──────────────────────────────────────────────

describe('setLoadingMore', () => {
  it('sets loadingMore flag', () => {
    chatStore.setLoadingMore(groupName, true);
    expect(chatStore.getChatState(groupName).loadingMore).toBe(true);
    chatStore.setLoadingMore(groupName, false);
    expect(chatStore.getChatState(groupName).loadingMore).toBe(false);
  });

  it('does not notify if value unchanged', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.setLoadingMore(groupName, true);
    listener.mockClear();
    chatStore.setLoadingMore(groupName, true);
    expect(listener).not.toHaveBeenCalled();
    unsub();
  });
});

// ── addOlderMessages ────────────────────────────────────────────

describe('addOlderMessages', () => {
  it('prepends older messages', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m3'), makeMsg('m4')]);
    chatStore.addOlderMessages(groupName, [makeMsg('m1'), makeMsg('m2')]);
    const state = chatStore.getChatState(groupName);
    expect(state.messages.map(m => m._id)).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('deduplicates overlapping messages', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m2'), makeMsg('m3')]);
    chatStore.addOlderMessages(groupName, [makeMsg('m1'), makeMsg('m2')]);
    const state = chatStore.getChatState(groupName);
    expect(state.messages.map(m => m._id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('sets hasMore to false', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.addOlderMessages(groupName, [], false);
    expect(chatStore.getChatState(groupName).hasMore).toBe(false);
  });

  it('sets loadingMore to false', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.addOlderMessages(groupName, [makeMsg('m0')]);
    expect(chatStore.getChatState(groupName).loadingMore).toBe(false);
  });
});

// ── updateMessageReactions ──────────────────────────────────────

describe('updateMessageReactions', () => {
  it('updates reactions for the given message', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.updateMessageReactions(groupName, 'm1', { '👍': ['user1'] });
    const state = chatStore.getChatState(groupName);
    expect(state.messages[0].reactions).toEqual({ '👍': ['user1'] });
  });

  it('ignores unknown messageId', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.updateMessageReactions(groupName, 'ghost', { '👍': ['user1'] });
    const state = chatStore.getChatState(groupName);
    expect(state.messages[0].reactions).toEqual({});
  });
});

// ── setSocketConnected / isSocketConnected ──────────────────────

describe('setSocketConnected / isSocketConnected', () => {
  it('defaults to true', () => {
    expect(chatStore.isSocketConnected()).toBe(true);
  });

  it('updates connected state and notifies', () => {
    const listener = jest.fn();
    const unsub = chatStore.subscribeChat(listener);
    chatStore.setSocketConnected(false);
    expect(chatStore.isSocketConnected()).toBe(false);
    expect(listener).toHaveBeenCalled();
    chatStore.setSocketConnected(true);
    expect(chatStore.isSocketConnected()).toBe(true);
    unsub();
  });
});

// ── clearCache ──────────────────────────────────────────────────

describe('clearCache', () => {
  it('resets all group states', () => {
    chatStore.setChatHistory(groupName, [makeMsg('m1')]);
    chatStore.clearCache();
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toEqual([]);
    expect(state.loading).toBe(true);
  });
});

// ── setLoading ──────────────────────────────────────────────────

describe('setLoading', () => {
  it('sets loading flag', () => {
    chatStore.setLoading(groupName, false);
    expect(chatStore.getChatState(groupName).loading).toBe(false);
    chatStore.setLoading(groupName, true);
    expect(chatStore.getChatState(groupName).loading).toBe(true);
  });
});

// ── Edge case: deduplication across calls ───────────────────────

describe('deduplication edge cases', () => {
  it('handles null/undefined _id gracefully', () => {
    chatStore.addNewMessage(groupName, makeMsg('', { _id: '' }), authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(0);
  });

  it('keeps only first occurrence when duplicate _id added later', () => {
    const msg1 = makeMsg('m1', { text: 'first' });
    const msg2 = makeMsg('m1', { text: 'second' });
    chatStore.addNewMessage(groupName, msg1, authUserId);
    chatStore.addNewMessage(groupName, msg2, authUserId);
    const state = chatStore.getChatState(groupName);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0].text).toBe('first');
  });
});
