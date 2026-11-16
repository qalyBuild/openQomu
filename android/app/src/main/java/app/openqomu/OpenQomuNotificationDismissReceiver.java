package app.openqomu;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Limpia el historial del grupo cuando el usuario descarta la notificación. */
public class OpenQomuNotificationDismissReceiver extends BroadcastReceiver {
    static final String ACTION_DISMISS = "app.openqomu.NOTIFICATION_DISMISS";
    static final String EXTRA_GROUP = "openqomu.group";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
            return;
        }
        String group = intent.getStringExtra(EXTRA_GROUP);
        if (group != null) {
            openQomuNotificationStore.clear(context, group);
        }
    }
}
