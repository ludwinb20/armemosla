import { useState } from 'react';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertOptions {
  title: string;
  message: string;
  type: AlertType;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export const useCustomAlert = () => {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertOptions, setAlertOptions] = useState<AlertOptions>({
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
  });

  const showAlert = (options: AlertOptions) => {
    setAlertOptions({
      ...options,
      confirmText: options.confirmText || 'OK',
    });
    setAlertVisible(true);
  };

  const showError = (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showAlert({
      title,
      message,
      type: 'error',
      confirmText: confirmText || 'OK',
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  const showSuccess = (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showAlert({
      title,
      message,
      type: 'success',
      confirmText: confirmText || 'OK',
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  const showInfo = (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showAlert({
      title,
      message,
      type: 'info',
      confirmText: confirmText || 'OK',
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  const showWarning = (
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => {
    showAlert({
      title,
      message,
      type: 'warning',
      confirmText: confirmText || 'OK',
      cancelText,
      onConfirm,
      onCancel,
    });
  };

  const hideAlert = () => {
    setAlertVisible(false);
  };

  const handleConfirm = () => {
    if (alertOptions.onConfirm) {
      alertOptions.onConfirm();
    }
    hideAlert();
  };

  const handleCancel = () => {
    if (alertOptions.onCancel) {
      alertOptions.onCancel();
    }
    hideAlert();
  };

  return {
    alertVisible,
    alertOptions,
    showAlert,
    showError,
    showSuccess,
    showInfo,
    showWarning,
    hideAlert,
    handleConfirm,
    handleCancel,
  };
};

