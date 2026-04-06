import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import RNModal from 'react-native-modal';
import { Colors } from '../constants/theme';
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

  const handleBackButton = () => {
    handleBackdrop();
  };

  return (
    <RNModal
      isVisible={visible}
      onBackdropPress={handleBackdrop}
      onBackButtonPress={handleBackButton}
      animationIn="fadeIn"
      animationOut="fadeOut"
      backdropOpacity={0.45}
      useNativeDriverForBackdrop
      hideModalContentWhileAnimating
      style={{ margin: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}
    >
      <View className="bg-background rounded-lg w-full max-w-[400px] overflow-hidden shadow-lg">
        <View className="p-lg">
          {title ? (
            <Text className="text-lg font-semibold text-text text-center mb-sm">{title}</Text>
          ) : null}
          <Text className="text-md text-text leading-[22px] mb-lg text-center">{message}</Text>
          <View className="flex-row gap-sm">
            {onCancel && (
              <TouchableOpacity
                className="flex-1 py-md px-lg rounded-md items-center bg-border-light"
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text className="text-md font-semibold text-text">{cancelText || 'Cancelar'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className={`${onCancel ? 'flex-1' : 'w-full'} py-md px-lg rounded-md items-center`}
              style={{ backgroundColor: getTypeColor() }}
              onPress={onConfirm || (() => {})}
              activeOpacity={0.8}
            >
              <Text className="text-md font-semibold text-text-inverse">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
}
