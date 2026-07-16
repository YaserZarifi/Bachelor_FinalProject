import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { Toast } from '../components/ui/Toast';
import { colors, fonts, radius, shadow } from '../theme';

/**
 * App-wide, in-UI feedback — replaces native Android notification banners and
 * `Alert.alert` dialogs with the app's own toast + modal, so every message is
 * rendered inside the شهریاور interface (not the OS chrome).
 *
 *   const { toast, alert } = useFeedback();
 *   toast('وضعیت به‌روز شد', 'success');
 *   alert({ title, message, buttons: [{ text, style, onPress }] });
 */
const FeedbackContext = createContext({ toast: () => {}, alert: () => {} });

const TONE = {
  info: { icon: 'notifications', color: colors.brand[300] },
  success: { icon: 'checkmark-circle', color: colors.civic[400] },
  error: { icon: 'alert-circle', color: colors.coral[400] },
  warning: { icon: 'warning', color: colors.brand[400] },
};

export function FeedbackProvider({ children }) {
  const [toastState, setToastState] = useState(null); // { message, tone, key }
  const [dialog, setDialog] = useState(null); // { title, message, buttons }

  const toast = useCallback((message, tone = 'info') => {
    setToastState({ message, tone, key: Date.now() + Math.random() });
  }, []);

  const alert = useCallback((opts) => {
    setDialog({
      title: opts?.title || '',
      message: opts?.message || '',
      buttons:
        opts?.buttons && opts.buttons.length
          ? opts.buttons
          : [{ text: 'باشه', style: 'default' }],
    });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const runButton = useCallback(
    (btn) => {
      closeDialog();
      // Defer so the modal can unmount before any navigation the handler does.
      setTimeout(() => btn?.onPress?.(), 10);
    },
    [closeDialog],
  );

  const value = useMemo(() => ({ toast, alert }), [toast, alert]);
  const tone = toastState ? TONE[toastState.tone] || TONE.info : null;

  return (
    <FeedbackContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}

        {/* In-app toast */}
        {toastState && (
          <Toast
            key={toastState.key}
            message={toastState.message}
            iconName={tone.icon}
            iconColor={tone.color}
            onHide={() => setToastState(null)}
          />
        )}

        {/* In-app alert / confirm modal */}
        {dialog && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(150)}
            style={styles.scrim}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDialog} />
            <Animated.View entering={ZoomIn.springify().damping(18)} style={styles.cardWrap}>
              {Platform.OS === 'ios' ? (
                <BlurView intensity={40} tint="dark" style={styles.card}>
                  <DialogBody dialog={dialog} onButton={runButton} />
                </BlurView>
              ) : (
                <View style={[styles.card, styles.cardAndroid]}>
                  <DialogBody dialog={dialog} onButton={runButton} />
                </View>
              )}
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </FeedbackContext.Provider>
  );
}

function DialogBody({ dialog, onButton }) {
  return (
    <View style={styles.cardInner}>
      <View style={styles.dialogIcon}>
        <Ionicons name="chatbubble-ellipses" size={22} color={colors.brand[300]} />
      </View>
      {!!dialog.title && <Text style={styles.title}>{dialog.title}</Text>}
      {!!dialog.message && <Text style={styles.message}>{dialog.message}</Text>}
      <View style={styles.buttons}>
        {dialog.buttons.map((btn, i) => {
          const destructive = btn.style === 'destructive';
          const cancel = btn.style === 'cancel';
          return (
            <Pressable
              key={i}
              onPress={() => onButton(btn)}
              style={({ pressed }) => [
                styles.btn,
                destructive && styles.btnDestructive,
                cancel && styles.btnCancel,
                !destructive && !cancel && styles.btnDefault,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[
                  styles.btnText,
                  destructive && { color: '#fff' },
                  cancel && { color: colors.textMuted },
                  !destructive && !cancel && { color: colors.onBrand },
                ]}
              >
                {btn.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback() {
  return useContext(FeedbackContext);
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,10,20,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 1000,
  },
  cardWrap: { width: '100%', maxWidth: 360 },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardAndroid: { backgroundColor: 'rgba(17,26,46,0.98)' },
  cardInner: { padding: 22, alignItems: 'center' },
  dialogIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand[500] + '22',
    marginBottom: 12,
  },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 18, textAlign: 'center' },
  message: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 8,
  },
  buttons: { flexDirection: 'row-reverse', gap: 10, marginTop: 20, width: '100%' },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnDefault: { backgroundColor: colors.brand[400] },
  btnDestructive: { backgroundColor: colors.coral[500] },
  btnCancel: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.bold, fontSize: 14 },
});
