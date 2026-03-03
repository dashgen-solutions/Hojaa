/* ------------------------------------------------------------------ */
/*  Shared type definitions & constants for the roadmap feature         */
/* ------------------------------------------------------------------ */

export interface RoadmapItemType {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  icon_name: string | null;
  inspired_by: string | null;
  vote_count: number;
  user_has_voted: boolean;
  shipped_at: string | null;
  created_at: string;
}

export interface FeatureRequestType {
  id: string;
  title: string;
  description: string | null;
  status: string;
  vote_count: number;
  user_has_voted: boolean;
  user_display_name: string | null;
  created_at: string;
}

export interface RoadmapStats {
  planned: number;
  in_progress: number;
  shipped: number;
  total_votes: number;
  total_requests: number;
}

export const ICON_MAP: Record<string, string> = {
  DocumentTextIcon: '\u{1F4C4}',
  RectangleStackIcon: '\u{1F4DA}',
  PencilSquareIcon: '\u{270D}\uFE0F',
  SparklesIcon: '\u{2728}',
  TableCellsIcon: '\u{1F4CA}',
  ChatBubbleLeftRightIcon: '\u{1F4AC}',
  ChatBubbleOvalLeftEllipsisIcon: '\u{1F5E8}\uFE0F',
  AtSymbolIcon: '@',
  BellAlertIcon: '\u{1F514}',
  ArrowPathIcon: '\u{1F504}',
  PaintBrushIcon: '\u{1F3A8}',
  BoltIcon: '\u{26A1}',
  ClockIcon: '\u{23F1}\uFE0F',
  ViewColumnsIcon: '\u{1F4CB}',
  Squares2X2Icon: '\u{1F4CC}',
  PuzzlePieceIcon: '\u{1F9E9}',
  ChartBarIcon: '\u{1F4C8}',
  DevicePhoneMobileIcon: '\u{1F4F1}',
  HashtagIcon: '#\uFE0F\u20E3',
  ArrowsRightLeftIcon: '\u{1F500}',
  CodeBracketIcon: '\u{1F517}',
  SwatchIcon: '\u{1F3AF}',
  LinkIcon: '\u{1F517}',
};

export const CATEGORY_LABELS: Record<string, string> = {
  document_content: 'Documents',
  team_communication: 'Communication',
  project_management: 'Project Management',
  platform_infrastructure: 'Platform',
  integrations: 'Integrations',
};
