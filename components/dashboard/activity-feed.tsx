'use client';

interface ActivityEvent {
  eventType: string;
  actor: string | null;
  payload: any;
  createdAt: string;
}

interface ActivityFeedProps {
  activities: ActivityEvent[];
}

const EVENT_EMOJI: Record<string, string> = {
  payment_confirmed: '💰',
  corrugator_booked: '🏭',
  corrugator_production_started: '⚙️',
  ravi_processed: '🤖',
  ravi_needs_owner: '🔴',
  ravi_whatsapp_sent: '📤',
  quote_created: '📋',
  order_confirmed: '✅',
  escalation_resolved: '🟢',
  escalation_dismissed: '🚫',
  workflow_transition: '🔄',
  owner_notified: '📢',
  customer_created: '👤',
  capacity_blocked_order: '⚠️',
};

const EVENT_LABEL: Record<string, string> = {
  payment_confirmed: 'Payment confirmed',
  corrugator_booked: 'Corrugator capacity booked',
  corrugator_production_started: 'Production started',
  ravi_processed: 'AI responded to customer',
  ravi_needs_owner: 'Escalation created — needs owner',
  ravi_whatsapp_sent: 'WhatsApp message sent',
  quote_created: 'Quote generated',
  order_confirmed: 'Order confirmed',
  escalation_resolved: 'Escalation resolved',
  escalation_dismissed: 'Escalation dismissed',
  workflow_transition: 'Customer stage changed',
  owner_notified: 'Owner notified',
  customer_created: 'New customer',
  capacity_blocked_order: 'Order blocked — no capacity',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📝 Recent Activity</h3>
        <p className="text-gray-400 text-sm text-center py-8">No recent activity. Events will appear here as customers interact.</p>
      </div>
    );
  }

  // Group by time buckets
  const groups: { label: string; events: ActivityEvent[] }[] = [];
  const now = Date.now();
  const today = new Date().toDateString();

  for (const event of activities) {
    const eventDate = parseDate(event.createdAt);
    const dateStr = eventDate.toDateString();
    let label: string;

    if (dateStr === today) {
      label = 'Today';
    } else {
      const diffDays = Math.floor((now - eventDate.getTime()) / 86400000);
      if (diffDays === 1) label = 'Yesterday';
      else if (diffDays < 7) label = `${diffDays}d ago`;
      else label = eventDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    }

    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.events.push(event);
    } else {
      groups.push({ label, events: [event] });
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 Recent Activity</h3>

      <div className="space-y-4">
        {groups.slice(0, 5).map((group) => (
          <div key={group.label}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="space-y-1">
              {group.events.slice(0, 10).map((event, i) => {
                const emoji = EVENT_EMOJI[event.eventType] || '📌';
                const label = EVENT_LABEL[event.eventType] || event.eventType.replace(/_/g, ' ');

                // Build a short description from payload
                let detail = '';
                if (event.payload) {
                  const p = event.payload;
                  if (p.phone) detail = `+${p.phone}`;
                  else if (p.customerPhone) detail = `+${p.customerPhone}`;
                  else if (p.kgBooked) detail = `${p.kgBooked}kg`;
                  else if (p.totalAmount) detail = `₹${p.totalAmount}`;
                  else if (typeof p === 'string') detail = p.slice(0, 60);
                }

                return (
                  <div
                    key={`${event.createdAt}-${i}`}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-sm"
                  >
                    <span className="text-base shrink-0">{emoji}</span>
                    <span className="text-gray-700 flex-1 min-w-0 truncate">
                      {label}
                      {detail && (
                        <span className="text-gray-400 ml-1.5 text-xs">{detail}</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatTime(event.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {activities.length > 30 && (
        <p className="text-center text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
          Showing most recent activity. {activities.length} total events in log.
        </p>
      )}
    </div>
  );
}

function parseDate(dateStr: string): Date {
  const s = dateStr.trim();
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    return new Date(s);
  }
  return new Date(s + 'Z');
}

function formatTime(dateStr: string): string {
  const d = parseDate(dateStr);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const mins = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h = hours % 12 || 12;
  return `${h}:${String(mins).padStart(2, '0')} ${ampm}`;
}

