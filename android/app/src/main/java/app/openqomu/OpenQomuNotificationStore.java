package app.openqomu;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.AbstractMap;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Historial local de avisos por chat o tablero. La notificación agrupada se
 * reconstruye a partir de estas entradas para no perder los mensajes previos.
 */
final class openQomuNotificationStore {
    private static final String PREFS = "openqomu_notifications";
    private static final String KEY_PREFIX = "group:";
    private static final int MAX_ITEMS = 6;
    private static final int MAX_GROUPS = 40;
    private static final Pattern CHAT = Pattern.compile("/c/([^/?#]+)");
    private static final Pattern BOARD = Pattern.compile("/boards/([^/?#]+)");

    static final class Item {
        final String id;
        final String title;
        final String body;
        final String path;
        final long time;

        Item(String id, String title, String body, String path, long time) {
            this.id = id;
            this.title = title;
            this.body = body;
            this.path = path;
            this.time = time;
        }
    }

    private openQomuNotificationStore() {}

    static String groupKey(String path) {
        if (path != null) {
            Matcher chat = CHAT.matcher(path);
            if (chat.find()) return "chat-" + chat.group(1);
            Matcher board = BOARD.matcher(path);
            if (board.find()) return "board-" + board.group(1);
        }
        return "openqomu";
    }

    static int notificationId(String groupKey) {
        int id = groupKey.hashCode() & 0x7fffffff;
        return id == 0 ? 1 : id;
    }

    static synchronized void add(Context context, String groupKey, Item item) {
        List<Item> items = load(context, groupKey);
        for (int i = items.size() - 1; i >= 0; i--) {
            if (TextUtils.equals(items.get(i).id, item.id)) {
                items.remove(i);
            }
        }
        items.add(item);
        while (items.size() > MAX_ITEMS) {
            items.remove(0);
        }
        save(context, groupKey, items);
    }

    static synchronized List<Item> load(Context context, String groupKey) {
        List<Item> items = new ArrayList<>();
        String raw = prefs(context).getString(KEY_PREFIX + groupKey, null);
        if (raw == null) return items;
        try {
            JSONArray array = new JSONArray(raw);
            for (int i = 0; i < array.length(); i++) {
                JSONObject object = array.getJSONObject(i);
                items.add(
                    new Item(
                        object.optString("id"),
                        object.optString("title"),
                        object.optString("body"),
                        object.optString("path"),
                        object.optLong("time")
                    )
                );
            }
        } catch (JSONException ignored) {
            // Historial corrupto: se descarta y se empieza de cero.
        }
        return items;
    }

    static synchronized void clear(Context context, String groupKey) {
        prefs(context).edit().remove(KEY_PREFIX + groupKey).apply();
    }

    private static void save(Context context, String groupKey, List<Item> items) {
        JSONArray array = new JSONArray();
        for (Item item : items) {
            JSONObject object = new JSONObject();
            try {
                object.put("id", item.id);
                object.put("title", item.title);
                object.put("body", item.body);
                object.put("path", item.path);
                object.put("time", item.time);
            } catch (JSONException ignored) {
                continue;
            }
            array.put(object);
        }
        SharedPreferences preferences = prefs(context);
        preferences.edit().putString(KEY_PREFIX + groupKey, array.toString()).apply();
        prune(preferences);
    }

    private static void prune(SharedPreferences preferences) {
        List<Map.Entry<String, Long>> groups = new ArrayList<>();
        for (Map.Entry<String, ?> entry : preferences.getAll().entrySet()) {
            if (!entry.getKey().startsWith(KEY_PREFIX)) continue;
            long last = 0;
            try {
                JSONArray array = new JSONArray((String) entry.getValue());
                if (array.length() > 0) {
                    last = array.getJSONObject(array.length() - 1).optLong("time");
                }
            } catch (JSONException ignored) {
                // Se trata como el grupo más antiguo.
            }
            groups.add(new AbstractMap.SimpleEntry<>(entry.getKey(), last));
        }
        if (groups.size() <= MAX_GROUPS) return;
        groups.sort(Comparator.comparingLong(Map.Entry::getValue));
        SharedPreferences.Editor editor = preferences.edit();
        for (int i = 0; i < groups.size() - MAX_GROUPS; i++) {
            editor.remove(groups.get(i).getKey());
        }
        editor.apply();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
