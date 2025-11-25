import { useState } from 'react';

export type AlertType = 'error' | 'success' | 'info' | 'warning';

export interface AlertOptions {
  title: string;
  message: string;
  type: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
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

  const showError = (title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: 'error',
      confirmText: 'OK',
      onConfirm,
    });
  };

  const showSuccess = (title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: 'success',
      confirmText: 'OK',
      onConfirm,
    });
  };

  const showInfo = (title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: 'info',
      confirmText: 'OK',
      onConfirm,
    });
  };

  const showWarning = (title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      title,
      message,
      type: 'warning',
      confirmText: 'OK',
      onConfirm,
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
  };
};

