import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import RNModal from 'react-native-modal';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { useThemeColors } from '../hooks/useThemeColors';

interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type: 'error' | 'success' | 'info' | 'warning';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function CustomAlert({
  visible,
  title,
  message,
  type,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
}: CustomAlertProps) {
  const colors = useThemeColors();

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

  const handleBackdrop = () => {
    if (onCancel) {
      onCancel();
    } else {
      onConfirm?.();
    }
  };

  return (
    <RNModal
      isVisible={visible}
      onBackdropPress={handleBackdrop}
      onBackButtonPress={handleBackdrop}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.45}
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      style={styles.modal}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
          Shadows.lg,
        ]}
      >
        {title ? (
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        <View style={styles.actions}>
          {onCancel ? (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.borderLight }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelText, { color: colors.text }]}>{cancelText || 'Cancelar'}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              onCancel ? styles.confirmButtonHalf : styles.confirmButtonFull,
              { backgroundColor: getTypeColor() },
            ]}
            onPress={onConfirm || (() => {})}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
  },
  confirmButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  confirmButtonHalf: {
    flex: 1,
  },
  confirmButtonFull: {
    width: '100%',
  },
  confirmText: {
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    color: Colors.textInverse,
  },
});
