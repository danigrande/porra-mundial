import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getAuth } from '../../stores/authStore';
import * as socketService from '../../services/socket';
import * as api from '../../services/api';

export default function ChatScreen() {
  const [messages, setMessages] = useState<socketService.ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const flatListRef = useRef<FlatList>(null);
  
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  useEffect(() => {
    if (!auth) return;

    // Load initial history
    loadHistory();

    const socket = socketService.getSocket();
    if (!socket) return;

    // Socket Event Listeners
    socket.on('new-message', (msg: socketService.ChatMessage) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    socket.on('chat-history', (data) => {
      if (data.groupName === groupName) {
        setMessages(data.messages);
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
      }
    });

    socket.on('user-typing', (data) => {
      if (data.groupName === groupName && data.userName !== auth.name) {
        setTypingUsers(prev => {
          if (!prev.includes(data.userName)) return [...prev, data.userName];
          return prev;
        });
      }
    });

    socket.on('user-stopped-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== data.userName));
      }
    });

    socket.on('bot-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => {
          if (!prev.includes('Agente Mundial')) return [...prev, 'Agente Mundial'];
          return prev;
        });
      }
    });

    socket.on('bot-stopped-typing', (data) => {
      if (data.groupName === groupName) {
        setTypingUsers(prev => prev.filter(name => name !== 'Agente Mundial'));
      }
    });

    return () => {
      socket.off('new-message');
      socket.off('chat-history');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('bot-typing');
      socket.off('bot-stopped-typing');
    };
  }, [auth]);

  async function loadHistory() {
    try {
      setLoading(true);
      const history = await api.getChatHistory(groupName);
      setMessages(history);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    if (!text.trim() || !auth) return;
    socketService.sendMessage(groupName, text);
    setText('');
    socketService.sendStopTyping(groupName);
    setIsTyping(false);
  }

  function handleTextChange(val: string) {
    setText(val);
    if (!isTyping && val.length > 0) {
      setIsTyping(true);
      socketService.sendTyping(groupName);
    } else if (isTyping && val.length === 0) {
      setIsTyping(false);
      socketService.sendStopTyping(groupName);
    }
  }

  const renderMessage = ({ item }: { item: socketService.ChatMessage }) => {
    const isMe = item.senderId === auth?.phone;
    return (
      <View style={[styles.messageBubble, isMe ? styles.messageMe : item.isBot ? styles.messageBot : styles.messageOther]}>
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
        <Text style={styles.messageText}>{item.text}</Text>
        <Text style={styles.timeText}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item._id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      
      {typingUsers.length > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está' : 'están'} escribiendo...
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje... (@agente para hablar con IA)"
          placeholderTextColor="#666"
          value={text}
          onChangeText={handleTextChange}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <MaterialIcons name="send" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e27',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  messageMe: {
    alignSelf: 'flex-end',
    backgroundColor: '#1e40af',
    borderBottomRightRadius: 4,
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#151a3a',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  messageBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#2d1b4e',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#4c1d95',
  },
  senderName: {
    color: '#f5a623',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  timeText: {
    color: '#888',
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingText: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#151a3a',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#1e2a5a',
  },
  input: {
    flex: 1,
    backgroundColor: '#0a0e27',
    color: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#1e2a5a',
  },
  sendButton: {
    backgroundColor: '#1e40af',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginBottom: 2,
  },
});
