/**
 * Notifications list (FR11, Section 10.3). Shared by the requester and officer
 * tab groups. Shows in-app notifications, supports mark-as-read and mark-all,
 * and deep-links to the related booking when present.
 */
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { messageFromError } from '@/api/errors';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/api/hooks';
import {
  Button,
  Card,
  LoadingScreen,
  ScreenMessage,
} from '@/components/ui';
import { formatDateTime } from '@/lib/datetime';
import type { Notification } from '@/schemas';

export function NotificationsScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (isLoading) return <LoadingScreen label="Loading notifications…" />;
  if (isError) {
    return (
      <ScreenMessage title="Could not load" message={messageFromError(error)} />
    );
  }

  const hasUnread = data?.some((n) => !n.readAt) ?? false;

  function openNotification(n: Notification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.relatedEntityType === 'booking' && n.relatedEntityId) {
      router.push({ pathname: '/booking/[id]', params: { id: n.relatedEntityId } });
    }
  }

  return (
    <View className="flex-1 bg-surface">
      {hasUnread ? (
        <View className="p-4 pb-0">
          <Button
            label="Mark all as read"
            variant="secondary"
            loading={markAll.isPending}
            onPress={() => markAll.mutate()}
          />
        </View>
      ) : null}

      <FlatList
        contentContainerClassName="gap-3 p-4"
        data={data ?? []}
        keyExtractor={(n) => n.id}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
          />
        }
        ListEmptyComponent={
          <ScreenMessage
            title="No notifications"
            message="Booking updates will appear here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => openNotification(item)}
          >
            <Card className={item.readAt ? '' : 'border-primary'}>
              <View className="flex-row items-start gap-2">
                {!item.readAt ? (
                  <View className="mt-1.5 h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <View className="mt-1.5 h-2 w-2 rounded-full bg-transparent" />
                )}
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {item.title}
                  </Text>
                  <Text className="text-sm text-muted">{item.body}</Text>
                  <Text className="text-xs text-muted">
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
