import React, { useState } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cn } from '@/lib/cn';
import { ui } from '@/styles/index';
import { Text } from './Text';
import { getBrandColors } from '@/constants/uiTokens';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerClassName?: string;
  className?: string;
}

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerClassName,
  className,
  secureTextEntry,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const brand = getBrandColors();

  const isSecure = secureTextEntry !== undefined;

  return (
    <View className={cn(ui.input.wrapper, containerClassName)}>
      {label ? <Text variant="label">{label}</Text> : null}
      <View className="relative flex-row items-center">
        {leftIcon ? (
          <View className="absolute left-md z-10">
            <Ionicons name={leftIcon} size={20} color={brand.primary} />
          </View>
        ) : null}
        <TextInput
          className={cn(
            ui.input.base,
            'flex-1',
            leftIcon && 'pl-xxl',
            (rightIcon || isSecure) && 'pr-xxl',
            focused && ui.input.focused,
            error && ui.input.error,
            className
          )}
          placeholderTextColor="#999999"
          secureTextEntry={hidden}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          {...props}
        />
        {isSecure ? (
          <Pressable className="absolute right-md z-10" onPress={() => setHidden((v) => !v)}>
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999999" />
          </Pressable>
        ) : rightIcon ? (
          <TouchableOpacity className="absolute right-md z-10" onPress={onRightIconPress}>
            <Ionicons name={rightIcon} size={20} color={brand.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text className={ui.input.errorText}>{error}</Text> : null}
      {!error && helper ? <Text className={ui.input.helper}>{helper}</Text> : null}
    </View>
  );
}
