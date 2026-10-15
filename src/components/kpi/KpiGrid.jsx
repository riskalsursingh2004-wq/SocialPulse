import { Eye, Layers, MessageCircle, Percent, Share2, ThumbsUp } from 'lucide-react';
import KpiCard from './KpiCard.jsx';
import { useDashboard } from '../../context/DashboardContext.jsx';
import { formatCompact, formatNumber, formatPercent } from '../../utils/format.js';

/**
 * The six KPI cards. Every value is derived from the currently filtered
 * dataset — nothing is hardcoded (see utils/analytics.js for formulas).
 */
export default function KpiGrid({ onNavigate = null }) {
  const { kpis, comparison } = useDashboard();

  // Clickable navigation destinations (reuse the existing app router —
  // no duplicate pages). Analytics receives a focus hint so it can scroll
  // to / highlight the matching section.
  const nav = (page, focus) => () => onNavigate && onNavigate(page, focus);

  // The delta must compare the SAME two windows on both sides:
  // current period vs previous equivalent period (never whole-dataset vs window).
  const cur = comparison?.current;
  const prev = comparison?.previous;

  const cards = [
    {
      key: 'posts',
      label: 'Total Posts',
      displayValue: formatNumber(kpis.totalPosts),
      icon: Layers,
      accent: 'indigo',
      current: cur?.totalPosts,
      previous: prev?.totalPosts,
      hint: 'Number of posts in the current filtered dataset',
      onClick: onNavigate ? nav('data') : null,
      destinationLabel: 'open Data Management to browse every record',
    },
    {
      key: 'likes',
      label: 'Total Likes',
      displayValue: formatCompact(kpis.totalLikes),
      icon: ThumbsUp,
      accent: 'cyan',
      current: cur?.totalLikes,
      previous: prev?.totalLikes,
      hint: `Exact total: ${formatNumber(kpis.totalLikes)} likes`,
      onClick: onNavigate ? nav('analytics', 'likes') : null,
      destinationLabel: 'open Engagement Analytics focused on likes',
    },
    {
      key: 'comments',
      label: 'Total Comments',
      displayValue: formatCompact(kpis.totalComments),
      icon: MessageCircle,
      accent: 'violet',
      current: cur?.totalComments,
      previous: prev?.totalComments,
      hint: `Exact total: ${formatNumber(kpis.totalComments)} comments`,
      onClick: onNavigate ? nav('analytics', 'comments') : null,
      destinationLabel: 'open Engagement Analytics focused on comments',
    },
    {
      key: 'shares',
      label: 'Total Shares',
      displayValue: formatCompact(kpis.totalShares),
      icon: Share2,
      accent: 'amber',
      current: cur?.totalShares,
      previous: prev?.totalShares,
      hint: `Exact total: ${formatNumber(kpis.totalShares)} shares`,
      onClick: onNavigate ? nav('analytics', 'shares') : null,
      destinationLabel: 'open Engagement Analytics focused on shares',
    },
    {
      key: 'reach',
      label: 'Total Reach',
      displayValue: formatCompact(kpis.totalReach),
      icon: Eye,
      accent: 'rose',
      current: cur?.totalReach,
      previous: prev?.totalReach,
      hint: `Cumulative reach (sum of per-post reach, NOT unique audience): ${formatNumber(kpis.totalReach)}`,
      onClick: onNavigate ? nav('analytics', 'reach') : null,
      destinationLabel: 'open Reach Analytics (reach over time and by platform)',
    },
    {
      key: 'avgRate',
      label: 'Avg Engagement Rate',
      displayValue: formatPercent(kpis.avgEngagementRate, 2),
      icon: Percent,
      accent: 'emerald',
      current: cur?.avgEngagementRate,
      previous: prev?.avgEngagementRate,
      hint: 'Mean of per-post (likes+comments+shares)/reach×100, excluding posts with reach = 0',
      onClick: onNavigate ? nav('analytics', 'rate') : null,
      destinationLabel: 'open Engagement Analytics focused on engagement rate',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((c) => (
        <KpiCard
          key={c.key}
          label={c.label}
          displayValue={c.displayValue}
          icon={c.icon}
          accent={c.accent}
          current={c.current}
          previous={c.previous}
          hint={c.hint}
          compareLabel={comparison?.label}
          onClick={c.onClick}
          destinationLabel={c.destinationLabel}
        />
      ))}
    </div>
  );
}
