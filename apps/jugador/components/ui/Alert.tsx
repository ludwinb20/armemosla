import React from 'react';
import { View } from 'react-native';
import RNModal from 'react-native-modal';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Text } from './Text';
import { Button } from './Button';
import { Surface } from './Surface';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const typeVariant: Record<AlertType, 'primary' | 'danger' | 'outline'> = {
  error: 'danger',
  success: 'primary',
  warning: 'outline',
  info: 'primary',
};

export function Alert({
  visible,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
}: AlertProps) {
  const handleBackdrop = () => {
    if (onCancel) onCancel();
    else onConfirm?.();
  };

  return (
    <RNModal
      isVisible={visible}
      onBackdropPress={handleBackdrop}
      onBackButtonPress={handleBackdrop}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.55}
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      style={{ margin: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
    >
      <Surface variant="overlay" className={ui.alert.card}>
        {title ? <Text variant="h4" className={ui.alert.title}>{title}</Text> : null}
        <Text variant="bodySecondary" className={ui.alert.message}>{message}</Text>
        <View className={ui.alert.actions}>
          {onCancel ? (
            <Button variant="ghost" className="flex-1" onPress={onCancel}>
              {cancelText || 'Cancelar'}
            </Button>
          ) : null}
          <Button
            variant={typeVariant[type]}
            className={onCancel ? 'flex-1' : 'w-full'}
            onPress={onConfirm || (() => {})}
          >
            {confirmText}
          </Button>
        </View>
      </Surface>
    </RNModal>
  );
}
