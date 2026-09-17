export const POST_TAG_OPTIONS = [
  { value: 'ISSUE', label: '이슈', badgeVariant: 'outline' },
  { value: 'NOTICE', label: '공지', badgeVariant: 'default' },
  { value: 'CHAT', label: '잡담', badgeVariant: 'secondary' },
  { value: 'RESOLVED', label: '해결', badgeVariant: 'normal' },
] as const;

export type PostTagValue = (typeof POST_TAG_OPTIONS)[number]['value'];

export function postTagLabel(tag: PostTagValue): string {
  return POST_TAG_OPTIONS.find((o) => o.value === tag)?.label ?? tag;
}

export function postTagBadgeVariant(tag: PostTagValue) {
  return POST_TAG_OPTIONS.find((o) => o.value === tag)?.badgeVariant ?? 'outline';
}
