package app.openqomu;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.List;
import java.util.Map;

/**
 * Construye las notificaciones nativas agrupadas por chat o tablero.
 *
 * El Worker envía mensajes data-only para que aquí se pueda mantener el
 * historial de cada grupo en una sola notificación (InboxStyle). La app sigue
 * usando @capacitor/push-notifications para el token y los deep links.
 */
public class OpenQomuMessagingService extends MessagingService {
    static final String CHANNEL_ID = "openqomu-v2";
    private static final String CHANNEL_SOUND = "openqomu_notification";
    private static final int MAX_LINE = 120;
    private static final int COLOR = 0xFF8B5CF6;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String title = data.get("title");
        String body = data.get("body");
        String path = data.get("path");
        String groupKey = data.get("groupKey");
        String itemId = data.get("id");

        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (title == null && notification != null) title = notification.getTitle();
        if (body == null && notification != null) body = notification.getBody();

        if (title == null || title.isEmpty()) title = "openQomu";
        if (body == null) body = "";
        if (path == null) path = "";
        if (groupKey == null || groupKey.isEmpty()) {
            groupKey = openQomuNotificationStore.groupKey(path);
        }
        if (itemId == null || itemId.isEmpty()) {
            itemId = String.valueOf(System.currentTimeMillis());
        }

        ensureChannel();
        if (!canNotify()) return;

        openQomuNotificationStore.add(
            this,
            groupKey,
            new openQomuNotificationStore.Item(itemId, title, body, path, System.currentTimeMillis())
        );
        show(groupKey);
    }

    private boolean canNotify() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(this).areNotificationsEnabled();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "openQomu",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Mensajes, tareas y menciones");
        channel.enableVibration(true);
        channel.setSound(
            Uri.parse("android.resource://" + getPackageName() + "/raw/" + CHANNEL_SOUND),
            new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build()
        );
        manager.createNotificationChannel(channel);
    }

    private void show(String groupKey) {
        List<openQomuNotificationStore.Item> history = openQomuNotificationStore.load(this, groupKey);
        if (history.isEmpty()) return;

        openQomuNotificationStore.Item latest = history.get(history.size() - 1);
        int notificationId = openQomuNotificationStore.notificationId(groupKey);

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse(deepLink(latest.path)));
        open.setPackage(getPackageName());
        open.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        open.putExtra("openqomu.group", groupKey);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            notificationId,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent dismiss = new Intent(this, OpenQomuNotificationDismissReceiver.class)
            .setAction(OpenQomuNotificationDismissReceiver.ACTION_DISMISS)
            .putExtra(OpenQomuNotificationDismissReceiver.EXTRA_GROUP, groupKey);
        PendingIntent deleteIntent = PendingIntent.getBroadcast(
            this,
            notificationId,
            dismiss,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.InboxStyle style = new NotificationCompat.InboxStyle()
            .setBigContentTitle(
                history.size() > 1
                    ? latest.title + " · " + history.size() + " mensajes"
                    : latest.title
            );
        for (openQomuNotificationStore.Item item : history) {
            style.addLine(excerpt(item.title, item.body));
        }
        if (history.size() > 1) {
            style.setSummaryText("Historial reciente");
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_openqomu)
            .setColor(COLOR)
            .setContentTitle(latest.title)
            .setContentText(excerptBody(latest.body))
            .setStyle(style)
            .setNumber(history.size())
            .setWhen(latest.time)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(contentIntent)
            .setDeleteIntent(deleteIntent);

        if (history.size() > 1) {
            builder.setSubText(history.size() + " mensajes");
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder
                .setSound(
                    Uri.parse("android.resource://" + getPackageName() + "/raw/" + CHANNEL_SOUND)
                )
                .setVibrate(new long[] { 0, 300, 200, 300 });
        }

        Notification notification = builder.build();
        try {
            NotificationManagerCompat.from(this).notify(notificationId, notification);
        } catch (SecurityException ignored) {
            // El usuario revocó el permiso entre la comprobación y el envío.
        }
    }

    private static String excerpt(String title, String body) {
        String line = body == null ? "" : body;
        if (title != null && !title.isEmpty()) {
            line = title + ": " + line;
        }
        return truncate(line);
    }

    private static String excerptBody(String body) {
        return truncate(body == null ? "" : body);
    }

    private static String truncate(String value) {
        String compact = value.replaceAll("\\s+", " ").trim();
        if (compact.length() <= MAX_LINE) return compact;
        return compact.substring(0, MAX_LINE - 1).trim() + "…";
    }

    /** Convierte una ruta web (/w/...) en el deep link que entiende la app. */
    private static String deepLink(String path) {
        if (path == null || path.isEmpty()) return "openqomu://app";
        if (path.startsWith("/")) return "openqomu://" + path.substring(1);
        return "openqomu://" + path;
    }
}
