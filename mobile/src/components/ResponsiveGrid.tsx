import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { spacing } from '../theme/spacing';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** En desktop web distribuye hijos en columnas; en móvil apilados. */
export default function ResponsiveGrid({ children, style }: Props) {
  const { gridColumns, isDesktopWeb } = useResponsiveLayout();
  const items = React.Children.toArray(children).filter(Boolean);

  if (!isDesktopWeb || gridColumns <= 1) {
    return <View style={[styles.stack, style]}>{items}</View>;
  }

  const itemBasis = gridColumns === 3 ? '31.5%' : '48.5%';

  return (
    <View style={[styles.grid, style]}>
      {items.map((child, index) => (
        <View key={index} style={[styles.cell, { width: itemBasis as `${number}%` }]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  cell: {
    minWidth: 0,
  },
});
