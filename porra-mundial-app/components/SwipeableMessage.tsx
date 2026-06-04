import { useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: React.ReactNode;
  disabled?: boolean;
  onReply?: () => void;
  isMe?: boolean;
}

export default function SwipeableMessage({ children, disabled, onReply }: Props) {
  const swipeableRef = useRef<Swipeable>(null);

  if (disabled) {
    return <>{children}</>;
  }

  const renderLeftActions = (_progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = _progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-80, 0],
    });
    return (
      <Animated.View style={[styles.leftAction, { transform: [{ translateX }] }]}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        <Text style={styles.actionText}>Responder</Text>
      </Animated.View>
    );
  };

  const handleSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      onReply?.();
    }
    swipeableRef.current?.close();
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      onSwipeableOpen={handleSwipeableOpen}
      overshootLeft={false}
      friction={2}
      leftThreshold={40}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    backgroundColor: '#22c55e',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    marginVertical: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
});
