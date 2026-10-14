import React from 'react';
import { Dimensions, View, ViewProps } from 'react-native';
import { cn } from '@/lib/cn';
import { Surface } from './Surface';

export function getDialogSheetWidth(horizontalPadding = 32) {
  const { width } = Dimensions.get('window');
  return Math.min(440, width - horizontalPadding);
}

export interface DialogSheetProps extends ViewProps {
  maxHeight?: number;
  className?: string;
  children?: React.ReactNode;
}

/** Panel centrado para modales de formulario. Ancho explícito — no usar Screen/SafeAreaView aquí. */
export function DialogSheet({ maxHeight, className, children, style, ...props }: DialogSheetProps) {
  const sheetWidth = getDialogSheetWidth();

  return (
    <View
      style={[{ width: sheetWidth, alignSelf: 'center' }, style]}
      className={className}
      {...props}
    >
      <Surface
        variant="overlay"
        className="w-full rounded-xl overflow-hidden"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </Surface>
    </View>
  );
}

export function DialogHeader({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex-row justify-between items-center p-lg border-b border-border-subtle dark:border-border-subtle-dark flex-shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

export function DialogFooter({ className, children, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'flex-row p-lg border-t border-border-subtle dark:border-border-subtle-dark gap-md flex-shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}
