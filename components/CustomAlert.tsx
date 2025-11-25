import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { AlertOptions } from '../hooks/useCustomAlert';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  confirmText?: string;
  onConfirm?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  type,
  confirmText = 'OK',
  onConfirm,
}: CustomAlertProps) {
  const getTypeColor = () => {
    switch (type) {
      case 'error':
        return Colors.error;
      case 'success':
        return Colors.success;
      case 'warning':
        return Colors.warning;
      case 'info':
      default:
        return Colors.info;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirm}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, { backgroundColor: getTypeColor() }]}>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.message}>{message}</Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: getTypeColor() }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  container: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  header: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  content: {
    padding: Spacing.lg,
  },
  message: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});

