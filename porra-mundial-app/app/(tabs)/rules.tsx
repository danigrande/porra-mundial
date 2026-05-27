import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from '../../i18n/i18n';
import { getAuth } from '../../stores/authStore';
import * as api from '../../services/api';

export default function RulesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const auth = getAuth();
  const groupName = auth?.currentGroup || '';

  const [rules, setRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupName) return;
    
    api.getGroupRules(groupName)
      .then(data => {
        const rulesData = data || {};
        const parsedRules: Record<string, number> = {};
        const ruleKeys = [
          'pts_group_sign', 'pts_group_diff', 'pts_group_exact', 'pts_group_pos', 'pts_group_qualify',
          'pts_ko_sign', 'pts_ko_diff', 'pts_ko_exact', 'pts_ko_qualify',
          'pts_honor_champ', 'pts_honor_runner', 'pts_honor_third',
          'pts_award_gold', 'pts_award_silver', 'pts_award_bronze'
        ];

        ruleKeys.forEach(key => {
          parsedRules[key] = rulesData[key] !== undefined ? Number(rulesData[key]) : 10;
        });
        
        setRules(parsedRules);
      })
      .catch(e => {
        console.error("Error loading rules in rules.tsx", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [groupName]);

  const formatPts = (val: number | undefined) => val !== undefined ? `+${val}` : '?';

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

  if (loading) {
     return (
       <View style={[styles.container, {justifyContent: 'center', alignItems: 'center'}]}>
         <ActivityIndicator size="large" color="#10b981" />
       </View>
     );
  }

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

      {/* Sección 3: Sistema de Puntuación Combinado */}
      <RuleSection number="2" title={t('rules.scoring_title')}>
        <Text style={styles.text}>A continuación se detallan los puntos configurados para el grupo <Text style={{fontWeight: 'bold', color: '#fff'}}>{groupName}</Text>:</Text>
        
        <Text style={styles.subHeading}>Fase de Grupos</Text>
        <View style={styles.table}>
          {[
            { label: t('rules.score_sign'), sub: t('rules.score_sign_sub'), pts: rules.pts_group_sign },
            { label: t('rules.score_diff'), sub: t('rules.score_diff_sub'), pts: rules.pts_group_diff },
            { label: t('rules.score_exact'), sub: t('rules.score_exact_sub'), pts: rules.pts_group_exact },
            { label: t('rules.score_pos'), sub: t('rules.score_pos_sub'), pts: rules.pts_group_pos },
            { label: t('rules.score_qual'), sub: t('rules.score_qual_sub'), pts: rules.pts_group_qualify },
          ].map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableLabel}>{item.label}</Text>
                <Text style={styles.tableSub}>{item.sub}</Text>
              </View>
              <Text style={styles.tablePts}>{formatPts(item.pts)} pts</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.subHeading, { marginTop: 20 }]}>Eliminatorias</Text>
        <View style={styles.table}>
          {[
            { label: 'Signo 1X2 KO', sub: 'Acertar ganador o empate', pts: rules.pts_ko_sign },
            { label: 'Diferencia de Goles KO', sub: 'Acertar diferencia exacta', pts: rules.pts_ko_diff },
            { label: 'Resultado Exacto KO', sub: 'Acertar resultado completo', pts: rules.pts_ko_exact },
            { label: 'Pasar de Ronda', sub: 'Acertar quién avanza', pts: rules.pts_ko_qualify },
          ].map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tableLabel}>{item.label}</Text>
                <Text style={styles.tableSub}>{item.sub}</Text>
              </View>
              <Text style={styles.tablePts}>{formatPts(item.pts)} pts</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.subHeading, { marginTop: 20 }]}>{t('rules.awards_title')}</Text>
        <View style={styles.table}>
          {[
            { label: t('rules.award_champ'), pts: rules.pts_honor_champ, color: '#fbbf24' },
            { label: t('rules.award_runner'), pts: rules.pts_honor_runner, color: '#e2e8f0' },
            { label: '3º Puesto', pts: rules.pts_honor_third, color: '#b45309' },
            { label: t('rules.award_gold'), pts: rules.pts_award_gold, color: '#fbbf24' },
            { label: t('rules.award_silver'), pts: rules.pts_award_silver, color: '#94a3b8' },
            { label: t('rules.award_bronze'), pts: rules.pts_award_bronze, color: '#b45309' },
          ].map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: item.color || '#fff' }]}>{item.label}</Text>
              <Text style={[styles.tablePts, { color: item.color || '#10b981' }]}>{formatPts(item.pts)} pts</Text>
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

      {/* Sección 4: Desempates */}
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

      {/* Sección 5: Restricciones */}
      <RuleSection number="4" title={t('rules.restrictions_title')}>
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
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 5,
    letterSpacing: 1
  },
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
