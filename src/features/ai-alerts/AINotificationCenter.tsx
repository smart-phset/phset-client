"use client";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAINotifications, selectAIUnreadCount } from "./aiAlertSelectors";
import { notificationsRead, notificationsCleared } from "./aiAlertSlice";
import { AISeverityBadge } from "./AISeverityBadge";

export function AINotificationCenter() {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectAINotifications);
  const unread = useAppSelector(selectAIUnreadCount);
  return <section aria-labelledby="ai-notifications-title" className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 id="ai-notifications-title" className="text-headline-md font-semibold">AI notifications</h1>
        <p className="text-on-surface-variant">{unread} unread · Latest 100 notifications from this visit. Refreshing clears this list.</p></div>
      <div className="flex gap-2">
        <button type="button" disabled={!unread} onClick={() => dispatch(notificationsRead())}
          className="rounded-lg px-3 py-2 bg-primary text-on-primary disabled:opacity-50">Mark all read</button>
        <button type="button" disabled={!notifications.length} onClick={() => dispatch(notificationsCleared())}
          className="rounded-lg px-3 py-2 border border-outline-variant disabled:opacity-50">Clear notifications</button>
      </div>
    </div>
    <p className="text-sm text-on-surface-variant">AI predictions are inspection guidance. Possible contamination requires checking the crop.</p>
    {!notifications.length ? <p className="rounded-xl bg-surface-container-lowest p-6">No AI notifications this visit. Fresh Yellow or Red detections appear here automatically.</p>
      : <ol className="space-y-3" aria-label="AI notification history">
        {notifications.map(notification => <li key={notification.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">{!notification.read && <span className="inline-block mr-2 h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}{notification.title}</h2>
            <AISeverityBadge severity={notification.to} />
          </div>
          <p className="mt-2">{notification.message}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm text-on-surface-variant">
            <span className="break-all">Camera: {notification.cameraId}</span>
            <time dateTime={notification.capturedAt}>{new Date(notification.capturedAt).toLocaleString()}</time>
            {notification.confidence !== null && <span>AI contamination confidence: {Math.round(notification.confidence * 100)}%</span>}
          </div>
        </li>)}
      </ol>}
  </section>;
}
