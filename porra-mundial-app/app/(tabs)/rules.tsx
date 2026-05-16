import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';

export default function RulesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const RuleSection = ({ number, title, children, icon }: any) => (
    <View style={styles.section}>
      <View style={styles.ruleTitleRow}>
        {number ? (
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{number}</Text>
          </View>
        ) : (
          <View style={styles.iconBadge}>
            {icon}
          </View>
        )}
        <Text style={styles.ruleTitle}>{title}</Text>
      </View>
      <View style={styles.ruleContent}>
        {children}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Reglas del Juego', headerTitleAlign: 'center' }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('rules.title')}</Text>
        <Text style={styles.headerSubtitle}>{t('rules.subtitle')}</Text>
      </View>

      {/* Sección 1: Modos de Juego */}
      <RuleSection number="1" title={t('rules.modes_title')}>
        <Text style={styles.text}>{t('rules.modes_intro')}</Text>
        
        <View style={styles.modesContainer}>
          <View style={[styles.modeCard, { borderColor: 'rgba(59, 130, 246, 0.3)', backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
            <Text style={[styles.modeTitle, { color: '#3b82f6' }]}>{t('rules.mode_a_title')}</Text>
            <Text style={styles.modeText}>{t('rules.mode_a_desc')}</Text>
          </View>
          
          <View style={[styles.modeCard, { borderColor: 'rgba(16, 185, 129, 0.3)', backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <Text style={[styles.modeTitle, { color: '#10b981' }]}>{t('rules.mode_b_title')}</Text>
            <Text style={styles.modeText}>{t('rules.mode_b_desc')}</Text>
          </View>
        </View>
        
        <View style={styles.noteBox}>
          <Ionicons name="location" size={16} color="#f5a623" />
          <Text style={styles.noteText}>
            <Text style={{ fontWeight: 'bold' }}>{t('rules.note_label')} </Text> {t('rules.note_desc')}
          </Text>
        </View>
      </RuleSection>

      {/* Sección 2: El Agente Mundial */}
      <RuleSection icon={<MaterialCommunityIcons name="robot" size={20} color="#25D366" />} title={t('rules.bot_title')}>
        <Text style={styles.text}>{t('rules.bot_intro')}</Text>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>{t('rules.bot_li1')}</Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>{t('rules.bot_li2')}</Text>
          </View>
          <View style={styles.listItem}>
            <View style={styles.bullet} />
            <Text style={styles.listText}>{t('rules.bot_li3')}</Text>
          </View>
        </View>
      </RuleSection>

      {/* Sección 3: Sistema de Puntuación */}
      <RuleSection number="2" title={t('rules.scoring_title')}>
        <Text style={styles.text}>{t('rules.scoring_intro')}</Text>
        
        <View style={styles.table}>
          {[
            { label: t('rules.score_sign'), sub: t('rules.score_sign_sub'), pts: '+10' },
            { label: t('rules.score_diff'), sub: t('rules.score_diff_sub'), pts: '+10' },
            { label: t('rules.score_exact'), sub: t('rules.score_exact_sub'), pts: '+10' },
            { label: t('rules.score_pos'), sub: t('rules.score_pos_sub'), pts: '+5' },
            { label: t('rules.score_qual'), sub: t('rules.score_qual_sub'), pts: '+5 a +10' },
          ].map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableLabel}>{item.label}</Text>
                <Text style={styles.tableSub}>{item.sub}</Text>
              </View>
              <Text style={styles.tablePts}>{item.pts} pts</Text>
            </View>
          ))}
        </View>

        <View style={styles.exampleBox}>
          <Ionicons name="bulb" size={16} color="#f5a623" />
          <Text style={styles.exampleText}>
            {t('rules.scoring_example')}
          </Text>
        </View>
      </RuleSection>

      {/* Sección 4: Eliminatorias */}
      <RuleSection number="3" title={t('rules.ko_title')}>
        <Text style={styles.text}>{t('rules.ko_intro')}</Text>
        
        <View style={styles.penaltyBox}>
          <View style={styles.penaltyHeader}>
            <MaterialIcons name="warning" size={20} color="#ef4444" />
            <Text style={styles.penaltyTitle}>{t('rules.tie_rule_title')}</Text>
          </View>
          <Text style={styles.penaltyText}>
            {t('rules.tie_rule_1')}
          </Text>
          <Text style={[styles.penaltyText, { marginTop: 8, fontStyle: 'italic' }]}>
            {t('rules.tie_rule_2')}
          </Text>
        </View>
      </RuleSection>

      {/* Sección 5: Cuadro de Honor */}
      <RuleSection number="4" title={t('rules.awards_title')}>
        <Text style={styles.text}>{t('rules.awards_intro')}</Text>
        
        <View style={styles.table}>
          {[
            { label: t('rules.award_champ'), pts: '+50', color: '#fbbf24' },
            { label: t('rules.award_runner'), pts: '+30', color: '#e2e8f0' },
            { label: t('rules.award_gold'), pts: '+25', color: '#fbbf24' },
            { label: t('rules.award_silver'), pts: '+15', color: '#94a3b8' },
            { label: t('rules.award_bronze'), pts: '+10', color: '#b45309' },
          ].map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: item.color || '#fff' }]}>{item.label}</Text>
              <Text style={[styles.tablePts, { color: item.color || '#10b981' }]}>{item.pts} pts</Text>
            </View>
          ))}
        </View>
      </RuleSection>

      {/* Sección 6: Restricciones */}
      <RuleSection number="5" title={t('rules.restrictions_title')}>
        <View style={styles.list}>
          <View style={styles.listItem}>
            <Ionicons name="close-circle" size={18} color="#ef4444" />
            <Text style={styles.listText}>{t('rules.restrict_1')}</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.listText}>{t('rules.restrict_2')}</Text>
          </View>
          <View style={styles.listItem}>
            <Ionicons name="podium" size={18} color="#3b82f6" />
            <Text style={styles.listText}>{t('rules.restrict_3')}</Text>
          </View>
        </View>
      </RuleSection>

      <Text style={styles.footer}>
        {t('rules.footer')}
      </Text>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e27' },
  content: { padding: 20 },
  header: { marginBottom: 30, alignItems: 'center' },
  headerTitle: { fontSize: 32, fontWeight: '900', color: '#fff', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 8 },
  section: { 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.05)',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981'
  },
  ruleTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, gap: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' },
  stepBadgeText: { color: '#000', fontWeight: '900', fontSize: 14 },
  iconBadge: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  ruleTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  ruleContent: {},
  text: { color: '#94a3b8', fontSize: 15, lineHeight: 22 },
  modesContainer: { marginTop: 15, gap: 12 },
  modeCard: { padding: 15, borderRadius: 16, borderWidth: 1 },
  modeTitle: { fontWeight: '800', fontSize: 15, marginBottom: 4 },
  modeText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  noteBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245, 166, 35, 0.1)', padding: 12, borderRadius: 12, marginTop: 15, gap: 8 },
  noteText: { color: '#94a3b8', fontSize: 13, flex: 1 },
  list: { marginTop: 10, gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginTop: 8 },
  listText: { color: '#94a3b8', fontSize: 14, flex: 1 },
  table: { marginTop: 15, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 16, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  tableLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  tableSub: { color: '#64748b', fontSize: 11, marginTop: 2 },
  tablePts: { color: '#10b981', fontSize: 15, fontWeight: '800', marginLeft: 10 },
  exampleBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 12, marginTop: 10, gap: 8 },
  exampleText: { color: '#475569', fontSize: 12, fontStyle: 'italic', flex: 1 },
  penaltyBox: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 16, padding: 16, marginTop: 15, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  penaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  penaltyTitle: { color: '#ef4444', fontWeight: '800', fontSize: 15 },
  penaltyText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
  footer: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 20, fontStyle: 'italic' }
});
