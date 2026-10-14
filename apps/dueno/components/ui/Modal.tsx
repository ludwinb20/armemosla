import React from 'react';
import RNModal, { ModalProps as RNModalProps } from 'react-native-modal';
import { View, ViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { getRModalBackdropProps } from '@/lib/rnModalPresets';
import { Surface } from './Surface';

export type ModalPosition = 'center' | 'bottom';

export interface ModalProps extends Partial<RNModalProps> {
  visible: boolean;
  onClose: () => void;
  position?: ModalPosition;
  sheetClassName?: string;
  children?: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  position = 'center',
  sheetClassName,
  children,
  ...props
}: ModalProps) {
  const backdrop = getRModalBackdropProps();

  return (
    <RNModal
      isVisible={visible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      animationIn={position === 'bottom' ? 'slideInUp' : 'fadeIn'}
      animationOut={position === 'bottom' ? 'slideOutDown' : 'fadeOut'}
      backdropOpacity={0.55}
      style={position === 'bottom' ? { margin: 0, justifyContent: 'flex-end' } : { margin: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}
      useNativeDriverForBackdrop={backdrop.useNativeDriverForBackdrop}
      hideModalContentWhileAnimating={backdrop.hideModalContentWhileAnimating}
      statusBarTranslucent={backdrop.statusBarTranslucent}
      coverScreen={backdrop.coverScreen}
      deviceWidth={backdrop.deviceWidth}
      deviceHeight={backdrop.deviceHeight}
      {...props}
    >
      {position === 'bottom' ? (
        <Surface variant="overlay" className={cn(ui.modal.sheet, ui.modal.sheetPadding, sheetClassName)}>
          {children}
        </Surface>
      ) : (
        <Surface variant="overlay" className={cn('w-full max-w-[480px] rounded-xl p-lg', sheetClassName)}>
          {children}
        </Surface>
      )}
    </RNModal>
  );
}

export function ModalBody({ className, children, ...props }: ViewProps) {
  return (
    <View className={cn('gap-md', className)} {...props}>
      {children}
    </View>
  );
}
