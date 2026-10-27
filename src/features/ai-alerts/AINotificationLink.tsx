"use client";
import Link from "next/link";
import { useAppSelector } from "@/store/hooks";
import { selectAIUnreadCount } from "./aiAlertSelectors";

export function AINotificationCount() {
  const unread = useAppSelector(selectAIUnreadCount);
  return unread ? <span aria-label={`${unread} unread AI notifications`} className="rounded-full bg-error text-on-error px-1.5 text-xs font-bold">{unread}</span> : null;
}
export function AINotificationLink() {
  return <Link href="/alerts" aria-label="AI notifications" title="AI notifications"
    className="relative flex h-10 items-center justify-center gap-1 rounded-full px-2 hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2">
    <span aria-hidden="true" className="material-symbols-outlined">notifications</span><AINotificationCount />
  </Link>;
}
