import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { TABLE } from '../hand/PokerTable';
import { TableWordmark } from '../table/TableWordmark';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';

// The middle of the table while a room fills up: the code people type in, and the rules the
// host picked, read-only. The seats around it are the roster — they fill as guests connect,
// which is the answer to "the table should switch and wait for the players when the room is
// created, and the code should be in the middle".

interface Props {
  code: string;
  codeLabel: string;
  /** "Share the code" for the host, "waiting for the host" for a guest. */
  caption: string;
  /** The host's chosen rules, one short line each. */
  rules?: string[];
  /** Label for the share action. Omitted for a guest, who has nobody to invite. */
  inviteLabel?: string;
  onInvite?: () => void;
  width: number;
}

export function LobbyFelt({ code, codeLabel, caption, rules = [], inviteLabel, onInvite, width }: Props) {
  return (
    <View style={[styles.felt, { width }]}>
      <Text style={styles.codeLabel}>{codeLabel}</Text>
      <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {code}
      </Text>
      {onInvite && inviteLabel && (
        <TouchableOpacity style={styles.invite} onPress={onInvite} activeOpacity={0.7}>
          <Share2 size={14} color={TABLE.gold} strokeWidth={2} />
          <Text style={styles.inviteText}>{inviteLabel}</Text>
        </TouchableOpacity>
      )}
      <TableWordmark />
      <Text style={styles.caption} numberOfLines={2}>
        {caption}
      </Text>
      {rules.map((rule) => (
        <Text key={rule} style={styles.rule} numberOfLines={1}>
          {rule}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  felt: {
    alignItems: 'center',
  },
  codeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  code: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize['3xl'],
    letterSpacing: 8,
    color: TABLE.gold,
    marginTop: 2,
  },
  // "Share this code" was a caption with nothing to press: retyping four digits into WhatsApp
  // by hand is exactly the friction Mathieu asked to remove.
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: TABLE.goldDeep,
  },
  inviteText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: TABLE.gold,
  },
  caption: {
    marginTop: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    lineHeight: 15,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
  },
  rule: {
    marginTop: 3,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.xs,
    textAlign: 'center',
    color: TABLE.gold,
  },
});
