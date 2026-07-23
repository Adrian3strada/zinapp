import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import {
  addDaysToDate,
  formatPromoExpirySummary,
  parseIsoDate,
  PROMO_DURATION_PRESETS,
  PROMO_TIME_PRESETS,
  todayIsoDate,
  toIsoDate,
} from '../../utils/promo';

interface Props {
  endDate: string;
  endTime: string;
  onChange: (endDate: string, endTime: string) => void;
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

type DayCell = { day: number; iso: string } | null;

function isoToDate(iso: string): Date | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Semanas de exactamente 7 celdas (lun–dom) para alinear columnas sin % fraccionarios. */
function buildCalendarWeeks(viewYear: number, viewMonth: number): DayCell[][] {
  const firstDay = new Date(viewYear, viewMonth - 1, 1);
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: DayCell[] = [];

  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: toIsoDate(viewYear, viewMonth, day) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default function PromoExpiryPicker({ endDate, endTime, onChange }: Props) {
  const selected = parseIsoDate(endDate) ?? parseIsoDate(todayIsoDate())!;
  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);
  const [daySize, setDaySize] = useState(34);

  const todayIso = todayIsoDate();
  const today = startOfToday();
  const weeks = useMemo(() => buildCalendarWeeks(viewYear, viewMonth), [viewYear, viewMonth]);
  const summary = formatPromoExpirySummary(endDate, endTime);

  const onGridLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (!width) return;
    // 7 columnas iguales; deja aire entre círculos.
    const next = Math.max(28, Math.min(40, Math.floor(width / 7) - 6));
    setDaySize((prev) => (prev === next ? prev : next));
  };

  const shiftMonth = (delta: number) => {
    let month = viewMonth + delta;
    let year = viewYear;
    while (month < 1) {
      month += 12;
      year -= 1;
    }
    while (month > 12) {
      month -= 12;
      year += 1;
    }
    setViewYear(year);
    setViewMonth(month);
  };

  const selectDate = (iso: string) => {
    onChange(iso, endTime);
    const parsed = parseIsoDate(iso);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  };

  const applyDuration = (days: number) => {
    onChange(addDaysToDate(todayIso, days), endTime);
    const next = parseIsoDate(addDaysToDate(todayIso, days));
    if (next) {
      setViewYear(next.year);
      setViewMonth(next.month);
    }
  };

  const isPast = (iso: string) => {
    const date = isoToDate(iso);
    return !date || date.getTime() < today.getTime();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.durationRow}>
        {PROMO_DURATION_PRESETS.map((preset) => (
          <Pressable
            key={preset.label}
            style={styles.durationChip}
            onPress={() => applyDuration(preset.days)}
          >
            <Text style={styles.durationChipText}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.calendar}>
        <View style={styles.calendarHeader}>
          <Pressable style={styles.navBtn} onPress={() => shiftMonth(-1)} hitSlop={8}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.monthTitle} numberOfLines={1}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </Text>
          <Pressable style={styles.navBtn} onPress={() => shiftMonth(1)} hitSlop={8}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow} onLayout={onGridLayout}>
          {WEEKDAYS.map((label, index) => (
            <View key={`${label}-${index}`} style={styles.col}>
              <Text style={styles.weekdayLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.weeks}>
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((cell, dayIndex) => {
                if (!cell) {
                  return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.col} />;
                }
                const selectedDay = cell.iso === endDate;
                const disabled = isPast(cell.iso);
                const isToday = cell.iso === todayIso;
                return (
                  <View key={cell.iso} style={styles.col}>
                    <Pressable
                      style={[
                        styles.dayHit,
                        {
                          width: daySize,
                          height: daySize,
                          borderRadius: daySize / 2,
                        },
                        selectedDay && styles.dayHitSelected,
                        isToday && !selectedDay && styles.dayHitToday,
                        disabled && styles.dayHitDisabled,
                      ]}
                      onPress={() => !disabled && selectDate(cell.iso)}
                      disabled={disabled}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          daySize < 32 && styles.dayTextCompact,
                          selectedDay && styles.dayTextSelected,
                          disabled && styles.dayTextDisabled,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.timeLabel}>Hora de fin</Text>
      <View style={styles.timeRow}>
        {PROMO_TIME_PRESETS.map((preset) => {
          const selectedTime = endTime === preset.value;
          return (
            <Pressable
              key={preset.value}
              style={[styles.timeChip, selectedTime && styles.timeChipActive]}
              onPress={() => onChange(endDate, preset.value)}
            >
              <Text style={[styles.timeChipText, selectedTime && styles.timeChipTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {Platform.OS === 'web' ? (
        <View style={styles.webTimeRow}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(React.createElement as any)('input', {
            type: 'time',
            value: endTime,
            onChange: (event: { target: { value: string } }) =>
              onChange(endDate, event.target.value || '23:59'),
            style: {
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontWeight: 600,
              color: colors.text,
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: 0,
              outline: 'none',
            },
          })}
        </View>
      ) : null}

      <View style={styles.summary}>
        <Ionicons name="calendar" size={16} color={colors.primaryDark} />
        <Text style={styles.summaryText}>Termina el {summary}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  calendar: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  monthTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 2,
  },
  weeks: { width: '100%' },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  col: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 2,
  },
  weekdayLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dayHit: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHitSelected: { backgroundColor: colors.primary },
  dayHitToday: { borderWidth: 1.5, borderColor: colors.primary },
  dayHitDisabled: { opacity: 0.35 },
  dayText: { fontSize: 14, fontWeight: '700', color: colors.text },
  dayTextCompact: { fontSize: 12 },
  dayTextSelected: { color: '#FFF' },
  dayTextDisabled: { color: colors.textMuted },
  timeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  timeChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  timeChipTextActive: { color: colors.primary },
  webTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  summaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryDark,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
});
